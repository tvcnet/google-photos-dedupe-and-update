<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Start session at the very beginning
session_start();

// Buffer output to prevent headers already sent errors
ob_start();

require_once 'lib/Config.php';

require_once 'lib/Database.php';
require_once 'lib/Paste.php';

$id = $_GET['id'] ?? '';
$burned = false;
$firstView = false;
$error = null;
$pasteData = null;

// Process the paste request
if (empty($id)) {
    // If no ID is provided, redirect to the home page
    header("Location: index.php");
    exit;
}

// Get paste from database
try {
    $paste = new Paste();
    
    // Check if this is a content view or just the info page
    $viewMode = isset($_GET['view']) && $_GET['view'] === 'content' ? 'content' : 'info';
    $sessionKey = 'viewed_paste_content_' . $id;
    
    // Only count content views toward burn-after-reading, not info page views
    if ($viewMode === 'content') {
        if (!isset($_SESSION[$sessionKey])) {
            $firstView = true;
            $_SESSION[$sessionKey] = 1;
        } else {
            $_SESSION[$sessionKey]++;
        }
    }
    
    // Try to get the paste
    $pasteData = $paste->getById($id);
    
    if (!$pasteData) {
        // Check if this was a burn-after-reading paste that we've seen before
        if (isset($_SESSION['burned_paste_' . $id]) && $_SESSION['burned_paste_' . $id] === true) {
            $burned = true;
        } else {
            $error = "Paste not found or has expired.";
        }
    } else {
        // Handle burn-after-reading pastes
        if ($pasteData['burnafterreading'] == 1) {
            if ($viewMode === 'content') {
                // This is a content view of a burn-after-reading paste
                if ($_SESSION[$sessionKey] > 1) {
                    // This is a subsequent view, show as burned
                    $burned = true;
                } else {
                    // This is the first content view, burn after displaying
                    register_shutdown_function(function() use ($paste, $id) {
                        // Delete the paste after the page has been rendered
                        $paste->deleteById($id);
                    });
                    $_SESSION['burned_paste_' . $id] = true;
                }
            } else {
                // This is just the info page, show a warning
                $willBeBurned = true;
            }
        }
    }
} catch (Exception $e) {
    $error = "Database error: " . $e->getMessage();
}

// Generate the full URL for sharing
$shareUrl = Config::BASE_URL . "/view.php?id=" . $id;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <title>View Paste - <?php echo Config::SITE_NAME; ?></title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
    <link rel="stylesheet" href="css/style.css?v=<?php echo time(); ?>">
    <link rel="icon" href="favicon.ico" type="image/x-icon">
</head>
<body>
    <div class="container">
        <header class="mb-4">
            <nav class="navbar navbar-expand-lg navbar-dark">
                <div class="container-fluid">
                    <a class="navbar-brand" href="index.php">
                        <i class="bi bi-clipboard-data me-2"></i><?php echo Config::SITE_NAME; ?>
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link active d-flex align-items-center py-2" href="index.php">
                                    <i class="bi bi-plus-circle me-1"></i>Create New Paste
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </header>
        
        <main>
            <?php if (isset($error)): ?>
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i><?php echo htmlspecialchars($error); ?>
                </div>
                <p class="text-center mt-4">
                    <a href="index.php" class="btn btn-primary">
                        <i class="bi bi-plus-circle me-1"></i>Create New Paste
                    </a>
                </p>
            <?php elseif ($burned): ?>
                <!-- Burned paste message -->
                <div class="card">
                    <div class="card-body text-center text-danger">
                        <div class="mb-3" style="font-size: 3rem;">
                            <i class="bi bi-fire"></i>
                        </div>
                        <h3>Content Burned</h3>
                        <p>This paste has been permanently deleted.</p>
                    </div>
                </div>
                
                <div class="text-center mt-4">
                    <a href="index.php" class="btn btn-primary">
                        <i class="bi bi-plus-circle me-1"></i>Create New Paste
                    </a>
                </div>
            <?php else: ?>
                <?php if (isset($willBeBurned) && $willBeBurned): ?>
                    <!-- Warning for burn-after-reading pastes -->
                    <div class="alert alert-warning mb-4">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>Warning:</strong> This is a burn-after-reading paste. It will be permanently deleted after viewing it one more time.
                    </div>
                <?php endif; ?>
                
                <!-- Paste content display - Only show when explicitly requested -->
                <?php if (isset($_GET['view']) && $_GET['view'] === 'content'): ?>
                    <div class="card">
                        <div class="card-body p-2 p-md-3">
                            <pre id="pasteContent"><?php echo htmlspecialchars($pasteData['data']); ?></pre>
                        </div>
                    </div>
                    
                    <div class="text-center mt-4">
                        <a href="<?php echo $shareUrl; ?>" class="btn btn-outline-secondary d-block d-md-inline-block mb-2 mb-md-0">
                            <i class="bi bi-arrow-left me-1"></i>Back to Share Page
                        </a>
                        <a href="index.php" class="btn btn-primary d-block d-md-inline-block ms-md-2">
                            <i class="bi bi-plus-circle me-1"></i>Create Another Paste
                        </a>
                    </div>
                <?php else: ?>
                    <!-- Move the View Paste Content button above the Share section -->
                    <div class="text-center mb-4">
                        <a href="<?php echo $shareUrl; ?>&view=content" class="btn btn-primary btn-lg px-4 py-3">
                            <i class="bi bi-eye me-1"></i>View Shared Content
                        </a>
                    </div>
                    
                    <!-- Share section - Show by default -->
                    <div class="card">
                        <div class="card-header">
                            <i class="bi bi-share me-2"></i>Share This Paste
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="directLink" class="form-label">
                                    <i class="bi bi-link-45deg me-1"></i>Direct Link:
                                </label>
                                <div class="input-group">
                                    <input type="text" id="directLink" class="form-control" value="<?php echo $shareUrl; ?>" readonly onclick="this.select();">
                                </div>
                                <div class="copy-instructions">
                                    <i class="bi bi-info-circle me-1"></i>Select the link and press <kbd>Ctrl</kbd>+<kbd>C</kbd> (Windows/Linux) or <kbd>⌘</kbd>+<kbd>C</kbd> (Mac) to copy.
                                </div>
                            </div>
                            
                            <div class="form-text mt-2">
                                <i class="bi bi-info-circle me-1"></i>When someone visits this link, they'll be able to view the content you've shared.
                            </div>
                            
                            <div class="mt-3 d-md-none">
                                <a href="mailto:?subject=Shared Content&body=I've shared some content with you. View it here: <?php echo rawurlencode($shareUrl); ?>" class="btn btn-primary w-100">
                                    <i class="bi bi-envelope me-1"></i>Email Link
                                </a>
                            </div>
                            
                            <div class="card bg-light mt-4">
                                <div class="card-body">
                                    <h6>
                                        <i class="bi bi-clock-history me-2"></i>Paste Information
                                    </h6>
                                    <ul class="list-unstyled mb-0">
                                        <li><strong><i class="bi bi-calendar-event me-1"></i>Created:</strong> <?php echo date('Y-m-d H:i:s', $pasteData['created']); ?></li>
                                        <?php if ($pasteData['expires'] > 0): ?>
                                            <li><strong><i class="bi bi-hourglass-split me-1"></i>Expires:</strong> <?php echo date('Y-m-d H:i:s', $pasteData['expires']); ?></li>
                                        <?php else: ?>
                                            <li><strong><i class="bi bi-infinity me-1"></i>Expires:</strong> Never</li>
                                        <?php endif; ?>
                                        <?php if ($pasteData['burnafterreading'] == 1): ?>
                                            <li><strong><i class="bi bi-fire text-danger me-1"></i>Burn after reading:</strong> Yes</li>
                                        <?php endif; ?>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>
                
                <!-- Tips Section -->
                <div class="card">
                    <div class="card-header">
                        <i class="bi bi-lightbulb me-2"></i>Tips for Sharing
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            <li>Share this link via email, messaging apps, or any other communication channel.</li>
                            <li>For sensitive information, consider using a more secure channel to share the link.</li>
                            <li>Remember that anyone with this link can access your paste.</li>
                            <?php if ($pasteData['expires'] > 0): ?>
                                <li>This paste will automatically expire on <?php echo date('Y-m-d H:i:s', $pasteData['expires']); ?>.</li>
                            <?php endif; ?>
                            <?php if ($pasteData['burnafterreading'] == 1): ?>
                                <li class="text-danger">This paste will be permanently deleted after viewing.</li>
                            <?php endif; ?>
                        </ul>
                    </div>
                </div>
            <?php endif; ?>
        </main>
        
        <footer class="text-center text-muted">
            <p>
                <i class="bi bi-shield-lock me-1"></i><?php echo Config::SITE_NAME; ?> - Secure Pastes
            </p>
        </footer>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Back to top button
        const backToTopBtn = document.getElementById('backToTopBtn');
        if (backToTopBtn) {
            window.addEventListener('scroll', function() {
                if (window.pageYOffset > 300) {
                    backToTopBtn.classList.remove('d-none');
                } else {
                    backToTopBtn.classList.add('d-none');
                }
            });
            
            backToTopBtn.addEventListener('click', function() {
                window.scrollTo({top: 0, behavior: 'smooth'});
            });
        }
    });
    </script>
</body>
</html>
<?php
// Flush the output buffer
ob_end_flush();
?> 