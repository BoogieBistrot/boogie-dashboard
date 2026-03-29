// netlify/functions/disponibilita.js

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE    = process.env.AIRTABLE_TABLE || 'Prenotazioni';
  const AIRTABLE_CHIUSURE = process.env.AIRTABLE_CHIUSURE || 'Chiusure';
  const AIRTABLE_ORARI    = process.env.AIRTABLE_ORARI || 'Orari';

  const { data } = event.queryStringParameters || {};
  if (!data) return { statusCode: 400, headers, body: 'Parametro data mancante' };

  const dataObj = new Date(data + 'T12:00:00');
  const giornoSettimana = dataObj.getDay();

  try {
    // ── 1. Leggi tutti i record chiusure/aperture ────────────────────
    const chiusureRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_CHIUSURE)}`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );

    let aperturaStaordinaria = false;
    let fasceAperte = new Set(); // fasce aperte per apertura straordinaria
    const fasceChiuse = new Set();
    let tuttoChiuso = false;

    if (chiusureRes.ok) {
      const chiusureData = await chiusureRes.json();
      const records = chiusureData.records || [];

      // Prima passata: cerca aperture straordinarie per questa data
      for (const record of records) {
        const tipoApertura = record.fields['Tipo apertura'];
        const tipo         = record.fields['Tipo'];
        const dataInizio   = record.fields['Data inizio'];
        const dataFine     = record.fields['Data fine'];
        const fascia       = record.fields['Fascia']; // ora è array

        if (tipoApertura === 'Apertura straordinaria' && tipo === 'Data specifica' && dataInizio) {
          const fine = dataFine || dataInizio;
          if (data >= dataInizio && data <= fine) {
            aperturaStaordinaria = true;
            // Fascia è ora un array — se vuoto apre tutto, altrimenti solo le fasce selezionate
            if (Array.isArray(fascia) && fascia.length > 0) {
              fascia.forEach(f => fasceAperte.add(f));
            }
            break;
          }
        }
      }

      // Se non c'è apertura straordinaria, controlla le chiusure
      if (!aperturaStaordinaria) {
        for (const record of records) {
          const tipoApertura = record.fields['Tipo apertura'];
          if (tipoApertura === 'Apertura straordinaria') continue;

          const tipo       = record.fields['Tipo'];
          const giorno     = record.fields['Giorno'];
          const dataInizio = record.fields['Data inizio'];
          const dataFine   = record.fields['Data fine'];
          const fascia     = record.fields['Fascia']; // ora è array

          let match = false;

          if (tipo === 'Ricorrente' && giorno !== undefined && giorno !== null) {
            match = parseInt(giorno) === giornoSettimana;
          }
          if (tipo === 'Data specifica' && dataInizio) {
            const fine = dataFine || dataInizio;
            match = data >= dataInizio && data <= fine;
          }

          if (match) {
            // Fascia vuota = chiude tutto
            if (!fascia || (Array.isArray(fascia) && fascia.length === 0)) {
              tuttoChiuso = true;
              break;
            } else {
              // Chiude solo le fasce specificate
              const fasciaArr = Array.isArray(fascia) ? fascia : [fascia];
              fasciaArr.forEach(f => fasceChiuse.add(f));
            }
          }
        }
      }
    }

    if (tuttoChiuso) {
      return { statusCode: 200, headers, body: JSON.stringify({ chiuso: true, fasce: [] }) };
    }

    // ── 2. Recupera orari da Airtable ────────────────────────────────
    const orariRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_ORARI)}`,
      { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } }
    );

    const fasceSlots = {};
    const ORDINE_FASCE = ['Pranzo', 'Aperitivo', 'Cena'];

    if (orariRes.ok) {
      const orariData = await orariRes.json();
      const orari = (orariData.records || []).filter(r => r.fields['Attivo']);

      for (const record of orari) {
        const giorni     = record.fields['Giorni'] || [];
        const oraInizio  = record.fields['Ora inizio'];
        const oraFine    = record.fields['Ora fine'];
        const intervallo = parseInt(record.fields['Intervallo minuti']) || 15;
        const fascia     = record.fields['Fascia'] || 'Cena';

        // Per apertura straordinaria: usa gli orari delle fasce selezionate
        // ignorando il giorno della settimana
        if (aperturaStaordinaria) {
          // Se fasceAperte è vuoto apre tutto, altrimenti solo le fasce selezionate
          if (fasceAperte.size > 0 && !fasceAperte.has(fascia)) continue;
          // Non filtrare per giorno — l'apertura straordinaria override il giorno
        } else {
          if (!giorni.includes(String(giornoSettimana))) continue;
          if (fasceChiuse.has(fascia)) continue;
        }

        if (!oraInizio || !oraFine) continue;

        const [hStart, mStart] = oraInizio.split(':').map(Number);
        const [hEnd, mEnd]     = oraFine.split(':').map(Number);
        let minuti = hStart * 60 + mStart;
        const minutiFine = hEnd * 60 + mEnd;

        if (!fasceSlots[fascia]) fasceSlots[fascia] = new Set();
        while (minuti <= minutiFine) {
          const h = String(Math.floor(minuti / 60)).padStart(2, '0');
          const m = String(minuti % 60).padStart(2, '0');
          fasceSlots[fascia].add(`${h}:${m}`);
          minuti += intervallo;
        }
      }
    }

    const tuttiSlots = [];
    for (const fascia of ORDINE_FASCE) {
      if (fasceSlots[fascia]) {
        [...fasceSlots[fascia]].sort().forEach(s => tuttiSlots.push(s));
      }
    }

    if (tuttiSlots.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ chiuso: true, fasce: [] }) };
    }

    const MAX_PERSONE_PER_SLOT = 10;

    // ── 3. Recupera prenotazioni per la data ─────────────────────────
    const filterFormula = encodeURIComponent(
      `AND(DATETIME_FORMAT({Data},'YYYY-MM-DD')="${data}", {Stato}!="Cancellata")`
    );
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${filterFormula}&fields[]=Ora&fields[]=Persone`;

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` } });
    if (!res.ok) {
      console.error('Airtable error:', await res.text());
      return { statusCode: 500, headers, body: 'Errore Airtable' };
    }

    const json = await res.json();
    const records = json.records || [];

    const occupazione = {};
    tuttiSlots.forEach(slot => occupazione[slot] = 0);
    records.forEach(record => {
      const ora = record.fields['Ora'];
      const persone = record.fields['Persone'] || 0;
      if (ora && occupazione[ora] !== undefined) occupazione[ora] += persone;
    });

    const fasce = [];
    for (const fascia of ORDINE_FASCE) {
      if (!fasceSlots[fascia]) continue;
      const slots = [...fasceSlots[fascia]].sort().map(slot => ({
        ora: slot,
        occupati: occupazione[slot] || 0,
        disponibili: Math.max(0, MAX_PERSONE_PER_SLOT - (occupazione[slot] || 0)),
        pieno: (occupazione[slot] || 0) >= MAX_PERSONE_PER_SLOT,
      }));
      fasce.push({ fascia, slots });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ chiuso: false, fasce }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: 'Errore server' };
  }
};
