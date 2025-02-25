<?php
/**
 * Configuration settings for the application
 */
class Config {
    // Database configuration
    const DB_HOST = 'localhost';
    const DB_NAME = 'hackcont_pastebin';
    const DB_USER = 'hackcont_pastebin';
    const DB_PASS = 'u{7~&$==&LjS';
    
    // Site configuration
    const SITE_NAME = 'HackGuard PrivateBin';
    const BASE_URL = 'https://private.hackguard.com';
    
    // Paste configuration
    const MAX_PASTE_SIZE = 1048576; // 1MB
    const DEFAULT_EXPIRATION = 604800; // 1 week in seconds
    
    // Format options
    const FORMATS = [
        'plaintext' => 'Plain Text',
        'sourcecode' => 'Source Code',
        'markdown' => 'Markdown'
    ];
    
    // Expiration options
    const EXPIRATION_OPTIONS = [
        300 => '5 Minutes',
        3600 => '1 Hour',
        86400 => '1 Day',
        604800 => '1 Week',
        2592000 => '1 Month',
        31536000 => '1 Year',
        0 => 'Never'
    ];
}
?> 