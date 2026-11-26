const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { query } = require('./db');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const localFiles = require('./lib/localFiles');

const app = express();

app.use(helmet());
// In production the browser talks to CloudFront only (same origin), so CORS only matters for local dev.
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));
// Express 5 leaves req.body undefined when a request has no body.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'));

// Liveness: used by the ALB target group, Docker HEALTHCHECK and the deploy pipeline.
// Always 200 while the process runs, so a database blip never gets healthy instances replaced.
app.get('/api/health', async (req, res) => {
  let db = false;
  try {
    await query('SELECT 1');
    db = true;
  } catch {
    /* reported below */
  }
  res.json({ status: 'ok', db });
});

// Readiness: 503 when the database cannot be reached. Handy for a post-deploy check.
app.get('/api/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/local-files', localFiles.router);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Something went wrong on our side' : err.message });
});

module.exports = app;
