<?php
/**
 * Maintenance Script for HackGuard PrivateBin
 * 
 * This script provides maintenance functions for the pastebin database:
 * - Clear expired pastes
 * - Clear all pastes
 * - Clear pastes older than a specified date
 * 
 * Usage from command line:
 * php maintenance.php [option]
 * 
 * Options:
 *   --clear-expired       Clear all expired pastes
 *   --clear-all           Clear all pastes (use with caution!)
 *   --clear-older-than=X  Clear pastes older than X days
 *   --help                Display this help message
 * 
 * Usage from browser:
 * maintenance.php?action=X&password=YOUR_ADMIN_PASSWORD
 */

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Load required files
require_once 'lib/Config.php';
require_once 'lib/Database.php';
require_once 'lib/Paste.php';

// Admin password for web access - CHANGE THIS TO A SECURE PASSWORD!
define('ADMIN_PASSWORD', 'tvcnet');

// Determine if script is running from CLI or browser
$isCli = (php_sapi_name() === 'cli');

// If running from CLI, redirect to web interface
if ($isCli) {
    echo "Please access this tool through a web browser.\n";
    exit(1);
}

// Function to display help
function displayHelp() {
    global $isCli;
    
    $output = "Maintenance Script for " . Config::SITE_NAME . "\n";
    $output .= "Version: " . Config::VERSION . "\n\n";
    
    if ($isCli) {
        $output .= "Usage: php maintenance.php [option]\n\n";
        $output .= "Options:\n";
        $output .= "  --clear-expired       Clear all expired pastes\n";
        $output .= "  --clear-all           Clear all pastes (use with caution!)\n";
        $output .= "  --clear-older-than=X  Clear pastes older than X days\n";
        $output .= "  --help                Display this help message\n";
    } else {
        $output .= "Usage: maintenance.php?action=X&password=YOUR_ADMIN_PASSWORD\n\n";
        $output .= "Actions:\n";
        $output .= "  clear-expired       Clear all expired pastes\n";
        $output .= "  clear-all           Clear all pastes (use with caution!)\n";
        $output .= "  clear-older-than    Clear pastes older than X days (use with days parameter)\n";
        $output .= "  help                Display this help message\n\n";
        $output .= "Parameters:\n";
        $output .= "  password            Admin password for authentication\n";
        $output .= "  days                Number of days for clear-older-than action\n";
    }
    
    if ($isCli) {
        echo $output;
    } else {
        echo nl2br(htmlspecialchars($output));
    }
}

// Function to clear expired pastes
function clearExpiredPastes() {
    $paste = new Paste();
    $count = $paste->deleteExpired();
    return $count;
}

// Function to clear all pastes
function clearAllPastes() {
    $paste = new Paste();
    $count = $paste->deleteAll();
    return $count;
}

// Function to clear pastes older than X days
function clearOlderThan($days) {
    if (!is_numeric($days) || $days <= 0) {
        return ['error' => true, 'message' => 'Please provide a valid number of days.'];
    }
    
    $timestamp = time() - ($days * 86400); // Convert days to seconds
    $paste = new Paste();
    $count = $paste->deleteOlderThan($timestamp);
    return ['error' => false, 'count' => $count, 'days' => $days];
}

// Process form submission
$message = '';
$messageType = '';
$authenticated = false;

// Check if password is provided and correct
if (isset($_POST['password'])) {
    if ($_POST['password'] === ADMIN_PASSWORD) {
        $authenticated = true;
        
        // Process actions if authenticated
        if (isset($_POST['action'])) {
            switch($_POST['action']) {
                case 'clear-expired':
                    $count = clearExpiredPastes();
                    $message = "Successfully cleared {$count} expired pastes.";
                    $messageType = 'success';
                    break;
                    
                case 'clear-all':
                    $count = clearAllPastes();
                    $message = "Successfully cleared {$count} pastes from the database.";
                    $messageType = 'success';
                    break;
                    
                case 'clear-older-than':
                    $days = isset($_POST['days']) ? (int)$_POST['days'] : 0;
                    $result = clearOlderThan($days);
                    
                    if ($result['error']) {
                        $message = $result['message'];
                        $messageType = 'danger';
                    } else {
                        $message = "Successfully cleared {$result['count']} pastes older than {$result['days']} days.";
                        $messageType = 'success';
                    }
                    break;
            }
        }
    } else {
        $message = "Invalid password. Please try again.";
        $messageType = 'danger';
    }
}

// Get database statistics
function getDatabaseStats() {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    
    $stats = [
        'total' => 0,
        'expired' => 0,
        'burn_after_reading' => 0,
        'oldest' => null,
        'newest' => null
    ];
    
    // Total pastes
    $stmt = $conn->query("SELECT COUNT(*) FROM pastes");
    $stats['total'] = $stmt->fetchColumn();
    
    // Expired pastes
    $stmt = $conn->prepare("SELECT COUNT(*) FROM pastes WHERE expires > 0 AND expires <= ?");
    $stmt->execute([time()]);
    $stats['expired'] = $stmt->fetchColumn();
    
    // Burn after reading
    $stmt = $conn->query("SELECT COUNT(*) FROM pastes WHERE burnafterreading = 1");
    $stats['burn_after_reading'] = $stmt->fetchColumn();
    
    // Oldest paste
    if ($stats['total'] > 0) {
        $stmt = $conn->query("SELECT MIN(created) FROM pastes");
        $oldest = $stmt->fetchColumn();
        $stats['oldest'] = date('Y-m-d H:i:s', $oldest);
        
        // Newest paste
        $stmt = $conn->query("SELECT MAX(created) FROM pastes");
        $newest = $stmt->fetchColumn();
        $stats['newest'] = date('Y-m-d H:i:s', $newest);
    }
    
    return $stats;
}

// Get database stats if authenticated
$stats = $authenticated ? getDatabaseStats() : null;

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Maintenance - <?php echo Config::SITE_NAME; ?></title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
    <link rel="stylesheet" href="css/style.css">
    <style>
        .maintenance-icon {
            font-size: 3rem;
            color: var(--accent-color);
        }
        .stats-card {
            border-left: 4px solid var(--accent-color);
        }
        .action-card {
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .action-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container mt-5 mb-5">
        <div class="card">
            <div class="card-header d-flex align-items-center">
                <i class="bi bi-tools me-3 maintenance-icon"></i>
                <div>
                    <h2 class="mb-0">Database Maintenance</h2>
                    <p class="text-muted mb-0"><?php echo Config::SITE_NAME; ?> - Version <?php echo Config::VERSION; ?></p>
                </div>
            </div>
            
            <?php if (!$authenticated): ?>
            <!-- Login Form -->
            <div class="card-body">
                <?php if ($message): ?>
                <div class="alert alert-<?php echo $messageType; ?>" role="alert">
                    <?php echo $message; ?>
                </div>
                <?php endif; ?>
                
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-body">
                                <h4 class="card-title mb-4"><i class="bi bi-shield-lock me-2"></i>Administrator Login</h4>
                                <form method="post">
                                    <div class="mb-3">
                                        <label for="password" class="form-label">Admin Password:</label>
                                        <input type="password" class="form-control" id="password" name="password" required autofocus>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">
                                        <i class="bi bi-key me-2"></i>Login
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php else: ?>
            <!-- Maintenance Dashboard -->
            <div class="card-body">
                <?php if ($message): ?>
                <div class="alert alert-<?php echo $messageType; ?>" role="alert">
                    <i class="bi bi-<?php echo $messageType === 'success' ? 'check-circle' : 'exclamation-triangle'; ?> me-2"></i>
                    <?php echo $message; ?>
                </div>
                <?php endif; ?>
                
                <!-- Database Statistics -->
                <div class="card mb-4 stats-card">
                    <div class="card-body">
                        <h4 class="card-title mb-3"><i class="bi bi-bar-chart-line me-2"></i>Database Statistics</h4>
                        <div class="row">
                            <div class="col-md-3 mb-3">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h3 class="mb-0"><?php echo $stats['total']; ?></h3>
                                        <p class="text-muted mb-0">Total Pastes</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h3 class="mb-0"><?php echo $stats['expired']; ?></h3>
                                        <p class="text-muted mb-0">Expired Pastes</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h3 class="mb-0"><?php echo $stats['burn_after_reading']; ?></h3>
                                        <p class="text-muted mb-0">Burn After Reading</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="card bg-light">
                                    <div class="card-body text-center">
                                        <h3 class="mb-0"><?php echo $stats['total'] - $stats['expired']; ?></h3>
                                        <p class="text-muted mb-0">Active Pastes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <?php if ($stats['total'] > 0): ?>
                        <div class="row mt-2">
                            <div class="col-md-6">
                                <p><strong>Oldest Paste:</strong> <?php echo $stats['oldest']; ?></p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Newest Paste:</strong> <?php echo $stats['newest']; ?></p>
                            </div>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
                
                <!-- Maintenance Actions -->
                <h4 class="mb-3"><i class="bi bi-gear me-2"></i>Maintenance Actions</h4>
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <div class="card h-100 action-card">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-hourglass-split me-2 text-warning"></i>Clear Expired Pastes</h5>
                                <p class="card-text">Remove all pastes that have reached their expiration date.</p>
                                <form method="post">
                                    <input type="hidden" name="password" value="<?php echo ADMIN_PASSWORD; ?>">
                                    <input type="hidden" name="action" value="clear-expired">
                                    <button type="submit" class="btn btn-warning w-100">
                                        <i class="bi bi-trash me-2"></i>Clear Expired
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4 mb-3">
                        <div class="card h-100 action-card">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-calendar-x me-2 text-primary"></i>Clear Older Pastes</h5>
                                <p class="card-text">Remove pastes older than a specified number of days.</p>
                                <form method="post">
                                    <input type="hidden" name="password" value="<?php echo ADMIN_PASSWORD; ?>">
                                    <input type="hidden" name="action" value="clear-older-than">
                                    <div class="input-group mb-3">
                                        <input type="number" class="form-control" name="days" min="1" value="30" required placeholder="Days">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="bi bi-trash me-1"></i>Clear
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4 mb-3">
                        <div class="card h-100 action-card">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-exclamation-triangle me-2 text-danger"></i>Clear All Pastes</h5>
                                <p class="card-text">Remove all pastes from the database. Use with caution!</p>
                                <button type="button" class="btn btn-danger w-100" data-bs-toggle="modal" data-bs-target="#confirmModal">
                                    <i class="bi bi-trash me-2"></i>Clear All
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Confirmation Modal for Clear All -->
                <div class="modal fade" id="confirmModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-danger text-white">
                                <h5 class="modal-title">
                                    <i class="bi bi-exclamation-triangle me-2"></i>Confirm Delete All
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p class="mb-0">Are you sure you want to delete <strong>ALL</strong> pastes from the database? This action cannot be undone!</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <form method="post">
                                    <input type="hidden" name="password" value="<?php echo ADMIN_PASSWORD; ?>">
                                    <input type="hidden" name="action" value="clear-all">
                                    <button type="submit" class="btn btn-danger">
                                        <i class="bi bi-trash me-2"></i>Yes, Delete All
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php endif; ?>
            
            <div class="card-footer text-muted">
                <div class="d-flex justify-content-between align-items-center">
                    <a href="index.php" class="btn btn-outline-secondary">
                        <i class="bi bi-arrow-left me-1"></i>Back to Home
                    </a>
                    <?php if ($authenticated): ?>
                    <form method="post">
                        <button type="submit" class="btn btn-outline-danger">
                            <i class="bi bi-box-arrow-right me-1"></i>Logout
                        </button>
                    </form>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html> 