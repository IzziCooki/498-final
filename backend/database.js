const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'app.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    color TEXT DEFAULT "#6d28d9",
    display_icon TEXT DEFAULT "👤",
    email TEXT UNIQUE,
    reset_password_token TEXT,
    reset_password_expires DATETIME,
    password_hash TEXT NOT NULL,
    login_attempts INTEGER DEFAULT 0,
    lock_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )
`);

// Create pdfs table
db.exec(`
  CREATE TABLE IF NOT EXISTS pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    title TEXT,
    description TEXT,
    author TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Migration to add is_public if it doesn't exist (for existing databases)
try {
  const columns = db.pragma('table_info(pdfs)');
  const hasIsPublic = columns.some(col => col.name === 'is_public');
  if (!hasIsPublic) {
    db.exec('ALTER TABLE pdfs ADD COLUMN is_public INTEGER DEFAULT 0');
  }
  const users_column = db.pragma('table_info(users)');
  const hasEmailOrDisplayname = users_column.some(col => col.name === 'email' || 'display_name' );
  if (!hasEmailOrDisplayname){
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
    db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  }

  const hasColor = users_column.some(col => col.name === 'color');
  if (!hasColor){
    db.exec('ALTER TABLE users ADD COLUMN color TEXT DEFAULT "#6d28d9"');
  }

  const hasResetToken = users_column.some(col => col.name === 'reset_password_token');
  if (!hasResetToken) {
    db.exec('ALTER TABLE users ADD COLUMN reset_password_token TEXT');
    db.exec('ALTER TABLE users ADD COLUMN reset_password_expires DATETIME');
  }
} catch (err) {
  console.error('Error migrating pdfs table and users_column:', err);
}

// Create comments table
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment_text TEXT NOT NULL,
    is_edited INTEGER DEFAULT 0,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_id) REFERENCES pdfs (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Create messages table for chat
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`);

// Create comment_votes table
db.exec(`
  CREATE TABLE IF NOT EXISTS comment_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    vote_value INTEGER NOT NULL, -- 1 for up, -1 for down
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (comment_id) REFERENCES comments (id),
    UNIQUE(user_id, comment_id)
  )
`);

module.exports = db;
