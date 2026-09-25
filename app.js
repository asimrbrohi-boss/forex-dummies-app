const SYMBOLS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const BASE_URL = 'https://api.twelvedata.com';
const previousQuotes = new Map();

function decimals(symbol) {
  return symbol.includes('JPY') ? 2 : 4;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store'
  };
}

async function fetchPrice(symbol, apiKey) {
  const url = new URL('/price', BASE_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('dp', String(decimals(symbol)));
  const response = await fetch(url, { cf: { cacheTtl: 0, cacheEverything: false } });
  const data = await response.json();
  if (!response.ok || !data || !data.price) {
    throw new Error(`Twelve Data failed for ${symbol}: ${data?.message || response.status}`);
  }
  return Number(data.price);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });

    if (!env.TWELVE_DATA_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing TWELVE_DATA_API_KEY secret' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
    }

    try {
      const payload = {};
      for (const symbol of SYMBOLS) {
        const price = await fetchPrice(symbol, env.TWELVE_DATA_API_KEY);
        const previous = previousQuotes.get(symbol);
        payload[symbol] = {
          price,
          delta: previous === undefined ? 0 : Number((price - previous).toFixed(6))
        };
        previousQuotes.set(symbol, price);
      }
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
    }
  }
};
