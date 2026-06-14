const STORAGE_KEY = 'bbfs7d.importedCsvData.v1';

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

  state.selectedMarket = markets[0];
  select.value = '0';
  select.onchange = () => {
    state.selectedMarket = markets[Number(select.value)] || markets[0];
    renderSelectedMarket();
    renderArchive();
  };
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

function splitValues(value) {
  return safeText(value, '')
    .split(/[|,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function digitsFromResult(result) {
  const source = safeText(result, '').replace(/\D/g, '').split('');
  const unique = [];
  source.forEach((digit) => {
    if (!unique.includes(digit)) unique.push(digit);
  });
  return unique.slice(0, 7);
}

function pairsFromResult(result) {
  const clean = safeText(result, '').replace(/\D/g, '');
  const pairs = [];
  for (let i = 0; i < clean.length - 1; i += 1) pairs.push(clean.slice(i, i + 2));
  return [...new Set(pairs)].slice(0, 5);
}

function triplesFromResult(result) {
  const clean = safeText(result, '').replace(/\D/g, '');
  const triples = [];
  for (let i = 0; i < clean.length - 2; i += 1) triples.push(clean.slice(i, i + 3));
  return [...new Set(triples)].slice(0, 5);
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  values.push(value.trim());
  return values;
}

function normalizeHeader(header) {
  return safeText(header, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function getCsvValue(row, names) {
  for (const name of names) {
    const key = normalizeHeader(name);
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return '';
}

function parseCsv(text) {
  const lines = safeText(text, '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error('CSV harus memiliki header dan minimal 1 baris data.');

  const delimiter = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header || `col_${index}`] = values[index] || '';
    });
    return row;
  });
}

function makeRanking(numbers) {
  return numbers.map((number, index) => ({
    number,
    note: index === 0 ? 'CSV top' : `CSV ${index + 1}`
  }));
}

function buildDataFromCsv(rows) {
  const normalized = rows.map((row, index) => {
    const result = getCsvValue(row, ['result', 'latest_result', 'result_7d', 'angka', 'nomor']);
    const bbfs = splitValues(getCsvValue(row, ['bbfs', 'bbfs_7d', 'bbfs7d'])) || [];
    const top2d = splitValues(getCsvValue(row, ['top_2d', 'ranking_2d', '2d_top', 'top2d']));
    const top3d = splitValues(getCsvValue(row, ['top_3d', 'ranking_3d', '3d_top', 'top3d']));

    return {
      name: getCsvValue(row, ['market', 'pasaran', 'name']) || 'IMPORT CSV',
      period: getCsvValue(row, ['period', 'periode', 'status']) || `#CSV-${index + 1}`,
      date: getCsvValue(row, ['date', 'tanggal', 'latest_date']) || new Date().toISOString().slice(0, 10),
      dateDisplay: getCsvValue(row, ['date_display', 'tanggal_display']) || '',
      result,
      bbfs: bbfs.length ? bbfs.slice(0, 7) : digitsFromResult(result),
      top2d: top2d.length ? top2d.slice(0, 5) : pairsFromResult(result),
      top3d: top3d.length ? top3d.slice(0, 5) : triplesFromResult(result)
    };
  }).filter((row) => row.result);

  if (!normalized.length) throw new Error('CSV tidak memiliki kolom result/latest_result/result_7d yang valid.');

  const latest = normalized[0];
  const nowText = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }).format(new Date()).replace('.', ':');

  return {
    site_name: 'BBFS 7D Shinobi Result Center',
    last_updated: `${nowText} WIB · Import CSV`,
    timezone: 'Asia/Jakarta',
    update_mode: 'import-csv-browser',
    markets: [{
      name: latest.name,
      status: latest.period,
      period: latest.period,
      draw_time: 'CSV',
      latest_date: latest.date,
      latest_date_display: latest.dateDisplay || formatDate(latest.date),
      latest_result: latest.result,
      description: `Data diimport dari CSV. Result utama: ${latest.result}`,
      bbfs_7d: latest.bbfs,
      bbfs_note: 'BBFS 7D sinkron dari CSV/import result.',
      ranking_2d: makeRanking(latest.top2d),
      ranking_3d: makeRanking(latest.top3d),
      history: normalized.map((row) => ({
        period: row.period,
        date: row.date,
        date_display: row.dateDisplay || formatDate(row.date),
        result: row.result,
        bbfs_7d: row.bbfs,
        top_2d: row.top2d,
        top_3d: row.top3d
      }))
    }]
  };
}

function applyData(nextData, statusText) {
  state.data = nextData;
  renderMarketOptions();
  renderSelectedMarket();
  renderArchive();
  setText('#lastUpdated', safeText(state.data?.last_updated, 'Data online'));
  setText('#csvImportStatus', statusText || 'Data aktif');
}

function setupCsvImport() {
  const button = $('#csvImportBtn');
  const input = $('#csvFileInput');
  const reset = $('#csvResetBtn');
  if (!button || !input) return;

  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      setText('#csvImportStatus', 'Membaca CSV...');
      const text = await file.text();
      const rows = parseCsv(text);
      const nextData = buildDataFromCsv(rows);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      applyData(nextData, `CSV aktif: ${file.name}`);
    } catch (error) {
      setText('#csvImportStatus', error.message || 'Gagal import CSV');
    } finally {
      input.value = '';
    }
  });

  if (reset) {
    reset.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }
}

function getStoredImport() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

async function boot() {
  setText('#year', new Date().getFullYear());
  setupCopyJson();
  setupCsvImport();

  try {
    const baseData = await loadData();
    const importedData = getStoredImport();
    applyData(importedData || baseData, importedData ? 'CSV lokal aktif' : 'CSV belum diimport');
  } catch (error) {
    setText('#lastUpdated', 'Error');
    setText('#marketMeta', 'Gagal memuat data. Cek file data/results.json.');
    setText('#latestResult', 'ERR');
    setText('#csvImportStatus', 'Gagal memuat data awal');
  }
}

boot();
