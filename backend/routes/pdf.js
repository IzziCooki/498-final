const express = require('express');
const router = express.Router();
const path = require('path');
// File upload handling
const multer = require('multer');
// Markdown parsing
const { marked } = require('marked');
const db = require('../database');
const { requireAuth } = require('../modules/auth-middleware');
const { isPdfOwner } = require('../modules/auth-middleware');
const { getPagination } = require('../modules/pagination-utils');

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
// upload.single middleware processes the uploaded file
router.post('/add', requireAuth, upload.single('pdfFile'), (req, res) => {
    try {
        const { filename, path: filePath } = req.file;
        const { title, description, author, is_public } = req.body;
        const userId = req.session.userId;
        // is_public checkbox 
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
        // Pagination setup
        const page = req.query.page || 1;
        // 6 items per page for grid view
        const limit = 6;

        const countStmt = db.prepare('SELECT COUNT(*) as count FROM pdfs WHERE is_public = 1');
        const totalItems = countStmt.get().count;
        // Get pagination details
        const pagination = getPagination(page, limit, totalItems);
        // Fetch only paginated public PDFs
        const pdfs = db.prepare('SELECT * FROM pdfs WHERE is_public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?')
            .all(pagination.itemsPerPage, pagination.offset);

        res.render('sharedPdfs', { pdfs, pagination });
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

        const page = req.query.page || 1;
        const limit = 5; // 5 comments per page

        const countStmt = db.prepare('SELECT COUNT(*) as count FROM comments WHERE pdf_id = ?');
        const totalItems = countStmt.get(pdfId).count;

        const pagination = getPagination(page, limit, totalItems);

        // Fetch comments with vote count and user's vote
        // 
        const comments = db.prepare(`
            SELECT c.*, u.display_name as display_name,
            (SELECT COALESCE(SUM(vote_value), 0) FROM comment_votes WHERE comment_id = c.id) as vote_count,
            (SELECT vote_value FROM comment_votes WHERE comment_id = c.id AND user_id = ?) as user_vote
            FROM comments c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.pdf_id = ? 
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.session.userId, pdfId, pagination.itemsPerPage, pagination.offset);

        // Process comments (markdown + ownership + vote status)
        const processedComments = comments.map(c => ({
            ...c,
            comment_text: marked.parse(c.comment_text),
            isOwner: c.user_id === req.session.userId,
            profile_color: '#6d28d9',
            profile_icon: '👤',
            isUpvoted: c.user_vote === 1,
            isDownvoted: c.user_vote === -1
        }));

        res.render('viewPdf', { 
            pdf, 
            comments: processedComments,
            isPdfOwner: pdf.user_id === req.session.userId,
            pagination
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
        const page = req.query.page || 1;
        const limit = 6; // 6 items per page for grid view

        const countStmt = db.prepare('SELECT COUNT(*) as count FROM pdfs WHERE user_id = ?');
        const totalItems = countStmt.get(userId).count;

        const pagination = getPagination(page, limit, totalItems);

        const pdfs = db.prepare('SELECT * FROM pdfs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
            .all(userId, pagination.itemsPerPage, pagination.offset);

        res.render('viewPdfs', { pdfs, pagination });
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
            db.prepare('UPDATE comments SET comment_text = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(comment_text, commentId);
            res.redirect(`/pdfs/view/${comment.pdf_id}`);
        } else {
            res.status(403).send('Unauthorized');
        }
    } catch (error) {
        console.error('Error editing comment:', error);
        res.redirect('back');
    }
});

// Vote on Comment
router.post('/comment/vote/:id/:type', requireAuth, (req, res) => {
    try {
        const commentId = req.params.id;
        const type = req.params.type; // 'up' or 'down'
        const userId = req.session.userId;
        const voteValue = type === 'up' ? 1 : -1;

        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
        if (!comment) {
            return res.status(404).send('Comment not found');
        }

        // Check if user already voted
        const existingVote = db.prepare('SELECT * FROM comment_votes WHERE user_id = ? AND comment_id = ?').get(userId, commentId);

        if (existingVote) {
            if (existingVote.vote_value === voteValue) {
                // Same vote: remove it (toggle off)
                db.prepare('DELETE FROM comment_votes WHERE id = ?').run(existingVote.id);
            } else {
                // Different vote: update it
                db.prepare('UPDATE comment_votes SET vote_value = ? WHERE id = ?').run(voteValue, existingVote.id);
            }
        } else {
            // New vote
            db.prepare('INSERT INTO comment_votes (user_id, comment_id, vote_value) VALUES (?, ?, ?)').run(userId, commentId, voteValue);
        }

        res.redirect(`/pdfs/view/${comment.pdf_id}`);
    } catch (error) {
        console.error('Error voting on comment:', error);
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
