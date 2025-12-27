<?php

session_start();

require_once __DIR__ . '/includes/db.php';

$action = $_REQUEST['action'] ?? '';

/* Helpers */

function clean_text($value, $max = 255)
{
    $value = trim((string)($value ?? ''));
    $value = strip_tags($value);
    $value = preg_replace('/\s+/', ' ', $value);
    if (mb_strlen($value) > $max) {
        $value = mb_substr($value, 0, $max);
    }
    return $value;
}

function clean_email($value, $max = 255)
{
    $email = clean_text($value, $max);
    $email = strtolower($email);
    return $email;
}

// At least 8 chars, at least one number, at least one letter, at least one capital letter
function valid_password($password)
{
    return is_string($password)
        && preg_match('/^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d).{8,}$/', $password);
}

function valid_role($role)
{
    return in_array($role, ['Admin', 'Member'], true);
}

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
/* Actions */

switch ($action) {
	/* Login */
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

        $stmt = $pdo->prepare(
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

	/* Logout */
	case 'logout':
        require_login();
        session_unset();
        session_destroy();
        echo 'Logged out';
        break;

	/* Dashboard */
	case 'dashboard':
        require_login();
        echo 'Welcome, ' . $_SESSION['user_name'];
        break;

	/* Users */
	case 'users':
        require_admin();

        $stmt = $pdo->query(
            'SELECT id, firstname, lastname, email, role, created_at
             FROM users
             ORDER BY lastname, firstname'
        );

        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        header('Content-Type: application/json');
        echo json_encode($users);
        break;

	/* Users basic */
	case 'users_basic':
        require_login();

        $stmt = $pdo->query(
            'SELECT id, firstname, lastname
             FROM users
             ORDER BY lastname, firstname'
        );

        header('Content-Type: application/json');
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;

	/* Me */
	case 'me':
        require_login();
        header('Content-Type: application/json');
        echo json_encode([
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'role' => $_SESSION['user_role']
        ]);
        exit;

	/* Add user */
	case 'add_user':
        require_admin();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo 'Invalid request method';
            exit;
        }

        $firstname = clean_text($_POST['firstname'] ?? '', 60);
        $lastname  = clean_text($_POST['lastname'] ?? '', 60);
        $email     = clean_email($_POST['email'] ?? '', 120);
        $password  = (string)($_POST['password'] ?? '');
        $role      = clean_text($_POST['role'] ?? '', 20);

        if ($firstname === '' || $lastname === '' || $email === '' || $password === '' || $role === '') {
            http_response_code(400);
            echo 'All fields are required';
            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo 'Invalid email address';
            exit;
        }

        if (!valid_role($role)) {
            http_response_code(400);
            echo 'Invalid role (must be Admin or Member)';
            exit;
        }

        if (!valid_password($password)) {
            http_response_code(400);
            echo 'Password must be at least 8 characters and include 1 capital letter and 1 number';
            exit;
        }

        // prevent duplicate emails
        $check = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $check->execute([$email]);
        if ($check->fetchColumn()) {
            http_response_code(400);
            echo 'That email is already in use';
            exit;
        }

        // hash password before storing
        $hashed = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare(
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


 
	/* Create contact */
	case 'create_contact':
	/* Add-contact */
	case 'add-contact':
        require_login();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo 'Invalid request method';
            exit;
        }

        $title       = clean_text($_POST['title'] ?? '', 10);
        $firstname   = clean_text($_POST['firstname'] ?? '', 60);
        $lastname    = clean_text($_POST['lastname'] ?? '', 60);
        $email       = clean_email($_POST['email'] ?? '', 120);
        $telephone   = clean_text($_POST['telephone'] ?? '', 30);
        $company     = clean_text($_POST['company'] ?? '', 80);
        $type        = clean_text($_POST['type'] ?? '', 20);
        $assigned_to = (int)($_POST['assigned_to'] ?? 0);
        $created_by  = (int)$_SESSION['user_id'];

        $allowedTitles = ['Mr', 'Ms', 'Mrs', 'Dr'];
        $allowedTypes  = ['Sales Lead', 'Support'];

        if ($title === '' || $firstname === '' || $lastname === '' || $email === '' || $type === '' || $assigned_to <= 0) {
            http_response_code(400);
            echo 'All required fields must be filled';
            exit;
        }

        if (!in_array($title, $allowedTitles, true)) {
            http_response_code(400);
            echo 'Invalid title';
            exit;
        }

        if (!in_array($type, $allowedTypes, true)) {
            http_response_code(400);
            echo 'Invalid type';
            exit;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo 'Invalid email address';
            exit;
        }

        if ($telephone !== '' && !preg_match('/^[0-9+\-\s()]{7,30}$/', $telephone)) {
            http_response_code(400);
            echo 'Invalid telephone number';
            exit;
        }

        try {
            $sql = "INSERT INTO contacts (title, firstname, lastname, email, telephone, company, type, assigned_to, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$title, $firstname, $lastname, $email, $telephone, $company, $type, $assigned_to, $created_by]);

            echo 'Contact created';
        } catch (PDOException $e) {
            http_response_code(400);
            echo 'Unable to create contact';
        }
        break;
	
    /* Assign contact */
	case 'assign_contact':
        require_login();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Invalid request']);
            exit;
        }

        $contact_id = (int)($_POST['contact_id'] ?? 0);
        $user_id = (int)$_SESSION['user_id'];

        $stmt = $pdo->prepare('UPDATE contacts SET assigned_to = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$user_id, $contact_id]);

        echo json_encode(['success' => true]);
        exit;

	/* Contacts */
	case 'contacts':
        require_login();

        $user_id = (int)$_SESSION['user_id'];

        $stmt = $pdo->prepare(
            'SELECT id, title, firstname, lastname, email, company, type, assigned_to, created_at,
                    :uid AS current_user_id
             FROM contacts
             ORDER BY created_at DESC'
        );
        $stmt->execute(['uid' => $user_id]);

        $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: application/json');
        echo json_encode($contacts);
        exit;

	/* Contact */
	case 'contact':
        require_login();

        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo 'Contact id is required';
            exit;
        }

        $stmt = $pdo->prepare("
            SELECT
                c.*,
                CONCAT(cb.firstname, ' ', cb.lastname) AS created_by_name,
                CONCAT(at.firstname, ' ', at.lastname) AS assigned_to_name
            FROM contacts c
            LEFT JOIN users cb ON c.created_by = cb.id
            LEFT JOIN users at ON c.assigned_to = at.id
            WHERE c.id = ?
        ");
        $stmt->execute([$id]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$contact) {
            http_response_code(404);
            echo 'Contact not found';
            exit;
        }

        header('Content-Type: application/json');
        echo json_encode($contact);
        break;

	/* Notes */
	case 'notes':
        require_login();

        $contact_id = (int)($_GET['contact_id'] ?? 0);
        if ($contact_id <= 0) {
            http_response_code(400);
            echo 'contact_id is required';
            exit;
        }

        $stmt = $pdo->prepare(
            'SELECT n.id,
                    n.comment, 
                    n.created_at,
                    u.firstname, 
                    u.lastname
            FROM notes n
            JOIN users u ON n.created_by = u.id
            WHERE n.contact_id = ?
            ORDER BY n.created_at DESC'
        );

        $stmt->execute([$contact_id]);
        $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: application/json');
        echo json_encode($notes);
        break;

	/* Add note */
	case 'add_note':
        require_login();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo 'Invalid request method';
            exit;
        }

        $contact_id = (int)($_POST['contact_id'] ?? 0);
        $comment = trim($_POST['comment'] ?? '');

        if ($contact_id <= 0 || $comment === '') {
            http_response_code(400);
            echo 'Contact id and comment are required';
            exit;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO notes (contact_id, comment, created_by, created_at)
             VALUES (?, ?, ?, NOW())'
        );

        $update = $pdo->prepare(
            'UPDATE contacts
             SET updated_at = NOW()
             WHERE id = ?'
        );

        try {
            $stmt->execute([$contact_id, $comment, $_SESSION['user_id']]);

            // NEW
            $update->execute([$contact_id]);

            echo 'Note added';
        } catch (PDOException $e) {
            http_response_code(400);
            echo 'Unable to add note';
        }
        break;

	/* Switch type */
	case 'switch_type':
        require_login();
        $contact_id = $_POST['contact_id'] ?? '';
        $type = $_POST['type'] ?? '';

        if ($contact_id === '' || $type === '') {
            echo json_encode(["ok" => false, "error" => "Missing contact_id or type"]);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE contacts SET type = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$type, $contact_id]);

        echo json_encode(["ok" => true]);
        exit;


    default:
        echo 'Dolphin CRM - Project 2';
        break;
}
