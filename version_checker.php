<?php
// Only run this check occasionally to avoid performance impact
if (rand(1, 10) === 1) { // 10% chance of running on any page load
    // Get the last modification time of view.php
    $viewLastModified = filemtime('view.php');
    
    // Get the current version from Config.php
    require_once 'lib/Config.php';
    $currentVersion = Config::VERSION;
    
    // Parse the current version date
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})-(\d{4})$/', $currentVersion, $matches)) {
        $versionTimestamp = mktime(
            substr($matches[4], 0, 2), // Hours
            substr($matches[4], 2, 2), // Minutes
            0, // Seconds
            $matches[2], // Month
            $matches[3], // Day
            $matches[1] // Year
        );
        
        // If view.php was modified after the current version timestamp
        if ($viewLastModified > $versionTimestamp) {
            // Format the new version
            $newVersion = date('Y-m-d-Hi', $viewLastModified);
            
            // Read the Config.php file
            $configFile = file_get_contents('lib/Config.php');
            
            // Replace the VERSION constant
            $pattern = "/const VERSION = '(.*)';/";
            $replacement = "const VERSION = '$newVersion';";
            $configFile = preg_replace($pattern, $replacement, $configFile);
            
            // Write the updated Config.php file
            file_put_contents('lib/Config.php', $configFile);
        }
    }
} 