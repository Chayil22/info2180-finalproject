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

/**
 * Ensure the user is an admin
 */
function require_admin()
{
    require_login();

    if (($_SESSION['user_role'] ?? '') !== 'Admin') {
        http_response_code(403);
        echo 'Admin access required';
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

    case 'users':
        require_login();

        $stmt = $conn->query(
            'SELECT id, firstname, lastname, email, role, created_at
             FROM users
             ORDER BY lastname, firstname'
        );

        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        header('Content-Type: application/json');
        echo json_encode($users);
        break;

    case 'add_user':
        require_admin();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo 'Invalid request method';
            exit;
        }

        $firstname = trim($_POST['firstname'] ?? '');
        $lastname = trim($_POST['lastname'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $role = trim($_POST['role'] ?? '');

        if ($firstname === '' || $lastname === '' || $email === '' || $password === '' || $role === '') {
            http_response_code(400);
            echo 'All fields are required';
            exit;
        }

        $hashed = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $conn->prepare(
            'INSERT INTO users (firstname, lastname, password, email, role, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );

        try {
            $stmt->execute([$firstname, $lastname, $hashed, $email, $role]);
            echo 'User created';
        } catch (PDOException $e) {
            http_response_code(400);
            echo 'Unable to create user';
        }
        break;

    default:
        echo 'Dolphin CRM - Project 2';
        break;
}
