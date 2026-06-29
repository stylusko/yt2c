import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth-options.js';
import { isDatabaseConfigured, upsertUserFromSession } from './project-db.js';

export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (!isDatabaseConfigured()) {
    res.status(500).json({ error: 'Railway Postgres DATABASE_URL is not configured' });
    return null;
  }

  try {
    const user = await upsertUserFromSession(session);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    return user;
  } catch (error) {
    console.error('[auth] user upsert failed:', error.message);
    res.status(500).json({ error: 'Failed to load user' });
    return null;
  }
}
