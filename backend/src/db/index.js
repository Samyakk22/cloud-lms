const { Pool } = require('pg');

let pool;

// Created lazily so tests and tooling can load the app without a database.
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // RDS enforces TLS. DB_SSL=true turns it on (use the RDS CA bundle for strict verification).
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  }
  return pool;
}

const query = (text, params) => getPool().query(text, params);

async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function close() {
  if (pool) {
    const p = pool;
    pool = undefined;
    await p.end();
  }
}

module.exports = { getPool, query, transaction, close };
