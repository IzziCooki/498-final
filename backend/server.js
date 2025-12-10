const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const path = require('path');
const authRoutes = require('./routes/auth');
const addPdfRoutes = require('./routes/addPdf');
const pdfRoutes = require('./routes/pdf');
const { requireAuth } = require('./modules/auth-middleware');
const SQLiteStore = require('./sqlite-session-store');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
const sessionStore = new SQLiteStore({
    db: path.join(__dirname, 'sessions.db'),
    table: 'sessions'
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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
app.use('/auth', authRoutes);
app.use('/addPdf', addPdfRoutes);
app.use('/viewPdfs', pdfRoutes);

app.get('/', requireAuth, (req, res) => {
    res.render('home');
});

app.get('/home', requireAuth, (req, res) => {
    res.render('home');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    sessionStore.close();
    process.exit(0);
});
