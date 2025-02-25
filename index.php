<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Buffer output to prevent headers already sent errors
ob_start();

require_once 'lib/Config.php';
require_once 'lib/Paste.php';

// Clean up expired pastes
$paste = new Paste();
$paste->cleanupExpired();

// Check for error messages
$error = '';
if (isset($_GET['error'])) {
    if ($_GET['error'] === 'empty') {
        $error = 'Please enter some content for your paste.';
    } elseif ($_GET['error'] === 'server') {
        $error = 'Server error: ' . (isset($_GET['message']) ? htmlspecialchars($_GET['message']) : 'Unknown error');
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo Config::SITE_NAME; ?></title>
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
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link active" href="index.php">
                                    <i class="bi bi-plus-circle me-1"></i>Create New Paste
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </header>
        
        <main>
            <?php if (!empty($error)): ?>
            <div class="alert alert-danger mb-4">
                <i class="bi bi-exclamation-triangle-fill me-2"></i><?php echo $error; ?>
            </div>
            <?php endif; ?>
            
            <form id="pasteForm" action="create.php" method="post">
                <div class="card mb-4">
                    <div class="card-header">
                        <div class="d-flex justify-content-end align-items-center">
                            <select name="expiration" class="form-select">
                                <?php foreach (Config::EXPIRATION_OPTIONS as $seconds => $label): ?>
                                <option value="<?php echo $seconds; ?>" <?php echo ($seconds == 604800) ? 'selected' : ''; ?>>
                                    Retain for <?php echo $label; ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="editor-container">
                            <textarea id="pasteContent" name="data" class="form-control" rows="15" placeholder="Paste your text here..." required></textarea>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="d-flex justify-content-between align-items-center flex-column flex-md-row">
                            <!-- Create Paste button - now first on mobile -->
                            <button type="submit" class="btn btn-primary w-100 w-md-auto order-1 order-md-2 mb-3 mb-md-0">
                                <i class="bi bi-send me-1"></i>Create Paste
                            </button>
                            
                            <!-- Burn after reading checkbox - now second on mobile -->
                            <div class="form-check w-100 w-md-auto order-2 order-md-1">
                                <input class="form-check-input" type="checkbox" id="burnAfterReading" name="burnAfterReading" value="1">
                                <label class="form-check-label" for="burnAfterReading">
                                    <i class="bi bi-fire me-1"></i>Burn after reading
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </main>
        
        <footer class="text-center text-muted">
            <p>
                <i class="bi bi-shield-lock me-1"></i><?php echo Config::SITE_NAME; ?> - Secure Pastes
            </p>
        </footer>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
<?php
// Flush the output buffer
ob_end_flush();
?> 