<?php
// test_sqlite.php

$dbFile = __DIR__ . '/test_data.db';

try {
    $db = new SQLite3($dbFile);
} catch (Exception $e) {
    echo "Error opening or creating SQLite file: " . $e->getMessage();
    exit;
}

// Create a simple table:
$createSQL = "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, message TEXT);";
if (!$db->exec($createSQL)) {
    echo "Failed to create table: " . $db->lastErrorMsg();
    exit;
}

// Insert a row:
$insertSQL = "INSERT INTO test (message) VALUES (:msg);";
$stmt = $db->prepare($insertSQL);
$stmt->bindValue(':msg', 'Hello from PHP + SQLite!', SQLITE3_TEXT);
if (!$stmt->execute()) {
    echo "Insert failed: " . $db->lastErrorMsg();
    exit;
}

echo "Success! Created or updated test_data.db in this directory.<br>";
echo "Now query it by visiting: test_data.db (if your host lists files), or download via FTP.";
$db->close();
?>
