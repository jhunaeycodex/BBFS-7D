<?php
require __DIR__ . '/db.php';

function make_rank(array $numbers): array {
    return array_values(array_map(function ($number, $index) {
        return ['number' => (string)$number, 'note' => $index === 0 ? 'DB top' : 'DB ' . ($index + 1)];
    }, $numbers, array_keys($numbers)));
}

try {
    $pdo = db();
    ensure_schema($pdo);

    $batch = meta_get($pdo, 'latest_batch', '');
    $sourceFile = meta_get($pdo, 'latest_source_file', 'MySQL');
    $importedAt = meta_get($pdo, 'latest_imported_at', date('Y-m-d H:i:s'));

    if ($batch !== '') {
        $latestStmt = $pdo->prepare('SELECT * FROM results WHERE import_batch = :batch ORDER BY COALESCE(tanggal, imported_at) DESC, id DESC LIMIT 1');
        $latestStmt->execute([':batch' => $batch]);
    } else {
        $latestStmt = $pdo->query('SELECT * FROM results ORDER BY COALESCE(tanggal, imported_at) DESC, id DESC LIMIT 1');
    }

    $latest = $latestStmt->fetch();
    if (!$latest) {
        json_response(['ok' => false, 'error' => 'Database belum memiliki data result. Import CSV dulu.'], 404);
    }

    $historyStmt = $pdo->prepare('SELECT * FROM results WHERE import_batch = :batch AND pasaran = :pasaran ORDER BY COALESCE(tanggal, imported_at) DESC, id DESC LIMIT 50');
    $historyStmt->execute([':batch' => $latest['import_batch'], ':pasaran' => $latest['pasaran']]);
    $historyRows = $historyStmt->fetchAll();

    $bbfs = split_values($latest['bbfs_7d'] ?? '', 7);
    if (!$bbfs) $bbfs = digits_from_result($latest['result_7d']);
    $top2d = split_values($latest['top_2d'] ?? '', 5);
    if (!$top2d) $top2d = pairs_from_result($latest['result_7d']);
    $top3d = split_values($latest['top_3d'] ?? '', 5);
    if (!$top3d) $top3d = triples_from_result($latest['result_7d']);

    $history = array_map(function ($row) {
        $bbfs = split_values($row['bbfs_7d'] ?? '', 7);
        if (!$bbfs) $bbfs = digits_from_result($row['result_7d']);
        $top2d = split_values($row['top_2d'] ?? '', 5);
        if (!$top2d) $top2d = pairs_from_result($row['result_7d']);
        $top3d = split_values($row['top_3d'] ?? '', 5);
        if (!$top3d) $top3d = triples_from_result($row['result_7d']);

        return [
            'period' => $row['periode'] ?: '#' . $row['id'],
            'date' => $row['tanggal'] ? substr($row['tanggal'], 0, 10) : '',
            'date_display' => $row['tanggal_text'] ?: ($row['tanggal'] ?: '-'),
            'result' => $row['result_7d'],
            'bbfs_7d' => $bbfs,
            'top_2d' => $top2d,
            'top_3d' => $top3d,
        ];
    }, $historyRows);

    json_response([
        'site_name' => 'BBFS 7D Shinobi Result Center',
        'last_updated' => $importedAt . ' WIB · MySQL · ' . $sourceFile,
        'timezone' => 'Asia/Jakarta',
        'update_mode' => 'mysql',
        'markets' => [[
            'name' => $latest['pasaran'],
            'status' => $latest['periode'] ?: '#' . $latest['id'],
            'period' => $latest['periode'] ?: '#' . $latest['id'],
            'draw_time' => 'MySQL',
            'latest_date' => $latest['tanggal'] ? substr($latest['tanggal'], 0, 10) : '',
            'latest_date_display' => $latest['tanggal_text'] ?: ($latest['tanggal'] ?: '-'),
            'latest_result' => $latest['result_7d'],
            'description' => 'Data result sinkron dari database MySQL.',
            'bbfs_7d' => $bbfs,
            'bbfs_note' => 'BBFS 7D sinkron dari database MySQL.',
            'ranking_2d' => make_rank($top2d),
            'ranking_3d' => make_rank($top3d),
            'history' => $history,
        ]]
    ]);
} catch (Throwable $error) {
    json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
