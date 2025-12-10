const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { requireAuth } = require('../modules/auth-middleware');

const pdfFolder = path.join(__dirname, '..', 'pdfs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, pdfFolder);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});

router.get('/', requireAuth, (req, res) => {
    res.render('addPdf');
});

router.post('/', requireAuth, upload.single('pdfFile'), (req, res) => {
    try {
        const { filename, path: filePath } = req.file;
        const { title, description, author } = req.body;
        const userId = req.session.userId;

        const stmt = db.prepare('INSERT INTO pdfs (user_id, filename, filepath, title, description, author) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(userId, filename, filePath, title, description, author);

        res.redirect('/viewPdfs');
    } catch (error) {
        console.error('Error adding PDF to database:', error);
        res.render('addPdf', { error: 'Error adding PDF to database: ' + error.message });
    }
});

module.exports = router;