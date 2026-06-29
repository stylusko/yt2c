import { isDatabaseConfigured, query } from './postgres.js';

export async function saveShareToPostgres(id, data) {
  if (!isDatabaseConfigured()) return false;
  await query(
    `insert into shared_projects (id, data)
     values ($1, $2)
     on conflict (id) do update
       set data = excluded.data,
           updated_at = now()`,
    [id, data],
  );
  return true;
}

export async function getShareFromPostgres(id) {
  if (!isDatabaseConfigured()) return null;
  const result = await query(
    `select data from shared_projects where id = $1 limit 1`,
    [id],
  );
  return result.rows[0]?.data || null;
}
