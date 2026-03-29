// netlify/functions/scraping-recensioni.js
// Chiamata settimanale via cron-job.org
// Salva numero recensioni e rating Google su Airtable

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  // Protezione con chiave API
  const API_KEY = process.env.FEEDBACK_API_KEY;
  const requestKey = event.headers['x-api-key'] || event.queryStringParameters?.key;
  if (API_KEY && requestKey !== API_KEY) {
    return { statusCode: 401, headers, body: 'Unauthorized' };
  }

  const GOOGLE_API_KEY    = process.env.GOOGLE_PLACES_API_KEY;
  const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_RECENSIONI = process.env.AIRTABLE_RECENSIONI || 'Recensioni';
  const PLACE_ID = 'ChIJr9H7A7enhkcRimfhn3EqfVU';

  try {
    // ── 1. Chiama Google Places API ──────────────────────────────────
    const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=rating,user_ratings_total&key=${GOOGLE_API_KEY}`;

    const placesRes = await fetch(placesUrl);
    const placesData = await placesRes.json();

    console.log('Places API response:', JSON.stringify(placesData));

    if (placesData.status !== 'OK') {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: placesData.status, details: placesData })
      };
    }

    const rating     = placesData.result.rating || null;
    const recensioni = placesData.result.user_ratings_total || null;
    const oggi       = new Date().toISOString().split('T')[0];

    console.log(`Rating: ${rating}, Recensioni: ${recensioni}`);

    // ── 2. Salva su Airtable ─────────────────────────────────────────
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_RECENSIONI)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Data':               oggi,
            'Google Recensioni':  recensioni,
            'Google Rating':      rating,
          }
        })
      }
    );

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      console.error('Airtable error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, rating, recensioni, data: oggi }),
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
