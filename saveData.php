<?php
// 0) Hard-coded users — replace with your own list or load from secure storage
$validUsers = [
  'nrl' => '12',
  // …etc…
];

// Read POST & decode as you already do
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

// 0a) Reject missing creds
if (empty($data['user']) || empty($data['pass'])) {
    header('Content-Type: application/json');
    echo json_encode(['success'=>false,'error'=>'Invalid credentials']);
    exit;
}

// 0b) Validate
$u = $data['user'];
$p = $data['pass'];
if (! array_key_exists($u, $validUsers) || $validUsers[$u] !== $p) {
    header('Content-Type: application/json');
    echo json_encode(['success'=>false,'error'=>'Invalid credentials']);
    exit;
}

// 1) Return JSON to the client
header('Content-Type: application/json');

// 2) Read raw POST body
$raw = file_get_contents('php://input');
if (!$raw) {
    echo json_encode(['success' => false, 'error' => 'No input received']);
    exit;
}

// 3) Decode JSON
$data = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

// 4) Extract fields (JS sends these keys)
$strip        = $data['strip']       ?? '';
$image        = $data['image']       ?? '';
$chosenClass  = strtolower(trim($data['class'] ?? '')); // force lowercase+trim
$extraInfo    = $data['info']        ?? '';
$markerX_raw  = $data['marker_x']    ?? '';
$markerY_raw  = $data['marker_y']    ?? '';
$rectX_raw    = $data['rect_x']      ?? '';
$rectY_raw    = $data['rect_y']      ?? '';
$rectW_raw    = $data['rect_w']      ?? '';
$rectH_raw    = $data['rect_h']      ?? '';

// 5) Sanitize the “info” text (remove newlines/tabs)
$safeInfo = str_replace(["\r", "\n", "\t"], [' ', ' ', ' '], $extraInfo);

// 6) Map class string → integer code
//    unknown → 0, shelters → 1, objects → 2, persons → 3
switch ($chosenClass) {
    case 'shelters':
        $classCode = 1;
        break;
    case 'objects':
        $classCode = 2;
        break;
    case 'persons':
        $classCode = 3;
        break;
    default:
        // anything else (including 'unknown' or blank) → 0
        $classCode = 0;
        break;
}

// 7) Compute “marker data” (always must exist)
if ($markerX_raw !== '' && $markerY_raw !== '') {
    // If user explicitly clicked a marker, use that
    $markerX = intval($markerX_raw);
    $markerY = intval($markerY_raw);
} else {
    // Otherwise compute the center of the rectangle
    $rx = intval($rectX_raw);
    $ry = intval($rectY_raw);
    $rw = intval($rectW_raw);
    $rh = intval($rectH_raw);
    $markerX = intval(round($rx + $rw / 2.0));
    $markerY = intval(round($ry + $rh / 2.0));
}

// 8) Helper: zero-pad an integer to exactly 4 digits
function pad4(int $n): string {
    return str_pad((string)$n, 4, '0', STR_PAD_LEFT);
}

// 9) Prepare the data file path
$dataFile = __DIR__ . '/data.txt';

// (Optional header row — commented out)
// $headerFields = [
//     'Strip No','Image No','Marker X','Marker Y',
//     'ClassCode','Comment','Dummy','Rect Strip','Rect Img',
//     'Rect X','Rect Y0','Height','Width'
// ];
// if (!file_exists($dataFile) || filesize($dataFile) === 0) {
//     $headerLine = implode("\t", $headerFields) . "\n";
//     @file_put_contents($dataFile, $headerLine, FILE_APPEND | LOCK_EX);
// }

// 10) Build one row of data
$rowFields = [];

// (1) strip, (2) image, (3) markerX (padded), (4) markerY (padded)
$rowFields[] = $strip;
$rowFields[] = $image;
$rowFields[] = pad4($markerX);
$rowFields[] = pad4($markerY);

// (5) classCode, (6) comment
$rowFields[] = $classCode;
$rowFields[] = '"' . str_replace('"', '\"', $safeInfo) . '"';

// (7)–(12) Rectangle fields (either real values or NA)
if ($rectX_raw !== '' && $rectY_raw !== '' && $rectW_raw !== '' && $rectH_raw !== '') {
    $rx = intval($rectX_raw);
    $ry = intval($rectY_raw);
    $rw = intval($rectW_raw);
    $rh = intval($rectH_raw);
    $y0 = $ry + $rh;  // lower-left Y

    $rowFields[] = $strip;            // Rect Strip
    $rowFields[] = $image;            // Rect Img
    $rowFields[] = pad4($rx);         // Rect X
    $rowFields[] = pad4($y0);         // Rect Y0
    $rowFields[] = pad4($rh);         // Height
    $rowFields[] = pad4($rw);         // Width
} else {
    // No rectangle: fill each with NA
    for ($i = 0; $i < 6; $i++) {
        $rowFields[] = 'NA';
    }
}

// (13) Add a dummy field (always NA)
$rowFields[] = 'NA'; // Dummy field

// 11) Combine into a single line (space-separated) and append to data.txt
$dataLine = implode(" ", $rowFields) . "\n";
$result = @file_put_contents($dataFile, $dataLine, FILE_APPEND | LOCK_EX);

if ($result === false) {
    echo json_encode(['success' => false, 'error' => 'Failed to write to data.txt']);
    exit;
}

// 12) Return success
echo json_encode(['success' => true]);
exit;
?>
