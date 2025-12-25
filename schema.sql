-- Dolphin CRM schema

CREATE DATABASE IF NOT EXISTS dolphin_crm;
USE dolphin_crm;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firstname VARCHAR(50) NOT NULL,
  lastname VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(10) NOT NULL,
  firstname VARCHAR(50) NOT NULL,
  lastname VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  telephone VARCHAR(20) NOT NULL,
  company VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  assigned_to INT NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL
);

INSERT INTO users (firstname, lastname, password, email, role, created_at)
VALUES (
  'Admin',
  'User',
  '$2y$10$eIFzC7dWb2xk8qWGrKcKQegCYUzuxxRQ5wTv9Squ1sEnMKac92sj.',
  'admin@project2.com',
  'Admin',
  NOW()
);
