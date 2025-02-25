<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Buffer output to prevent headers already sent errors
ob_start();

require_once 'lib/Config.php';
require_once 'lib/Database.php';
require_once 'lib/Paste.php';

// Determine if this is a JSON or form submission
$isJson = isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false;

// Log the request method and content type for debugging
error_log('Request method: ' . $_SERVER['REQUEST_METHOD']);
error_log('Content type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'Not set'));

if ($isJson) {
    // Get JSON data from request
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    error_log('JSON data: ' . $json);
} else {
    // Get form data
    $data = $_POST;
    error_log('POST data: ' . print_r($data, true));
}

// Check if this is an AJAX request
$isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest';

// Check if data is valid
if (!$data || !isset($data['data']) || empty($data['data'])) {
    if ($isAjax || $isJson) {
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid or missing data'
        ]);
    } else {
        // Redirect back to the form with an error
        header('Location: index.php?error=empty');
    }
    ob_end_flush();
    exit;
}

// Create new paste
try {
    $paste = new Paste();
    
    // Set paste data
    $pasteData = [
        'data' => $data['data'],
        'format' => $data['format'] ?? 'plaintext',
        'expiration' => isset($data['expiration']) ? (int)$data['expiration'] : Config::DEFAULT_EXPIRATION,
        'burnafterreading' => isset($data['burnAfterReading']) ? (int)$data['burnAfterReading'] : 0,
        'encrypted' => 0 // Always set to unencrypted
    ];
    
    error_log('Paste data: ' . print_r($pasteData, true));
    
    // Create paste and get ID
    $id = $paste->create($pasteData);
    
    error_log('Created paste with ID: ' . $id);
    
    if ($isAjax || $isJson) {
        // Return JSON response
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'success',
            'id' => $id
        ]);
    } else {
        // Redirect to the view page
        header('Location: view.php?id=' . $id);
    }
} catch (Exception $e) {
    error_log('Error creating paste: ' . $e->getMessage());
    
    if ($isAjax || $isJson) {
        // Return JSON error
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'message' => $e->getMessage()
        ]);
    } else {
        // Redirect back to the form with an error
        header('Location: index.php?error=server&message=' . urlencode($e->getMessage()));
    }
}

// Flush the output buffer and end the script
ob_end_flush();
exit;
?> 