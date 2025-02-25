<?php
require_once 'Database.php';
require_once 'Crypto.php';
require_once 'Config.php';

/**
 * Paste model/class
 */
class Paste {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Create a new paste
     * 
     * @param array $pasteData Paste data
     * @return string Paste ID
     */
    public function create($pasteData) {
        // Validate data
        if (empty($pasteData['data'])) {
            throw new Exception('Paste content cannot be empty');
        }
        
        // Check size limit
        if (strlen($pasteData['data']) > Config::MAX_PASTE_SIZE) {
            throw new Exception('Paste exceeds maximum size limit of ' . Config::MAX_PASTE_SIZE . ' bytes');
        }
        
        // Generate unique ID
        $id = $this->generateId();
        
        // Set default values if not provided
        $format = $pasteData['format'] ?? 'plaintext';
        $expiration = isset($pasteData['expiration']) ? (int)$pasteData['expiration'] : Config::DEFAULT_EXPIRATION;
        $burnAfterReading = isset($pasteData['burnafterreading']) ? (int)$pasteData['burnafterreading'] : 0;
        $encrypted = 0; // Always set to unencrypted
        
        // Calculate expiration timestamp
        $expiresAt = ($expiration > 0) ? time() + $expiration : 0;
        
        try {
            // Get database connection
            $conn = $this->db->getConnection();
            
            // Insert paste into database
            $stmt = $conn->prepare("
                INSERT INTO pastes (id, data, created, expires, burnafterreading, format, encrypted) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            
            $now = time();
            $stmt->execute([
                $id,
                $pasteData['data'],
                $now,
                $expiresAt,
                $burnAfterReading,
                $format,
                $encrypted
            ]);
            
            return $id;
        } catch (PDOException $e) {
            error_log('Database error in create: ' . $e->getMessage());
            throw new Exception('Database error: ' . $e->getMessage());
        }
    }
    
    /**
     * Get a paste by ID
     * 
     * @param string $id Paste ID
     * @return array|false Paste data or false if not found
     */
    public function getById($id) {
        $conn = $this->db->getConnection();
        $stmt = $conn->prepare("SELECT * FROM pastes WHERE id = ?");
        $stmt->execute([$id]);
        
        return $stmt->fetch();
    }
    
    /**
     * Delete a paste by ID
     * 
     * @param string $id Paste ID
     * @return bool Success
     */
    public function deleteById($id) {
        $conn = $this->db->getConnection();
        $stmt = $conn->prepare("DELETE FROM pastes WHERE id = ?");
        $stmt->execute([$id]);
        
        return $stmt->rowCount() > 0;
    }
    
    /**
     * Clean up expired pastes
     */
    public function cleanupExpired() {
        $conn = $this->db->getConnection();
        $stmt = $conn->prepare("DELETE FROM pastes WHERE expires > 0 AND expires < ?");
        $stmt->execute([time()]);
        
        return $stmt->rowCount();
    }
    
    /**
     * Generate a unique ID for a paste
     * 
     * @return string Unique ID
     */
    private function generateId($length = 8) {
        $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $id = '';
        
        for ($i = 0; $i < $length; $i++) {
            $id .= $characters[rand(0, strlen($characters) - 1)];
        }
        
        // Check if ID already exists
        $conn = $this->db->getConnection();
        $stmt = $conn->prepare("SELECT id FROM pastes WHERE id = ?");
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() > 0) {
            // ID already exists, generate a new one
            return $this->generateId($length);
        }
        
        return $id;
    }
    
    /**
     * Handle burn-after-reading functionality
     * 
     * @param string $id The paste ID
     * @return bool True if the paste is burned, false otherwise
     */
    public function handleBurnAfterReading($id) {
        try {
            $conn = $this->db->getConnection();
            
            // Check if this is a burn-after-reading paste
            $stmt = $conn->prepare("SELECT burnafterreading FROM pastes WHERE id = ?");
            $stmt->execute([$id]);
            $paste = $stmt->fetch();
            
            if ($paste && $paste['burnafterreading'] == 1) {
                // This is a burn-after-reading paste, so delete it
                $this->deleteById($id);
                
                // Store in session that this paste has been burned
                $_SESSION['burned_paste_' . $id] = true;
                
                return true;
            }
            
            return false;
        } catch (PDOException $e) {
            error_log("Database error in handleBurnAfterReading: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Check if a paste has been burned (based on session)
     * 
     * @param string $id The paste ID
     * @return bool True if the paste has been burned
     */
    public function isPasteBurned($id) {
        return isset($_SESSION['burned_paste_' . $id]) && $_SESSION['burned_paste_' . $id] === true;
    }
    
    /**
     * Delete all expired pastes
     * 
     * @return int Number of pastes deleted
     */
    public function deleteExpired() {
        $currentTime = time();
        
        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("DELETE FROM pastes WHERE expires > 0 AND expires <= ?");
            $stmt->execute([$currentTime]);
            return $stmt->rowCount();
        } catch (PDOException $e) {
            error_log("Error deleting expired pastes: " . $e->getMessage());
            return 0;
        }
    }
    
    /**
     * Delete all pastes
     * 
     * @return int Number of pastes deleted
     */
    public function deleteAll() {
        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("DELETE FROM pastes");
            $stmt->execute();
            return $stmt->rowCount();
        } catch (PDOException $e) {
            error_log("Error deleting all pastes: " . $e->getMessage());
            return 0;
        }
    }
    
    /**
     * Delete pastes older than a specified timestamp
     * 
     * @param int $timestamp Unix timestamp
     * @return int Number of pastes deleted
     */
    public function deleteOlderThan($timestamp) {
        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("DELETE FROM pastes WHERE created <= ?");
            $stmt->execute([$timestamp]);
            return $stmt->rowCount();
        } catch (PDOException $e) {
            error_log("Error deleting old pastes: " . $e->getMessage());
            return 0;
        }
    }
}
?> 