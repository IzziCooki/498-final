const express = require('express');
// Router for authentication-related routes
const router = express.Router();
// For generating secure tokens
const crypto = require('crypto');
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const { sendPasswordResetEmail } = require('../modules/email-utils');

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.render('register', { error: 'Username and password are required' });
        }
        // Validate password strength
        const validation = validatePassword(password);
        if (!validation.valid) {
            const errorsText = validation.errors.join(', ');
            return res.render('register', { error: 'Password does not meet requirements: ' + errorsText });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.render('register', { error: 'Username already exists. Please choose a different username.' });
        }
        // Store password as hash
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
        // Check if account is locked
        if (user.lock_until && user.lock_until > Date.now()) {
            return res.render('login', { error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.' });
        } else if (user.lock_until && user.lock_until <= Date.now()) {
            // Unlock account
            db.prepare('UPDATE users SET login_attempts = 0, lock_until = NULL WHERE id = ?').run(user.id);
            user.login_attempts = 0;
            user.lock_until = null;
        }


        const passwordMatch = await comparePassword(password, user.password_hash);

        if (!passwordMatch) {
            // If password is incorrect, increment login attempts
            user.login_attempts += 1;
            db.prepare('UPDATE users SET login_attempts = ? WHERE id = ?').run(user.login_attempts, user.id);
            if (user.login_attempts >= 5) {
                const lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
                db.prepare('UPDATE users SET lock_until = ? WHERE id = ?').run(lockUntil, user.id);
                return res.render('login', { error: 'Account locked due to too many failed login attempts. Please try again later.' });
            }
            return res.render('login', { error: 'Invalid username or password' });
        }

        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        // Set session object
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
    // Destroy session on logout
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

router.get('/profile', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.render('error', { message: 'You must be logged in to view this page.', back: '/login' });
    }

    const user = db.prepare('SELECT id, username, display_name, color, email, created_at, last_login FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
        return res.render('error', { message: 'User not found in database.', back: '/' });
    }

    const successMessage = req.query.success;
    const errorMessage = req.query.error;

    res.render('profile', {
        id: user.id,
        username: user.username,
        display_name: user.display_name || '',
        color: user.color || '#6d28d9',
        email: user.email || '',
        created_at: user.created_at || 'N/A',
        last_login: user.last_login || 'Never',
        success: successMessage,
        error: errorMessage
    });
});

router.post('/profile', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.render('error', { message: 'You must be logged in to update your profile.', back: '/login' });
    }

    const { display_name, email, color } = req.body;
    const userId = req.session.userId;
    // Make sure email not taken
    const existingEmailUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (existingEmailUser) {
        return res.redirect('/profile?error=Email is already in use by another account.');
    }

    try {
        //update user profile stmt
        const stmt = db.prepare('UPDATE users SET display_name = ?, email = ?, color = ? WHERE id = ?');
        stmt.run(display_name, email, color, userId);
        res.redirect('/profile?success=Profile updated successfully!');
    } catch (error) {
        console.error('Profile update error:', error);
        res.redirect('/profile?error=Failed to update profile.');
    }
});

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        
        if (!user) {
            // Don't reveal that the user doesn't exist
            return res.render('forgot-password', { success: 'If an account with that email exists, a password reset link has been sent.' });
        }
        // Generate reset token
        const token = crypto.randomBytes(20).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour
        // Store token and expiration in database
        db.prepare('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?')
            .run(token, expires, user.id);
        // Send password reset email
        await sendPasswordResetEmail(email, token);

        res.render('forgot-password', { success: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('forgot-password', { error: 'An error occurred. Please try again.' });
    }
});

// Render password reset form page

router.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    // Find user with matching token that hasn't expired
    const user = db.prepare('SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > ?')
        .get(token, Date.now());

    if (!user) {
        return res.render('error', { message: 'Password reset token is invalid or has expired.', back: '/forgot-password' });
    }

    res.render('reset-password', { token });
});
// Handle password reset form submission
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password, confirm_password } = req.body;

    if (password !== confirm_password) {
        return res.render('reset-password', { token, error: 'Passwords do not match.' });
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
        return res.render('reset-password', { token, error: 'Password does not meet requirements: ' + validation.errors.join(', ') });
    }

    try {
        // Find user with matching token that hasn't expired
        const user = db.prepare('SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > ?')
            .get(token, Date.now());

        if (!user) {
            return res.render('error', { message: 'Password reset token is invalid or has expired.', back: '/forgot-password' });
        }

        const passwordHash = await hashPassword(password);
        // Update user's password and clear reset token
        db.prepare('UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?')
            .run(passwordHash, user.id);

        res.render('login', { success: 'Password has been reset successfully. Please login.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.render('reset-password', { token, error: 'An error occurred. Please try again.' });
    }
});

module.exports = router;
