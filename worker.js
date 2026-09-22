const SYMBOLS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'];
const BASE_URL = 'https://api.twelvedata.com';
const quoteCache = new Map();

function getDecimals(symbol) {
  return symbol.includes('JPY') ? 2 : 4;
}

function normalizePrice(symbol, value) {
  const decimals = getDecimals(symbol);
  return Number(Number(value).toFixed(decimals));
}

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
}

async function fetchSymbolPrice(symbol, apiKey) {
  const url = new URL('/price', BASE_URL);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Twelve Data request failed for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.price) {
    throw new Error(`No price value returned for ${symbol}`);
  }

  return normalizePrice(symbol, data.price);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders() });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders() }
      });
    }

    const apiKey = env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing TWELVE_DATA_API_KEY environment variable. Add it in Cloudflare Worker settings.'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...buildCorsHeaders() }
        }
      );
    }

    try {
      const payload = {};

      for (const symbol of SYMBOLS) {
        const current = await fetchSymbolPrice(symbol, apiKey);
        const previous = quoteCache.get(symbol) ?? current;
        const delta = Number((current - previous).toFixed(getDecimals(symbol)));

        payload[symbol] = {
          price: current,
          delta
        };

        quoteCache.set(symbol, current);
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...buildCorsHeaders() }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Unable to fetch live market data',
          details: error instanceof Error ? error.message : String(error)
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...buildCorsHeaders() }
        }
      );
    }
  }
};
