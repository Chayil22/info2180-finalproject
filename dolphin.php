<?php
// Dolphin CRM backend entry point

session_start();
require_once 'includes/db.php';

$action = $_REQUEST['action'] ?? '';

/**
 * Ensure the user is logged in
 */
function require_login()
{
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo 'Authentication required';
        exit;
    }
}

switch ($action) {

    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo 'Invalid request method';
            exit;
        }

        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($email === '' || $password === '') {
            http_response_code(400);
            echo 'Email and password are required';
            exit;
        }

        $stmt = $conn->prepare(
            'SELECT id, firstname, lastname, password, role 
             FROM users 
             WHERE email = ?'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, $user['password'])) {
            http_response_code(401);
            echo 'Invalid login';
            exit;
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['firstname'] . ' ' . $user['lastname'];
        $_SESSION['user_role'] = $user['role'];

        echo 'Login successful';
        break;

    case 'logout':
        require_login();
        session_unset();
        session_destroy();
        echo 'Logged out';
        break;
        
    case 'dashboard':
        require_login();
        echo 'Welcome, ' . $_SESSION['user_name'];
        break;

    default:
        echo 'Dolphin CRM - Project 2';
        break;
}
