<?php
// Get the last modification time of view.php
$viewLastModified = filemtime('view.php');

// Format the date/time
$newVersion = date('Y-m-d-Hi', $viewLastModified);

// Read the Config.php file
$configFile = file_get_contents('lib/Config.php');

// Replace the VERSION constant
$pattern = "/const VERSION = '(.*)';/";
$replacement = "const VERSION = '$newVersion';";
$configFile = preg_replace($pattern, $replacement, $configFile);

// Write the updated Config.php file
file_put_contents('lib/Config.php', $configFile);

echo "Version updated to: $newVersion\n"; 