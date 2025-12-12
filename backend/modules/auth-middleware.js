// modules/auth-middleware.js

/**
 * Middleware to check if user is authenticated
 * Returns 401 if not authenticated
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).render('unauthorized');
}

function isPdfOwner(req, res, next) {
    const db = require('../database');
    const pdfId = req.params.id;
    const userId = req.session.userId;

    const pdf = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(pdfId);

    if (!pdf) {
        return res.status(404).render('error', { message: 'PDF not found.' });
    }

    if (pdf.user_id !== userId) {
        return res.status(403).render('forbidden');
    }

    next();
}

module.exports = {
    requireAuth,
    isPdfOwner
};
