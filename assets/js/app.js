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
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function setStatus(text, detail) {
  $('#globalStatus').textContent = text;
  $('#lastUpdated').textContent = detail || '-';
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

function renderMarketOptions() {
  const markets = getMarkets();
  const select = $('#marketSelect');

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
  });

  state.selectedMarket = markets[0];
}

function renderSummary() {
  const markets = getMarkets();
  const validResults = markets.filter((market) => market.latest_result).length;
  const activeBbfs = markets.filter((market) => Array.isArray(market.bbfs_7d) && market.bbfs_7d.length).length;

  $('#summaryCards').innerHTML = [
    { title: 'Total Pasaran', value: markets.length },
    { title: 'Result Terisi', value: validResults },
    { title: 'BBFS Aktif', value: activeBbfs },
    { title: 'Mode Update', value: safeText(state.data?.update_mode, 'manual') }
  ].map((item) => `
    <article class="card">
      <strong>${item.title}</strong>
      <span>${item.value}</span>
    </article>
  `).join('');
}

function renderDigits(market) {
  const digits = Array.isArray(market.bbfs_7d) ? market.bbfs_7d : [];
  $('#bbfsDigits').innerHTML = digits.length
    ? digits.map((digit) => `<span class="digit">${safeText(digit)}</span>`).join('')
    : '<span class="muted">BBFS belum diisi.</span>';

  $('#bbfsNote').textContent = safeText(
    market.bbfs_note,
    'BBFS 7D adalah ruang kandidat digit berbasis input manual/statistik. Bukan kepastian result.'
  );
}

function renderRankings(market) {
  const rank2d = Array.isArray(market.ranking_2d) ? market.ranking_2d : [];
  const rank3d = Array.isArray(market.ranking_3d) ? market.ranking_3d : [];

  $('#rank2d').innerHTML = rank2d.length
    ? rank2d.map((item) => `<li><strong>${safeText(item.number)}</strong><br><small>${safeText(item.note)}</small></li>`).join('')
    : '<li>Belum ada ranking 2D.</li>';

  $('#rank3d').innerHTML = rank3d.length
    ? rank3d.map((item) => `<li><strong>${safeText(item.number)}</strong><br><small>${safeText(item.note)}</small></li>`).join('')
    : '<li>Belum ada ranking 3D.</li>';
}

function renderSelectedMarket() {
  const market = state.selectedMarket;
  if (!market) return;

  $('#marketTitle').textContent = safeText(market.name);
  $('#marketMeta').textContent = `Update: ${formatDate(market.latest_date)} • Jam result: ${safeText(market.draw_time)}`;
  $('#marketStatus').textContent = safeText(market.status, 'Aktif');
  $('#latestResult').textContent = safeText(market.latest_result, '----');
  $('#latestDetail').textContent = safeText(market.description, 'Belum ada keterangan.' );

  renderDigits(market);
  renderRankings(market);
}

function renderArchive() {
  const markets = getMarkets();
  const rows = markets.flatMap((market) => {
    const history = Array.isArray(market.history) ? market.history : [];
    if (!history.length) {
      return [{
        date: market.latest_date,
        market: market.name,
        result: market.latest_result,
        bbfs: market.bbfs_7d,
        status: market.status
      }];
    }

    return history.map((item) => ({
      date: item.date,
      market: market.name,
      result: item.result,
      bbfs: item.bbfs_7d || market.bbfs_7d,
      status: item.status || market.status
    }));
  });

  $('#archiveTable').innerHTML = rows.map((row) => `
    <tr>
      <td>${formatDate(row.date)}</td>
      <td>${safeText(row.market)}</td>
      <td><strong>${safeText(row.result, '----')}</strong></td>
      <td>${Array.isArray(row.bbfs) ? row.bbfs.join(' ') : '-'}</td>
      <td>${safeText(row.status, 'Aktif')}</td>
    </tr>
  `).join('');
}

function setupCopyJson() {
  $('#copyJsonBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2));
      $('#copyJsonBtn').textContent = 'JSON Disalin';
      setTimeout(() => { $('#copyJsonBtn').textContent = 'Copy JSON'; }, 1600);
    } catch (error) {
      $('#copyJsonBtn').textContent = 'Gagal Copy';
      setTimeout(() => { $('#copyJsonBtn').textContent = 'Copy JSON'; }, 1600);
    }
  });
}

async function boot() {
  $('#year').textContent = new Date().getFullYear();
  setupCopyJson();

  try {
    state.data = await loadData();
    setStatus('Online', `Terakhir update: ${safeText(state.data?.last_updated)}`);
    renderMarketOptions();
    renderSummary();
    renderSelectedMarket();
    renderArchive();
  } catch (error) {
    setStatus('Error', error.message);
    $('#marketMeta').textContent = 'Gagal memuat data. Cek file data/results.json.';
    $('#latestResult').textContent = 'ERR';
  }
}

boot();
