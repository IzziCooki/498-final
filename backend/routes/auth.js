const express = require('express');
const router = express.Router();
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.render('register', { error: 'Username and password are required' });
        }

        const validation = validatePassword(password);
        if (!validation.valid) {
            const errorsText = validation.errors.join(', ');
            return res.render('register', { error: 'Password does not meet requirements: ' + errorsText });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.render('register', { error: 'Username already exists. Please choose a different username.' });
        }

        const passwordHash = await hashPassword(password);
        const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        const result = stmt.run(username, passwordHash);

        res.render('register-success', { username, userId: result.lastInsertRowid });

    } catch (error) {
        console.error('Registration error:', error);
        res.render('error', { message: 'An internal server error occurred. Please try again later.', back: '/register' });
    }
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.render('login', { error: 'Username and password are required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.render('login', { error: 'Invalid username or password' });
        }

        const passwordMatch = await comparePassword(password, user.password_hash);

        if (!passwordMatch) {
            return res.render('login', { error: 'Invalid username or password' });
        }

        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isLoggedIn = true;

        res.redirect('/');

    } catch (error) {
        console.error('Login error:', error);
        res.render('error', { message: 'An internal server error occurred. Please try again later.', back: '/login' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.render('error', { message: 'An error occurred while logging out.', back: '/' });
        }
        res.render('logged-out');
    });
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.render('error', { message: 'An error occurred while logging out.', back: '/' });
        }
        res.render('logged-out');
    });
});

router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.render('error', { message: 'You must be logged in to view this page.', back: '/login' });
    }

    const user = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
        return res.render('error', { message: 'User not found in database.', back: '/' });
    }

    res.render('profile', {
        id: user.id,
        username: user.username,
        created_at: user.created_at || 'N/A',
        last_login: user.last_login || 'Never'
    });
});

module.exports = router;
