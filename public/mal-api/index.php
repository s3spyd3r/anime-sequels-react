<?php
/**
 * Same-origin proxy for the MyAnimeList API.
 *
 * api.myanimelist.net sends no CORS headers, so the deployed SPA calls
 * /mal-api/... on its own origin; this script forwards the request to the
 * official API and relays the response. The X-MAL-CLIENT-ID header from the
 * browser is forwarded unchanged — no credentials live on the server.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: content-type, x-mal-client-id, accept');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET, OPTIONS');
    exit;
}

$uri = $_SERVER['REQUEST_URI'];
$pos = strpos($uri, '/mal-api');
$path = $pos === false ? $uri : substr($uri, $pos + strlen('/mal-api'));
if ($path === '' || $path[0] !== '/') {
    $path = '/' . $path;
}
$target = 'https://api.myanimelist.net' . $path;

$headers = ['Accept: application/json'];
$clientId = $_SERVER['HTTP_X_MAL_CLIENT_ID'] ?? '';
if ($clientId !== '') {
    $headers[] = 'X-MAL-CLIENT-ID: ' . $clientId;
}

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => $headers,
]);
$body = curl_exec($ch);
$errno = curl_errno($ch);
$error = curl_error($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/json';
curl_close($ch);

if ($body === false || $status === 0) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'proxy_failure', 'message' => $error ?: 'upstream unreachable']);
    exit;
}

http_response_code($status);
header('Content-Type: ' . $contentType);
echo $body;
