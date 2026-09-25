const MARKET_PROXY_URL = 'https://forex-market-proxy.asimrbrohi.workers.dev/quotes';
const LIVE_REFRESH_MS = 65000;

const state = {
  balance: 10000,
  trades: [],
  journal: [],
  liveFeedActive: false,
  lastMarketUpdate: null,
  market: {
    'EUR/USD': { price: 1.0850, delta: 0 },
    'GBP/USD': { price: 1.2650, delta: 0 },
    'USD/JPY': { price: 156.80, delta: 0 },
    'AUD/USD': { price: 0.6550, delta: 0 },
    'USD/CHF': { price: 0.9020, delta: 0 }
  },
  lessons: [
    { title: 'Pips explained', text: 'A pip is the tiny price movement traders track. For most pairs, it is the fourth decimal place.' },
    { title: 'Spread matters', text: 'The spread is the cost of entering and exiting a trade. Lower spreads are usually cheaper.' },
    { title: 'Risk small', text: 'A good beginner rule is to risk only 1% to 2% of your account per trade.' },
    { title: 'Stop loss', text: 'A stop loss limits losses. It is your safety net and should be placed before you enter.' }
  ]
};

const els = {
  balanceValue: document.getElementById('balanceValue'),
  pnlValue: document.getElementById('pnlValue'),
  openTradesValue: document.getElementById('openTradesValue'),
  winRateValue: document.getElementById('winRateValue'),
  riskValue: document.getElementById('riskValue'),
  lessonGrid: document.getElementById('lessonGrid'),
  watchlist: document.getElementById('watchlist'),
  tradeJournal: document.getElementById('tradeJournal'),
  tradeForm: document.getElementById('tradeForm'),
  riskForm: document.getElementById('riskForm'),
  installBtn: document.getElementById('installBtn'),
  marketStatusDot: document.getElementById('marketStatusDot'),
  marketStatusText: document.getElementById('marketStatusText'),
  tabButtons: [...document.querySelectorAll('.tab-button')],
  tabPanels: [...document.querySelectorAll('.tab-panel')]
};

const fallbackPrices = {
  'EUR/USD': '1.0850', 'GBP/USD': '1.2650', 'USD/JPY': '156.80',
  'AUD/USD': '0.6550', 'USD/CHF': '0.9020'
};

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function decimals(pair) { return pair.includes('JPY') ? 2 : 4; }
function pipSize(pair) { return pair.includes('JPY') ? 0.01 : 0.0001; }

function setMarketStatus(online, message) {
  if (!els.marketStatusText) return;
  els.marketStatusDot?.classList.toggle('online', online);
  els.marketStatusDot?.classList.toggle('offline', !online);
  els.marketStatusText.textContent = message || (online ? 'Live feed online' : 'Using demo feed');
}

function renderLessons() {
  els.lessonGrid.innerHTML = state.lessons.map((lesson) => `
    <article class="lesson-card"><h4>${lesson.title}</h4><p>${lesson.text}</p></article>
  `).join('');
}

function renderWatchlist() {
  els.watchlist.innerHTML = Object.entries(state.market).map(([pair, item]) => {
    const trend = item.delta >= 0 ? 'up' : 'down';
    const movement = item.delta === 0 ? '—' : `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(decimals(pair))}`;
    return `
      <div class="watch-row">
        <div class="watch-pair"><strong>${pair}</strong><span class="watch-meta">Live quote</span></div>
        <div class="watch-pair"><strong>${Number(item.price).toFixed(decimals(pair))}</strong><span class="watch-meta">${movement}</span></div>
        <span class="ticker ${trend}">${item.delta === 0 ? 'Stable' : trend === 'up' ? 'Bullish' : 'Bearish'}</span>
      </div>`;
  }).join('');
}

function renderJournal() {
  if (!state.journal.length) {
    els.tradeJournal.innerHTML = '<div class="empty-state">No trades yet. Open your first demo trade to begin.</div>';
    return;
  }
  els.tradeJournal.innerHTML = state.journal.map((entry) => `
    <article class="journal-item">
      <div><strong>${entry.pair}</strong><br><small>${entry.direction.toUpperCase()} • ${entry.lots} lots</small></div>
      <span class="tag-pill ${entry.direction === 'buy' ? 'buy' : 'sell'}">${entry.direction.toUpperCase()}</span>
      <span class="${entry.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${entry.pnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(entry.pnl))}</span>
    </article>`).join('');
}

function calculateRisk() {
  const balance = Number(document.getElementById('accountBalance').value) || 10000;
  const percent = Number(document.getElementById('riskPercent').value) || 2;
  const stopDistance = Math.max(Number(document.getElementById('stopDistance').value) || 30, 1);
  const maxRisk = balance * percent / 100;
  const riskPerPip = maxRisk / stopDistance;
  document.getElementById('maxRiskValue').textContent = formatMoney(maxRisk);
  document.getElementById('riskPerPipValue').textContent = formatMoney(riskPerPip);
  document.getElementById('lotSuggestionValue').textContent = (riskPerPip / 10).toFixed(2);
  els.riskValue.textContent = `${percent.toFixed(1)}%`;
}

function calculateOpenTradesPnl() {
  return state.trades.filter((trade) => trade.status === 'open').reduce((total, trade) => {
    const current = state.market[trade.pair]?.price;
    if (!current) return total;
    const pips = (trade.direction === 'buy' ? current - trade.entry : trade.entry - current) / pipSize(trade.pair);
    trade.unrealizedPnl = pips * trade.lots * 10;
    return total + trade.unrealizedPnl;
  }, 0);
}

function updateSummary() {
  const open = state.trades.filter((trade) => trade.status === 'open');
  const realized = state.trades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const totalPnl = realized + calculateOpenTradesPnl();
  const wins = state.trades.filter((trade) => trade.realizedPnl > 0).length;
  els.balanceValue.textContent = formatMoney(state.balance);
  els.pnlValue.textContent = `${totalPnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(totalPnl))}`;
  els.openTradesValue.textContent = String(open.length);
  els.winRateValue.textContent = `${state.trades.length ? Math.round(wins / state.trades.length * 100) : 0}%`;
}

function closeTradesAtCurrentPrices() {
  state.trades.forEach((trade) => {
    if (trade.status !== 'open') return;
    const current = state.market[trade.pair]?.price;
    const hitStop = trade.direction === 'buy' ? current <= trade.stop : current >= trade.stop;
    const hitTarget = trade.direction === 'buy' ? current >= trade.takeProfit : current <= trade.takeProfit;
    if (!hitStop && !hitTarget) return;
    trade.status = 'closed';
    trade.realizedPnl = hitStop ? -Math.abs(trade.unrealizedPnl) : Math.abs(trade.unrealizedPnl);
    state.balance += trade.realizedPnl;
    state.journal.unshift({ pair: trade.pair, direction: trade.direction, lots: trade.lots, pnl: trade.realizedPnl });
  });
}

async function fetchLiveMarketData() {
  try {
    const response = await fetch(`${MARKET_PROXY_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error);

    Object.keys(state.market).forEach((pair) => {
      const quote = payload[pair];
      if (!quote || !Number.isFinite(Number(quote.price))) return;
      const previous = state.market[pair].price;
      state.market[pair].price = Number(quote.price);
      state.market[pair].delta = state.market[pair].price - previous;
    });

    state.liveFeedActive = true;
    state.lastMarketUpdate = new Date();
    setMarketStatus(true, `Live feed • ${state.lastMarketUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
    closeTradesAtCurrentPrices();
    renderWatchlist();
    renderJournal();
    updateSummary();
  } catch (error) {
    console.warn('Live market feed failed:', error);
    state.liveFeedActive = false;
    setMarketStatus(false, 'Feed unavailable • demo prices');
  }
}

function openTrade(event) {
  event.preventDefault();
  const data = new FormData(els.tradeForm);
  const pair = data.get('pair');
  const direction = data.get('side');
  const lots = Number(data.get('lots'));
  const entry = Number(data.get('entry'));
  const stop = Number(data.get('stop'));
  const takeProfit = Number(data.get('takeProfit'));
  if (!pair || !lots || !entry || !stop || !takeProfit) return;
  state.trades.push({ id: crypto.randomUUID?.() || String(Date.now()), pair, direction, lots, entry, stop, takeProfit, status: 'open', realizedPnl: 0, unrealizedPnl: 0 });
  updateSummary();
  renderJournal();
  els.tradeForm.reset();
}

function bindTabs() {
  els.tabButtons.forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.tab;
    els.tabButtons.forEach((item) => item.classList.toggle('active', item === button));
    els.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === target));
  }));
}

function initDefaults() {
  const pairSelect = document.getElementById('pair');
  const updatePrices = () => {
    const pair = pairSelect.value;
    const base = state.market[pair]?.price || Number(fallbackPrices[pair]);
    const gap = pair.includes('JPY') ? 0.8 : 0.005;
    const targetGap = pair.includes('JPY') ? 1.2 : 0.01;
    document.getElementById('entry').value = Number(base).toFixed(decimals(pair));
    document.getElementById('stop').value = (base - gap).toFixed(decimals(pair));
    document.getElementById('takeProfit').value = (base + targetGap).toFixed(decimals(pair));
  };
  pairSelect.addEventListener('change', updatePrices);
  document.getElementById('calculateRisk').addEventListener('click', calculateRisk);
  els.tradeForm.addEventListener('submit', openTrade);
  els.riskForm.addEventListener('submit', (event) => { event.preventDefault(); calculateRisk(); });
  updatePrices();
}

renderLessons();
renderWatchlist();
renderJournal();
updateSummary();
calculateRisk();
bindTabs();
initDefaults();
setMarketStatus(false, 'Connecting to live feed…');
fetchLiveMarketData();
setInterval(fetchLiveMarketData, LIVE_REFRESH_MS);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}
