const state = {
  data: null,
  selectedMarket: null
};

const $ = (selector) => document.querySelector(selector);

function el(selector) {
  return document.querySelector(selector);
}

function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function setText(selector, value) {
  const node = el(selector);
  if (node) node.textContent = value;
}

function setHTML(selector, value) {
  const node = el(selector);
  if (node) node.innerHTML = value;
}

function setStatus(text, detail) {
  setText('#lastUpdated', detail || text || '-');
}

async function loadData() {
  const response = await fetch('data/results.json?t=' + Date.now(), {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`data/results.json HTTP ${response.status}`);
  }

  return response.json();
}

function getMarkets() {
  return Array.isArray(state.data?.markets) ? state.data.markets : [];
}

function getRankingNumbers(market, type, limit = 3) {
  const list = Array.isArray(market?.[type]) ? market[type] : [];
  return list.slice(0, limit).map((item) => safeText(item.number)).filter(Boolean);
}

function renderMarketOptions() {
  const markets = getMarkets();
  const select = el('#marketSelect');

  if (!select) return;

  if (!markets.length) {
    select.innerHTML = '<option>Belum ada pasaran</option>';
    return;
  }

  select.innerHTML = markets
    .map((market, index) => `<option value="${index}">${safeText(market.name)}</option>`)
    .join('');

  select.addEventListener('change', () => {
    state.selectedMarket = markets[Number(select.value)] || markets[0];
    renderSelectedMarket();
    renderArchive();
  });

  state.selectedMarket = markets[0];
}

function renderDigits(market) {
  const digits = Array.isArray(market?.bbfs_7d) ? market.bbfs_7d : [];
  setHTML('#bbfsDigits', digits.length
    ? digits.map((digit) => `<span class="digit">${safeText(digit)}</span>`).join('')
    : '<span class="muted">BBFS belum diisi.</span>');

  setText('#bbfsNote', safeText(
    market?.bbfs_note,
    'BBFS 7D adalah ruang kandidat digit berbasis input manual/statistik. Bukan kepastian result.'
  ));
}

function renderRankList(selector, list) {
  const rows = Array.isArray(list) ? list.slice(0, 5) : [];
  setHTML(selector, rows.length
    ? rows.map((item, index) => `
      <li>
        <span class="rank-no">${index + 1}</span>
        <strong>${safeText(item.number)}</strong>
        <small>${safeText(item.note, `${Math.max(985 - (index * 113), 410)}x`)}</small>
      </li>
    `).join('')
    : '<li><span class="rank-no">-</span><strong>-</strong><small>Belum ada data</small></li>');
}

function renderRankings(market) {
  renderRankList('#rank2d', market?.ranking_2d);
  renderRankList('#rank3d', market?.ranking_3d);
}

function renderSelectedMarket() {
  const market = state.selectedMarket;
  if (!market) return;

  setText('#marketTitle', safeText(market.name));
  setText('#marketMeta', `Update: ${formatDate(market.latest_date)} • Jam result: ${safeText(market.draw_time)}`);
  setText('#marketStatus', safeText(market.status, 'Aktif'));
  setText('#latestResult', safeText(market.latest_result, '----'));
  setText('#latestDetail', safeText(market.description, 'Terakhir diperbarui dari data JSON manual.'));

  renderDigits(market);
  renderRankings(market);
}

function miniDigits(digits) {
  const list = Array.isArray(digits) ? digits : [];
  if (!list.length) return '-';
  return `<span class="mini-digits">${list.map((digit) => `<span class="mini-digit">${safeText(digit)}</span>`).join('')}</span>`;
}

function renderArchive() {
  const markets = getMarkets();
  const selected = state.selectedMarket || markets[0];
  const sourceMarkets = selected ? [selected, ...markets.filter((market) => market !== selected)] : markets;

  const rows = sourceMarkets.flatMap((market, marketIndex) => {
    const history = Array.isArray(market.history) ? market.history : [];

    if (!history.length) {
      return [{
        period: `#${1287491 - marketIndex}`,
        date: market.latest_date,
        result: market.latest_result,
        bbfs: market.bbfs_7d,
        top2d: getRankingNumbers(market, 'ranking_2d'),
        top3d: getRankingNumbers(market, 'ranking_3d')
      }];
    }

    return history.map((item, index) => ({
      period: item.period || `#${1287491 - index}`,
      date: item.date,
      result: item.result,
      bbfs: item.bbfs_7d || market.bbfs_7d,
      top2d: item.top_2d || getRankingNumbers(market, 'ranking_2d'),
      top3d: item.top_3d || getRankingNumbers(market, 'ranking_3d')
    }));
  }).slice(0, 8);

  setHTML('#archiveTable', rows.map((row) => `
    <tr>
      <td>${safeText(row.period)}</td>
      <td>${formatDate(row.date)}</td>
      <td><strong>${safeText(row.result, '----')}</strong></td>
      <td>${miniDigits(row.bbfs)}</td>
      <td>${Array.isArray(row.top2d) ? row.top2d.join(', ') : '-'}</td>
      <td>${Array.isArray(row.top3d) ? row.top3d.join(', ') : '-'}</td>
    </tr>
  `).join(''));
}

function setupCopyJson() {
  const button = el('#copyJsonBtn');
  if (!button) return;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2));
      button.textContent = 'JSON Disalin';
      setTimeout(() => { button.textContent = 'Copy JSON'; }, 1600);
    } catch (error) {
      button.textContent = 'Gagal Copy';
      setTimeout(() => { button.textContent = 'Copy JSON'; }, 1600);
    }
  });
}

async function boot() {
  setText('#year', new Date().getFullYear());
  setupCopyJson();

  try {
    state.data = await loadData();
    setStatus('Online', safeText(state.data?.last_updated, 'Data online'));
    renderMarketOptions();
    renderSelectedMarket();
    renderArchive();
  } catch (error) {
    setStatus('Error', error.message);
    setText('#marketMeta', 'Gagal memuat data. Cek file data/results.json.');
    setText('#latestResult', 'ERR');
  }
}

boot();
