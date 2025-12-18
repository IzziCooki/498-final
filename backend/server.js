const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');

const authRoutes = require('./routes/auth');
const pdfRoutes = require('./routes/pdf');
const { requireAuth } = require('./modules/auth-middleware');
const SQLiteStore = require('./sqlite-session-store');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
const sessionMiddleware = session({
    store: new SQLiteStore({
        db: path.join(__dirname, 'sessions.db'),
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

app.use(sessionMiddleware);

// Make user available to all views
app.use((req, res, next) => {
    if (req.session.userId) {
        const user = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(req.session.userId);
        res.locals.user = user;
    } else {
        res.locals.user = null;
    }
    next();
});

// Share session with socket.io
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.userId) {
        next();
    } else {
        next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    console.log('A user connected');
    const userId = socket.request.session.userId;
    
    // Get user info
    const user = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(userId);

    socket.on('chat message', (msg) => {
        if (!msg) return;
        
        // Save to DB
        const stmt = db.prepare('INSERT INTO messages (user_id, message) VALUES (?, ?)');
        const info = stmt.run(userId, msg);
        
        // Broadcast to all clients
        io.emit('chat message', {
            message: msg,
            display_name: user.display_name,
            created_at: new Date(),
            profile_color: '#6d28d9', // Default color
            profile_icon: '👤'
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Handlebars setup
app.engine('hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layout'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', authRoutes);
app.use('/pdfs', pdfRoutes); // Mount PDF routes under /pdfs

app.get('/', requireAuth, (req, res) => {
    res.render('home');
});

app.get('/chat', requireAuth, (req, res) => {
    res.render('chat'); 
});

app.get('/api/chat/history', requireAuth, (req, res) => {
    const messages = db.prepare(`
        SELECT m.message, m.created_at, u.display_name as display_name, u.color as profile_color
        FROM messages m 
        JOIN users u ON m.user_id = u.id 
        ORDER BY m.created_at ASC
    `).all();
    
    // Format for frontend
    const formatted = messages.map(m => ({
        ...m,
        profile_color: m.profile_color || '#6d28d9',
        profile_icon: '👤'
    }));
    
    res.json(formatted);
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});
