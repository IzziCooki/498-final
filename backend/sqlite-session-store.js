// sqlite-session-store.js
const { Store } = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');

class SQLiteStore extends Store {
    constructor(options = {}) {
        super(options);

        // Use provided database or default to sessions.db
        const dbPath = options.db || path.join(__dirname, 'sessions.db');
        this.db = new Database(dbPath);

        // Table name (default: sessions)
        this.table = options.table || 'sessions';

        // Create sessions table if it doesn't exist
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      )
    `);

        // Create index for faster expiration lookups
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.table}_expire 
      ON ${this.table}(expire)
    `);

        // Clean up expired sessions periodically (every 15 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 15 * 60 * 1000);
    }

    // Get session by ID
    get(sid, callback) {
        const row = this.db.prepare(
            `SELECT sess FROM ${this.table} WHERE sid = ? AND expire > ?`
        ).get(sid, Date.now());

        if (row) {
            try {
                const session = JSON.parse(row.sess);
                callback(null, session);
            } catch (err) {
                callback(err);
            }
        } else {
            callback(null, null);
        }
    }

    // Save session
    set(sid, sess, callback) {
        const maxAge = sess.cookie?.maxAge;
        const expire = maxAge ? Date.now() + maxAge : Date.now() + (24 * 60 * 60 * 1000);

        const sessData = JSON.stringify(sess);

        try {
            this.db.prepare(
                `INSERT OR REPLACE INTO ${this.table} (sid, sess, expire) VALUES (?, ?, ?)`
            ).run(sid, sessData, expire);

            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    // Destroy session
    destroy(sid, callback) {
        try {
            this.db.prepare(`DELETE FROM ${this.table} WHERE sid = ?`).run(sid);
            callback(null);
        } catch (err) {
            callback(err);
        }
    }

    // Get all sessions
    all(callback) {
        try {
            const rows = this.db.prepare(
                `SELECT sess FROM ${this.table} WHERE expire > ?`
            ).all(Date.now());

            const sessions = rows.map(row => JSON.parse(row.sess));
            callback(null, sessions);
        } catch (err) {
            callback(err);
        }
    }

    // Clean up expired sessions
    cleanup() {
        try {
            const result = this.db.prepare(
                `DELETE FROM ${this.table} WHERE expire <= ?`
            ).run(Date.now());

            if (result.changes > 0) {
                console.log(`Cleaned up ${result.changes} expired session(s)`);
            }
        } catch (err) {
            console.error('Error cleaning up sessions:', err);
        }
    }

    // Close the database connection
    close() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.db.close();
    }
}

module.exports = SQLiteStore;
