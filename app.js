const MARKET_PROXY_URL =
  'https://YOUR-WORKER-NAME.YOUR-ACCOUNT.workers.dev/quotes';
const state = {
  balance: 10000,
  trades: [],
  journal: [],
  liveFeedActive: false,
  market: {
    'EUR/USD': { price: 1.0850, delta: 0.0008 },
    'GBP/USD': { price: 1.2650, delta: 0.0011 },
    'USD/JPY': { price: 156.80, delta: 0.42 },
    'AUD/USD': { price: 0.6550, delta: 0.0007 },
    'USD/CHF': { price: 0.9020, delta: 0.0009 }
  },
  lessons: [
    {
      title: 'Pips explained',
      text: 'A pip is the tiny price movement traders track. For most pairs, it is the fourth decimal place.'
    },
    {
      title: 'Spread matters',
      text: 'The spread is the cost of entering and exiting a trade. Lower spreads are usually cheaper.'
    },
    {
      title: 'Risk small',
      text: 'A good beginner rule is to risk only 1% to 2% of your account per trade.'
    },
    {
      title: 'Stop loss',
      text: 'A stop loss limits losses. It is your safety net and should be placed before you enter.'
    }
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

const usdPairMap = {
  'EUR/USD': '1.0850',
  'GBP/USD': '1.2650',
  'USD/JPY': '156.80',
  'AUD/USD': '0.6550',
  'USD/CHF': '0.9020'
};

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function setMarketStatus(isOnline, message) {
  if (!els.marketStatusDot || !els.marketStatusText) return;
  els.marketStatusDot.classList.toggle('online', isOnline);
  els.marketStatusDot.classList.toggle('offline', !isOnline);
  els.marketStatusText.textContent = message || (isOnline ? 'Live feed online' : 'Using demo feed');
}

function formatPips(value) {
  const abs = Math.abs(value);
  return `${value >= 0 ? '+' : '-'}${abs.toFixed(2)} pips`;
}

function getDirectionClass(side) {
  return side === 'buy' ? 'buy' : 'sell';
}

function renderLessons() {
  els.lessonGrid.innerHTML = state.lessons
    .map(
      (lesson) => `
        <article class="lesson-card">
          <h4>${lesson.title}</h4>
          <p>${lesson.text}</p>
        </article>
      `
    )
    .join('');
}

function renderWatchlist() {
  els.watchlist.innerHTML = Object.entries(state.market)
    .map(([pair, item]) => {
      const price = Number(item.price);
      const trend = item.delta >= 0 ? 'up' : 'down';
      const direction = trend === 'up' ? '▲' : '▼';
      const decimals = pair.includes('JPY') ? 2 : 4;
      return `
        <div class="watch-row">
          <div class="watch-pair">
            <strong>${pair}</strong>
            <span class="watch-meta">Spread 0.6</span>
          </div>
          <div class="watch-pair">
            <strong>${price.toFixed(decimals)}</strong>
            <span class="watch-meta">${direction} ${Math.abs(item.delta).toFixed(decimals)}</span>
          </div>
          <span class="ticker ${trend}">${trend === 'up' ? 'Bullish' : 'Bearish'}</span>
        </div>
      `;
    })
    .join('');
}

function renderJournal() {
  if (!state.journal.length) {
    els.tradeJournal.innerHTML = '<div class="empty-state">No trades yet. Open your first demo trade to begin.</div>';
    return;
  }

  els.tradeJournal.innerHTML = state.journal
    .map(
      (entry) => `
        <article class="journal-item">
          <div>
            <strong>${entry.pair}</strong><br />
            <small>${entry.direction.toUpperCase()} • ${entry.lots} lots</small>
          </div>
          <span class="tag-pill ${getDirectionClass(entry.direction)}">${entry.direction.toUpperCase()}</span>
          <span class="${entry.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${entry.pnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(entry.pnl))}</span>
        </article>
      `
    )
    .join('');
}

function calculateRisk() {
  const balance = Number(document.getElementById('accountBalance').value || 10000);
  const percent = Number(document.getElementById('riskPercent').value || 2);
  const stopDistance = Number(document.getElementById('stopDistance').value || 30);
  const maxRisk = (balance * percent) / 100;
  const riskPerPip = maxRisk / stopDistance;
  const lotSuggestion = riskPerPip / 10;

  document.getElementById('maxRiskValue').textContent = formatMoney(maxRisk);
  document.getElementById('riskPerPipValue').textContent = formatMoney(riskPerPip);
  document.getElementById('lotSuggestionValue').textContent = lotSuggestion.toFixed(2);
  document.getElementById('riskValue').textContent = `${percent.toFixed(1)}%`;
}

function calculateOpenTradesPnl() {
  const active = state.trades.filter((trade) => trade.status === 'open');
  let total = 0;
  active.forEach((trade) => {
    const pair = state.market[trade.pair];
    if (!pair) return;
    const currentPrice = Number(pair.price);
    const distance = trade.direction === 'buy' ? currentPrice - trade.entry : trade.entry - currentPrice;
    const pipMovement = distance * 10000;
    trade.unrealizedPnl = Math.abs(pipMovement) * trade.lots * 10;
    total += trade.unrealizedPnl * (trade.direction === 'buy' ? 1 : -1);
  });

  return total;
}

function updateSummary() {
  const openTrades = state.trades.filter((trade) => trade.status === 'open');
  const totalPnl = state.trades.reduce((sum, trade) => sum + trade.realizedPnl, 0) + calculateOpenTradesPnl();
  const wins = state.trades.filter((trade) => trade.realizedPnl > 0).length;
  const winRate = state.trades.length ? ((wins / state.trades.length) * 100).toFixed(0) : 0;

  els.balanceValue.textContent = formatMoney(state.balance);
  els.pnlValue.textContent = `${totalPnl >= 0 ? '+' : '-'}${formatMoney(Math.abs(totalPnl))}`;
  els.openTradesValue.textContent = String(openTrades.length);
  els.winRateValue.textContent = `${winRate}%`;
  els.riskValue.textContent = `${(state.riskPercent || 2).toFixed(1)}%`;
}

function makeTradeId() {
  return `trade-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function openTrade(event) {
  event.preventDefault();
  const formData = new FormData(els.tradeForm);
  const pair = formData.get('pair');
  const direction = formData.get('side');
  const lots = Number(formData.get('lots'));
  const entry = Number(formData.get('entry'));
  const stop = Number(formData.get('stop'));
  const takeProfit = Number(formData.get('takeProfit'));

  if (!pair || !lots || !entry || !stop || !takeProfit) {
    return;
  }

  const trade = {
    id: makeTradeId(),
    pair,
    direction,
    lots,
    entry,
    stop,
    takeProfit,
    status: 'open',
    createdAt: new Date().toLocaleString(),
    realizedPnl: 0,
    unrealizedPnl: 0
  };

  state.trades.push(trade);
  state.journal = state.trades
    .filter((item) => item.status !== 'open')
    .map((tradeItem) => ({
      pair: tradeItem.pair,
      direction: tradeItem.direction,
      lots: tradeItem.lots,
      pnl: tradeItem.realizedPnl
    }));

  updateSummary();
  renderJournal();
  els.tradeForm.reset();
  document.getElementById('lots').value = 0.10;
  document.getElementById('entry').value = usdPairMap[pair] || 1.0850;
  document.getElementById('stop').value = (Number(usdPairMap[pair]) - 0.005).toFixed(pair.includes('JPY') ? 2 : 4);
  document.getElementById('takeProfit').value = (Number(usdPairMap[pair]) + 0.01).toFixed(pair.includes('JPY') ? 2 : 4);
}

function simulateMarketTick() {
  Object.keys(state.market).forEach((pair) => {
    const item = state.market[pair];
    const variance = (Math.random() - 0.5) * (pair.includes('JPY') ? 1.4 : 0.0015);
    item.price = Number((item.price + variance).toFixed(pair.includes('JPY') ? 2 : 4));
    item.delta = Number((variance * 10).toFixed(pair.includes('JPY') ? 2 : 4));
  });

  state.trades.forEach((trade) => {
    if (trade.status !== 'open') return;

    const currentPrice = Number(state.market[trade.pair].price);
    const directionPnl = trade.direction === 'buy' ? (currentPrice - trade.entry) : (trade.entry - currentPrice);
    const pipDifference = directionPnl * 10000;
    trade.unrealizedPnl = Math.abs(pipDifference) * trade.lots * 10;

    const hitStop = trade.direction === 'buy' ? currentPrice <= trade.stop : currentPrice >= trade.stop;
    const hitTarget = trade.direction === 'buy' ? currentPrice >= trade.takeProfit : currentPrice <= trade.takeProfit;

    if (hitStop || hitTarget) {
      trade.status = 'closed';
      trade.realizedPnl = hitStop ? -Math.abs(trade.unrealizedPnl) : Math.abs(trade.unrealizedPnl);
      state.balance += trade.realizedPnl;
      state.journal.unshift({
        pair: trade.pair,
        direction: trade.direction,
        lots: trade.lots,
        pnl: trade.realizedPnl
      });
    }
  });

  renderWatchlist();
  updateSummary();
  renderJournal();
}

async function fetchLiveMarketData() {
  if (!MARKET_PROXY_URL || MARKET_PROXY_URL.includes('your-worker')) {
    setMarketStatus(false, 'Using demo feed');
    return false;
  }

  try {
    const response = await fetch(MARKET_PROXY_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    const pairs = Object.keys(state.market);

    pairs.forEach((pair) => {
      if (!payload[pair]) return;

      const item = payload[pair];
      state.market[pair].price = Number(item.price);
      state.market[pair].delta = Number(item.delta || 0);
    });

    state.liveFeedActive = true;
    setMarketStatus(true, `Live feed • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    renderWatchlist();
    return true;
  } catch (error) {
    console.warn('Live market feed failed:', error);
    state.liveFeedActive = false;
    setMarketStatus(false, 'Using demo feed');
    return false;
  }
}

function updateMarket() {
  if (state.liveFeedActive) {
    renderWatchlist();
    return;
  }
  simulateMarketTick();
}

function bindTabs() {
  els.tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      els.tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
      els.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === target));
    });
  });
}

function handleInstallPrompt() {
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(() => {
      els.installBtn.classList.add('hidden');
    });
  });
}

function initDefaults() {
  document.getElementById('entry').value = usdPairMap['EUR/USD'];
  document.getElementById('stop').value = (Number(usdPairMap['EUR/USD']) - 0.005).toFixed(4);
  document.getElementById('takeProfit').value = (Number(usdPairMap['EUR/USD']) + 0.01).toFixed(4);
  document.getElementById('pair').addEventListener('change', (event) => {
    const selected = event.target.value;
    const baseValue = usdPairMap[selected] || 1.0850;
    document.getElementById('entry').value = baseValue;
    document.getElementById('stop').value = (Number(baseValue) - (selected.includes('JPY') ? 0.8 : 0.005)).toFixed(selected.includes('JPY') ? 2 : 4);
    document.getElementById('takeProfit').value = (Number(baseValue) + (selected.includes('JPY') ? 1.2 : 0.01)).toFixed(selected.includes('JPY') ? 2 : 4);
  });

  document.getElementById('calculateRisk').addEventListener('click', calculateRisk);
  document.getElementById('tradeForm').addEventListener('submit', openTrade);
  document.getElementById('riskForm').addEventListener('submit', (event) => {
    event.preventDefault();
    calculateRisk();
  });
}

renderLessons();
renderWatchlist();
renderJournal();
updateSummary();
calculateRisk();
bindTabs();
initDefaults();
handleInstallPrompt();
setMarketStatus(false, 'Using demo feed');
fetchLiveMarketData();
setInterval(() => {
  if (!state.liveFeedActive) {
    simulateMarketTick();
  } else {
    fetchLiveMarketData();
  }
}, 4200);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
