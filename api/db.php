<?php
function json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function data_dir(): string {
    $dir = dirname(__DIR__) . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    return $dir;
}

function db(): PDO {
    $path = data_dir() . '/results.sqlite';
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec("CREATE TABLE IF NOT EXISTS results (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT,
        market_id TEXT,
        pasaran TEXT NOT NULL,
        tanggal TEXT NOT NULL,
        result TEXT NOT NULL,
        three_d TEXT,
        two_d TEXT,
        created_at TEXT,
        updated_at TEXT,
        imported_at TEXT NOT NULL
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_results_pasaran_tanggal ON results(pasaran, tanggal DESC, row_id DESC)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_results_two_d ON results(two_d)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_results_three_d ON results(three_d)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS import_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )");
    return $pdo;
}

function meta_set(PDO $pdo, string $key, string $value): void {
    $stmt = $pdo->prepare('INSERT INTO import_meta(key, value) VALUES(:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    $stmt->execute([':key' => $key, ':value' => $value]);
}

function meta_get(PDO $pdo, string $key, string $fallback = ''): string {
    $stmt = $pdo->prepare('SELECT value FROM import_meta WHERE key = :key');
    $stmt->execute([':key' => $key]);
    $value = $stmt->fetchColumn();
    return $value === false ? $fallback : (string)$value;
}
