import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function shouldUseSsl(databaseUrl) {
  if (process.env.PGSSL === 'true') return true;
  if (process.env.PGSSLMODE === 'require') return true;
  return /\bsslmode=require\b/i.test(databaseUrl);
}

export function isDatabaseConfigured() {
  return !!getDatabaseUrl();
}

export function getPool() {
  if (pool) return pool;
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    max: Number(process.env.PGPOOL_MAX || 5),
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function query(text, params = []) {
  const client = getPool();
  if (!client) {
    const error = new Error('Postgres is not configured');
    error.code = 'POSTGRES_NOT_CONFIGURED';
    throw error;
  }
  return client.query(text, params);
}
