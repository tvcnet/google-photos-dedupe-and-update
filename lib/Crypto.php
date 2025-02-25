<?php
require_once 'Config.php';

/**
 * Encryption/Decryption functions
 */
class Crypto {
    /**
     * Encrypt data
     * 
     * @param string $data Data to encrypt
     * @param string $key Optional custom encryption key
     * @return string Encrypted data
     */
    public static function encrypt($data, $key = null) {
        if ($key === null) {
            $key = Config::ENCRYPTION_KEY;
        }
        
        $method = "AES-256-CBC";
        $ivlen = openssl_cipher_iv_length($method);
        $iv = openssl_random_pseudo_bytes($ivlen);
        
        $encrypted = openssl_encrypt($data, $method, $key, 0, $iv);
        
        // Return IV + encrypted data
        return base64_encode($iv . $encrypted);
    }
    
    /**
     * Decrypt data
     * 
     * @param string $data Encrypted data
     * @param string $key Optional custom decryption key
     * @return string|false Decrypted data or false on failure
     */
    public static function decrypt($data, $key = null) {
        if ($key === null) {
            $key = Config::ENCRYPTION_KEY;
        }
        
        $data = base64_decode($data);
        if ($data === false) {
            return false;
        }
        
        $method = "AES-256-CBC";
        $ivlen = openssl_cipher_iv_length($method);
        
        if (strlen($data) <= $ivlen) {
            return false;
        }
        
        $iv = substr($data, 0, $ivlen);
        $encrypted = substr($data, $ivlen);
        
        return openssl_decrypt($encrypted, $method, $key, 0, $iv);
    }
    
    /**
     * Generate a random ID for pastes
     * 
     * @param int $length Length of the ID
     * @return string Random ID
     */
    public static function generateId($length = null) {
        if ($length === null) {
            $length = Config::PASTE_ID_LENGTH;
        }
        
        $bytes = random_bytes(ceil($length / 2));
        return substr(bin2hex($bytes), 0, $length);
    }
    
    /**
     * Generate a random encryption key
     * 
     * @return string Base64 encoded encryption key
     */
    public static function generateKey() {
        return base64_encode(random_bytes(32)); // 256 bits
    }
    
    /**
     * Generate a random initialization vector
     * 
     * @return string Base64 encoded IV
     */
    public static function generateIV() {
        return base64_encode(random_bytes(16)); // 128 bits for AES
    }
}
?> 