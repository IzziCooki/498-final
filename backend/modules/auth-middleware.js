// modules/auth-middleware.js


//Middleware to check if the user is authenticated

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).render('unauthorized');
}
//Check if the logged-in user is the owner of the PDF
function isPdfOwner(req, res, next) {
    const db = require('../database');
    const pdfId = req.params.id;
    const userId = req.session.userId;

    const pdf = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(pdfId);

    if (!pdf) {
        return res.status(404).render('error', { message: 'PDF not found.' });
    }
    // if the logged-in user is not the owner of the PDF, deny access
    if (pdf.user_id !== userId) {
        return res.status(403).render('forbidden');
    }

    next();
}

module.exports = {
    requireAuth,
    isPdfOwner
};
