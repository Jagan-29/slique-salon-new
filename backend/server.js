const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const path     = require('path');

dotenv.config();

const app = express();

/* ── CORS ────────────────────────────────────────────────── */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, cb) {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    // In production allow all (Vercel preview URLs vary)
    if (process.env.NODE_ENV === 'production') return cb(null, true);
    cb(new Error('CORS: origin not allowed: ' + origin));
  },
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Serve static frontend (local dev) ───────────────────── */
app.use(express.static(path.join(__dirname, '../frontend')));

/* ── API routes ─────────────────────────────────────────── */
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/services',     require('./routes/services'));
app.use('/api/admin',        require('./routes/admin'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'OK', time: new Date().toISOString() })
);

/* ── SPA fallback ────────────────────────────────────────── */
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
);

/* ── DB + listen ─────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000 })
  .then(async () => {
    console.log('✅  MongoDB Atlas connected');
    await require('./config/seed')();
    app.listen(PORT, () => {
      console.log(`🚀  Server → http://localhost:${PORT}`);
      console.log(`📋  Admin  → admin@slique.com / admin123`);
    });
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
