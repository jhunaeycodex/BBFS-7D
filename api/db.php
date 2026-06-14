<?php
function json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function db_config(): array {
    $local = __DIR__ . '/config.local.php';
    if (is_file($local)) {
        $config = require $local;
        if (is_array($config)) return $config;
    }

    return [
        'host' => getenv('BBFS_DB_HOST') ?: '127.0.0.1',
        'port' => getenv('BBFS_DB_PORT') ?: '3306',
        'database' => getenv('BBFS_DB_NAME') ?: 'bbfs7d',
        'username' => getenv('BBFS_DB_USER') ?: 'bbfs7d_user',
        'password' => getenv('BBFS_DB_PASS') ?: '',
        'charset' => 'utf8mb4',
    ];
}

function db(): PDO {
    $config = db_config();
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $config['host'],
        $config['port'],
        $config['database'],
        $config['charset'] ?? 'utf8mb4'
    );

    return new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function ensure_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS results (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        import_batch VARCHAR(64) NOT NULL,
        source_row INT UNSIGNED NOT NULL,
        market_id VARCHAR(128) NULL,
        pasaran VARCHAR(190) NOT NULL,
        tanggal DATETIME NULL,
        tanggal_text VARCHAR(190) NULL,
        periode VARCHAR(190) NULL,
        result_7d VARCHAR(32) NOT NULL,
        bbfs_7d VARCHAR(64) NULL,
        top_2d VARCHAR(128) NULL,
        top_3d VARCHAR(128) NULL,
        raw_json JSON NULL,
        imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pasaran_tanggal (pasaran, tanggal, id),
        INDEX idx_batch (import_batch),
        INDEX idx_result_7d (result_7d)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS import_meta (
        meta_key VARCHAR(120) NOT NULL PRIMARY KEY,
        meta_value TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function meta_set(PDO $pdo, string $key, string $value): void {
    $stmt = $pdo->prepare('INSERT INTO import_meta(meta_key, meta_value) VALUES(:meta_key, :meta_value) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)');
    $stmt->execute([':meta_key' => $key, ':meta_value' => $value]);
}

function meta_get(PDO $pdo, string $key, string $fallback = ''): string {
    $stmt = $pdo->prepare('SELECT meta_value FROM import_meta WHERE meta_key = :meta_key LIMIT 1');
    $stmt->execute([':meta_key' => $key]);
    $value = $stmt->fetchColumn();
    return $value === false ? $fallback : (string)$value;
}

function normalize_result(string $value): string {
    return preg_replace('/\D+/', '', $value) ?: trim($value);
}

function split_values(?string $value, int $limit): array {
    $parts = preg_split('/[|,\s]+/', trim((string)$value));
    $parts = array_values(array_filter(array_map('trim', $parts), fn($item) => $item !== ''));
    return array_slice($parts, 0, $limit);
}

function digits_from_result(string $result): array {
    $digits = str_split(preg_replace('/\D+/', '', $result));
    $unique = [];
    foreach ($digits as $digit) {
        if (!in_array($digit, $unique, true)) $unique[] = $digit;
    }
    return array_slice($unique, 0, 7);
}

function pairs_from_result(string $result): array {
    $clean = preg_replace('/\D+/', '', $result);
    $pairs = [];
    for ($i = 0; $i < strlen($clean) - 1; $i++) $pairs[] = substr($clean, $i, 2);
    return array_slice(array_values(array_unique($pairs)), 0, 5);
}

function triples_from_result(string $result): array {
    $clean = preg_replace('/\D+/', '', $result);
    $triples = [];
    for ($i = 0; $i < strlen($clean) - 2; $i++) $triples[] = substr($clean, $i, 3);
    return array_slice(array_values(array_unique($triples)), 0, 5);
}
