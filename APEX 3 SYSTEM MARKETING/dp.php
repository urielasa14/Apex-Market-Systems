<?php

if (basename($_SERVER['PHP_SELF']) === 'db.php') {
    http_response_code(403);
    die('Direct access not allowed.');
}

$host = "localhost";
$dbname = "apex_market";
$username = "root";
$password = "";
$charset = "utf8mb4";


$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, 
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         
    PDO::ATTR_EMULATE_PREPARES   => false,                   
];

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=$charset",
        $username,
        $password,
        $options
    );
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode([
        "success" => false,
        "message" => "Database connection failed. Please check your XAMPP MySQL is running."
    ]));
}
?>