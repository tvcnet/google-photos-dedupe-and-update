<?php
require_once 'Config.php';

/**
 * Database class for handling database connections
 */
class Database {
    private static $instance = null;
    private $conn;
    
    private function __construct() {
        try {
            // Define the database directory and file path
            $dbDir = __DIR__ . '/../data';
            $dbFile = $dbDir . '/pastebin.db';
            
            // Create the data directory if it doesn't exist
            if (!is_dir($dbDir)) {
                if (!mkdir($dbDir, 0755, true)) {
                    throw new Exception("Failed to create database directory: $dbDir");
                }
            }
            
            // Check if the directory is writable
            if (!is_writable($dbDir)) {
                throw new Exception("Database directory is not writable: $dbDir");
            }
            
            // Connect to the SQLite database
            $this->conn = new PDO('sqlite:' . $dbFile);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            // Create tables if they don't exist
            $this->createTables();
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed: " . $e->getMessage());
        } catch (Exception $e) {
            error_log($e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Get the database instance (singleton pattern)
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Get the database connection
     */
    public function getConnection() {
        return $this->conn;
    }
    
    /**
     * Create database tables if they don't exist
     */
    private function createTables() {
        $this->conn->exec("
            CREATE TABLE IF NOT EXISTS pastes (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created INTEGER NOT NULL,
                expires INTEGER DEFAULT 0,
                burnafterreading INTEGER DEFAULT 0,
                format TEXT DEFAULT 'plaintext',
                encrypted INTEGER DEFAULT 0
            )
        ");
    }
    
    public function query($sql, $params = []) {
        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }
}
?> 