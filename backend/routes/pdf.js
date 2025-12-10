const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');
const { requireAuth } = require('../modules/auth-middleware');

router.get('/', requireAuth, (req, res) => {
    try {
        const pdfs = db.prepare('SELECT * FROM pdfs WHERE user_id = ?').all(req.session.userId);
        res.render('viewPdfs', { pdfs });
    } catch (error) {
        console.error('Error fetching PDFs:', error);
        res.render('error', { message: 'Error fetching PDFs.' });
    }
});

router.get('/:filename', requireAuth, (req, res) => {
    try {
        const pdf = db.prepare('SELECT * FROM pdfs WHERE filename = ? AND user_id = ?').get(req.params.filename, req.session.userId);
        if (pdf) {
            res.sendFile(pdf.filepath);
        } else {
            res.status(404).render('error', { message: 'PDF not found.' });
        }
    } catch (error) {
        console.error('Error serving PDF:', error);
        res.render('error', { message: 'Error serving PDF.' });
    }
});

router.get('/download/:filename', requireAuth, (req, res) => {
    try {
        const pdf = db.prepare('SELECT * FROM pdfs WHERE filename = ? AND user_id = ?').get(req.params.filename, req.session.userId);
        if (pdf) {
            res.download(pdf.filepath, pdf.filename);
        } else {
            res.status(404).render('error', { message: 'PDF not found.' });
        }
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.render('error', { message: 'Error downloading PDF.' });
    }
});

module.exports = router;
