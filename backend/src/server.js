require('dotenv').config();
const app = require('./app');
const db = require('./db');
const { migrate } = require('./db/migrate');

const PORT = process.env.PORT || 5000;

async function start() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    console.error('DATABASE_URL and JWT_SECRET must be set');
    process.exit(1);
  }
  await migrate(); // creates or updates tables before accepting traffic
  console.log('Database ready');

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`API listening on ${PORT}`));

  const shutdown = () => server.close(() => db.close().then(() => process.exit(0)));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
