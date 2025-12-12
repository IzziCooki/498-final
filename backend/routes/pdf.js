const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { marked } = require('marked');
const db = require('../database');
const { requireAuth } = require('../modules/auth-middleware');
const { isPdfOwner } = require('../modules/auth-middleware');

const pdfFolder = path.join(__dirname, '..', 'pdfs');

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, pdfFolder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
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

// Add PDF Form
router.get('/add', requireAuth, (req, res) => {
    res.render('addPdf');
});

// Handle Add PDF
router.post('/add', requireAuth, upload.single('pdfFile'), (req, res) => {
    try {
        const { filename, path: filePath } = req.file;
        const { title, description, author, is_public } = req.body;
        const userId = req.session.userId;
        const isPublicValue = is_public ? 1 : 0;

        const stmt = db.prepare('INSERT INTO pdfs (user_id, filename, filepath, title, description, author, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)');
        stmt.run(userId, filename, filePath, title, description, author, isPublicValue);

        res.redirect('/pdfs');
    } catch (error) {
        console.error('Error adding PDF:', error);
        res.render('addPdf', { error: 'Error adding PDF: ' + error.message });
    }
});

// Shared PDFs
router.get('/shared', requireAuth, (req, res) => {
    try {
        const pdfs = db.prepare('SELECT * FROM pdfs WHERE is_public = 1 ORDER BY created_at DESC').all();
        res.render('sharedPdfs', { pdfs });
    } catch (error) {
        console.error('Error fetching shared PDFs:', error);
        res.render('error', { message: 'Error fetching shared PDFs.' });
    }
});

// View PDF Details & Comments
router.get('/view/:id', requireAuth, (req, res) => {
    try {
        const pdfId = req.params.id;
        const pdf = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(pdfId);
        
        if (!pdf) {
            return res.status(404).render('error', { message: 'PDF not found.' });
        }

        // Check permissions: Owner or Public
        if (pdf.user_id !== req.session.userId && !pdf.is_public) {
            return res.status(403).render('forbidden');
        }

        // Fetch comments
        const comments = db.prepare(`
            SELECT c.*, u.username as display_name 
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.pdf_id = ? 
            ORDER BY c.created_at DESC
        `).all(pdfId);

        // Process comments (markdown + ownership)
        const processedComments = comments.map(c => ({
            ...c,
            comment_text: marked.parse(c.comment_text),
            isOwner: c.user_id === req.session.userId,
            profile_color: '#6d28d9',
            profile_icon: '👤'
        }));

        res.render('viewPdf', { 
            pdf, 
            comments: processedComments,
            isPdfOwner: pdf.user_id === req.session.userId,
            pagination: { hasPrevious: false, hasNext: false } // TODO: Implement pagination
        });
    } catch (error) {
        console.error('Error viewing PDF:', error);
        res.render('error', { message: 'Error viewing PDF.' });
    }
});

// Toggle Share Status
router.post('/toggle-share/:id', requireAuth, (req, res) => {
    try {
        const pdfId = req.params.id;
        const userId = req.session.userId;

        const pdf = db.prepare('SELECT * FROM pdfs WHERE id = ?').get(pdfId);
        if (!pdf) {
            return res.status(404).render('error', { message: 'PDF not found.' });
        }

        if (pdf.user_id !== userId) {
            return res.status(403).render('forbidden');
        }

        const newStatus = pdf.is_public ? 0 : 1;
        db.prepare('UPDATE pdfs SET is_public = ? WHERE id = ?').run(newStatus, pdfId);

        res.redirect(`/pdfs/view/${pdfId}`);
    } catch (error) {
        console.error('Error toggling share status:', error);
        res.redirect('back');
    }
});

// Add Comment
router.post('/comment/:id', requireAuth, (req, res) => {
    try {
        const pdfId = req.params.id;
        const { comment_text } = req.body;
        const userId = req.session.userId;

        const stmt = db.prepare('INSERT INTO comments (pdf_id, user_id, comment_text) VALUES (?, ?, ?)');
        stmt.run(pdfId, userId, comment_text);

        res.redirect(`/pdfs/view/${pdfId}`);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.redirect(`/pdfs/view/${req.params.id}`);
    }
});

// Delete Comment
router.post('/comment/delete/:id', requireAuth, (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.session.userId;
        
        // Check ownership
        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
        if (comment && comment.user_id === userId) {
            db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
            res.redirect(`/pdfs/view/${comment.pdf_id}`);
        } else {
            res.status(403).send('Unauthorized');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.redirect('back');
    }
});
// User specific PDF list
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = req.session.userId;
        const pdfs = db.prepare('SELECT * FROM pdfs WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        res.render('viewPdfs', { pdfs });
    } catch (error) {
        console.error('Error fetching PDFs:', error);
        res.render('error', { message: 'Error fetching PDFs.' });
    }
});


// Edit Comment
router.post('/comment/edit/:id', requireAuth,  (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.session.userId;
        const { comment_text } = req.body;

        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
        if (comment && comment.user_id === userId) {
            db.prepare('UPDATE comments SET comment_text = ? WHERE id = ?').run(comment_text, commentId);
            res.redirect(`/pdfs/view/${comment.pdf_id}`);
        } else {
            res.status(403).send('Unauthorized');
        }
    } catch (error) {
        console.error('Error editing comment:', error);
        res.redirect('back');
    }
});

// Serve Raw PDF
router.get('/:filename', requireAuth, (req, res) => {
    try {
        const pdf = db.prepare('SELECT * FROM pdfs WHERE filename = ?').get(req.params.filename);
        if (pdf) {
            // Check ownership or public
            if (pdf.user_id !== req.session.userId && !pdf.is_public) {
                return res.status(403).render('forbidden');
            }
            res.sendFile(pdf.filepath);
        } else {
            res.status(404).render('error', { message: 'PDF not found.' });
        }
    } catch (error) {
        console.error('Error serving PDF:', error);
        res.render('error', { message: 'Error serving PDF.' });
    }
});

// Download PDF
router.get('/download/:filename', requireAuth, (req, res) => {
    try {
        const pdf = db.prepare('SELECT * FROM pdfs WHERE filename = ?').get(req.params.filename);
        if (pdf) {
            // Check ownership or public
            if (pdf.user_id !== req.session.userId && !pdf.is_public) {
                return res.status(403).render('forbidden');
            }
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
