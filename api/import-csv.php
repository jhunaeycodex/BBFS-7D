<?php
require __DIR__ . '/db.php';

function normalize_header(string $header): string {
    $header = strtolower(trim($header));
    $header = preg_replace('/\s+/', '_', $header);
    return preg_replace('/[^a-z0-9_]/', '', $header);
}

function get_value(array $row, array $names): string {
    foreach ($names as $name) {
        $key = normalize_header($name);
        if (isset($row[$key]) && trim((string)$row[$key]) !== '') return trim((string)$row[$key]);
    }
    return '';
}

function detect_delimiter(string $header): string {
    return substr_count($header, ';') > substr_count($header, ',') ? ';' : ',';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Gunakan POST multipart dengan field csv_file.'], 405);
}

if (empty($_FILES['csv_file']) || !is_uploaded_file($_FILES['csv_file']['tmp_name'])) {
    json_response(['ok' => false, 'error' => 'File CSV belum dikirim.'], 400);
}

$file = $_FILES['csv_file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'error' => 'Upload CSV gagal. Kode: ' . $file['error']], 400);
}

$handle = fopen($file['tmp_name'], 'rb');
if (!$handle) {
    json_response(['ok' => false, 'error' => 'CSV tidak bisa dibaca.'], 400);
}

$firstLine = fgets($handle);
if ($firstLine === false) {
    json_response(['ok' => false, 'error' => 'CSV kosong.'], 400);
}
$firstLine = preg_replace('/^\xEF\xBB\xBF/', '', $firstLine);
$delimiter = detect_delimiter($firstLine);
$headers = array_map('normalize_header', str_getcsv($firstLine, $delimiter));

$pdo = db();
ensure_schema($pdo);
$batch = date('YmdHis') . '-' . bin2hex(random_bytes(4));
$importedAt = date('Y-m-d H:i:s');

$insert = $pdo->prepare("INSERT INTO results
    (import_batch, source_row, market_id, pasaran, tanggal, tanggal_text, periode, result_7d, bbfs_7d, top_2d, top_3d, raw_json, imported_at)
    VALUES
    (:import_batch, :source_row, :market_id, :pasaran, :tanggal, :tanggal_text, :periode, :result_7d, :bbfs_7d, :top_2d, :top_3d, :raw_json, :imported_at)");

$count = 0;
$skipped = 0;
$firstValid = null;
$pdo->beginTransaction();

try {
    while (($values = fgetcsv($handle, 0, $delimiter)) !== false) {
        if (count($values) === 1 && trim((string)$values[0]) === '') continue;
        $row = [];
        foreach ($headers as $index => $header) {
            $row[$header ?: 'col_' . $index] = $values[$index] ?? '';
        }

        $result = normalize_result(get_value($row, ['result', 'latest_result', 'result_7d', 'angka', 'nomor']));
        if ($result === '') {
            $skipped++;
            continue;
        }

        $pasaran = get_value($row, ['market', 'pasaran', 'name']) ?: 'IMPORT CSV';
        $tanggalText = get_value($row, ['date', 'tanggal', 'latest_date', 'datetime', 'waktu']);
        $timestamp = $tanggalText ? strtotime($tanggalText) : false;
        $tanggal = $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
        $periode = get_value($row, ['period', 'periode', 'status', 'draw']);
        $bbfs = get_value($row, ['bbfs', 'bbfs_7d', 'bbfs7d']);
        $top2d = get_value($row, ['top_2d', 'ranking_2d', '2d_top', 'top2d']);
        $top3d = get_value($row, ['top_3d', 'ranking_3d', '3d_top', 'top3d']);

        if ($bbfs === '') $bbfs = implode(' ', digits_from_result($result));
        if ($top2d === '') $top2d = implode(' ', pairs_from_result($result));
        if ($top3d === '') $top3d = implode(' ', triples_from_result($result));

        $payload = [
            ':import_batch' => $batch,
            ':source_row' => $count + $skipped + 1,
            ':market_id' => get_value($row, ['market_id', 'pasaran_id', 'id']),
            ':pasaran' => $pasaran,
            ':tanggal' => $tanggal,
            ':tanggal_text' => $tanggalText,
            ':periode' => $periode ?: '#' . ($count + 1),
            ':result_7d' => $result,
            ':bbfs_7d' => $bbfs,
            ':top_2d' => $top2d,
            ':top_3d' => $top3d,
            ':raw_json' => json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':imported_at' => $importedAt,
        ];
        $insert->execute($payload);
        $count++;
        if ($firstValid === null) $firstValid = $payload;
    }

    meta_set($pdo, 'latest_batch', $batch);
    meta_set($pdo, 'latest_imported_at', $importedAt);
    meta_set($pdo, 'latest_source_file', basename((string)$file['name']));
    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    json_response(['ok' => false, 'error' => $error->getMessage()], 500);
} finally {
    fclose($handle);
}

json_response([
    'ok' => true,
    'message' => 'CSV berhasil disimpan penuh ke MySQL.',
    'batch' => $batch,
    'inserted' => $count,
    'skipped' => $skipped,
    'file' => basename((string)$file['name'])
]);
