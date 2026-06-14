const state = {
  data: null,
  selectedMarket: null
};

const $ = (selector) => document.querySelector(selector);

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
  const node = $(selector);
  if (node) node.textContent = value;
}

function setHTML(selector, value) {
  const node = $(selector);
  if (node) node.innerHTML = value;
}

async function loadData() {
  const response = await fetch('data/results.json?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error(`data/results.json HTTP ${response.status}`);
  return response.json();
}

function getMarkets() {
  return Array.isArray(state.data?.markets) ? state.data.markets : [];
}

function getTopNumbers(market, key, limit = 3) {
  const list = Array.isArray(market?.[key]) ? market[key] : [];
  return list.slice(0, limit).map((item) => safeText(item.number)).filter(Boolean);
}

function renderMarketOptions() {
  const markets = getMarkets();
  const select = $('#marketSelect');
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
    : '<span class="bbfs-note">BBFS belum diisi.</span>');

  setText('#bbfsNote', safeText(
    market?.bbfs_note,
    'BBFS 7D adalah ruang kandidat digit berbasis input manual/statistik.'
  ));
}

function renderRankList(selector, list) {
  const rows = Array.isArray(list) ? list.slice(0, 5) : [];
  setHTML(selector, rows.length
    ? rows.map((item, index) => `
      <li>
        <span class="rank-no">${index + 1}</span>
        <strong>${safeText(item.number)}</strong>
        <small>${safeText(item.note)}</small>
      </li>
    `).join('')
    : '<li><span class="rank-no">-</span><strong>-</strong><small>Belum ada data</small></li>');
}

function renderSelectedMarket() {
  const market = state.selectedMarket;
  if (!market) return;

  const displayDate = safeText(market.latest_date_display, formatDate(market.latest_date));
  const displayPeriod = safeText(market.period || market.status, '-');

  setText('#marketTitle', safeText(market.name));
  setText('#marketMeta', `Terakhir diperbarui: ${safeText(state.data?.last_updated, displayDate)}`);
  setText('#marketStatus', displayPeriod);
  setText('#marketDate', displayDate);
  setText('#marketPeriod', displayPeriod);
  setText('#latestResult', safeText(market.latest_result, '----'));
  setText('#latestDetail', safeText(market.description, 'Terakhir diperbarui dari data JSON manual.'));

  renderDigits(market);
  renderRankList('#rank2d', market.ranking_2d);
  renderRankList('#rank3d', market.ranking_3d);
}

function miniDigits(digits) {
  const list = Array.isArray(digits) ? digits : [];
  if (!list.length) return '-';
  return `<span class="mini-digits">${list.map((digit) => `<span class="mini-digit">${safeText(digit)}</span>`).join('')}</span>`;
}

function renderArchive() {
  const markets = getMarkets();
  const selected = state.selectedMarket || markets[0];
  const ordered = selected ? [selected, ...markets.filter((market) => market !== selected)] : markets;

  const rows = ordered.flatMap((market, marketIndex) => {
    const history = Array.isArray(market.history) ? market.history : [];

    if (!history.length) {
      return [{
        period: market.period || `#${1287491 - marketIndex}`,
        dateDisplay: safeText(market.latest_date_display, formatDate(market.latest_date)),
        result: market.latest_result,
        bbfs: market.bbfs_7d,
        top2d: getTopNumbers(market, 'ranking_2d'),
        top3d: getTopNumbers(market, 'ranking_3d')
      }];
    }

    return history.map((item, index) => ({
      period: item.period || `#${1287491 - index}`,
      dateDisplay: item.date_display || formatDate(item.date),
      result: item.result,
      bbfs: item.bbfs_7d || market.bbfs_7d,
      top2d: item.top_2d || getTopNumbers(market, 'ranking_2d'),
      top3d: item.top_3d || getTopNumbers(market, 'ranking_3d')
    }));
  }).slice(0, 8);

  setHTML('#archiveTable', rows.map((row) => `
    <tr>
      <td>${safeText(row.period)}</td>
      <td>${safeText(row.dateDisplay)}</td>
      <td><strong>${safeText(row.result, '----')}</strong></td>
      <td>${miniDigits(row.bbfs)}</td>
      <td>${Array.isArray(row.top2d) ? row.top2d.join(', ') : '-'}</td>
      <td>${Array.isArray(row.top3d) ? row.top3d.join(', ') : '-'}</td>
      <td><span class="row-arrow">›</span></td>
    </tr>
  `).join(''));
}

function setupCopyJson() {
  const button = $('#copyJsonBtn');
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
    setText('#lastUpdated', safeText(state.data?.last_updated, 'Data online'));
    renderMarketOptions();
    renderSelectedMarket();
    renderArchive();
  } catch (error) {
    setText('#lastUpdated', 'Error');
    setText('#marketMeta', 'Gagal memuat data. Cek file data/results.json.');
    setText('#latestResult', 'ERR');
  }
}

boot();
