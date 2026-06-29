import { query, isDatabaseConfigured } from './postgres.js';

export { isDatabaseConfigured };

export function projectRowToDto(row, includeSnapshot = false) {
  if (!row) return null;
  const dto = {
    id: row.id,
    title: row.title,
    projectType: row.project_type || 'video',
    sourceType: row.source_type || 'youtube',
    brand: row.brand || '',
    pageVariant: row.page_variant || 'default',
    thumbnailUrl: row.thumbnail_url || '',
    cardCount: row.card_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeSnapshot) dto.snapshot = row.latest_snapshot || null;
  return dto;
}

export function outputRowToDto(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    outputType: row.output_type,
    status: row.status,
    title: row.title || '',
    thumbnailUrl: row.thumbnail_url || '',
    files: row.files || [],
    cardCount: row.card_count || 0,
    sourceHash: row.source_hash || '',
    createdAt: row.created_at,
  };
}

export function normalizeProjectInput(body = {}) {
  const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null;
  const title = String(body.title || snapshot?.name || '새 프로젝트').trim().slice(0, 120) || '새 프로젝트';
  const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
  const sourceType = String(body.sourceType || snapshot?.sourceType || 'youtube').slice(0, 40);
  const pageVariant = String(body.pageVariant || snapshot?.pageVariant || 'default').slice(0, 40);
  return {
    title,
    project_type: String(body.projectType || (sourceType === 'article' ? 'text' : 'video')).slice(0, 40),
    source_type: sourceType,
    brand: String(body.brand || (pageVariant === 'bmonly' ? 'baemin-only' : '')).slice(0, 80),
    page_variant: pageVariant,
    thumbnail_url: String(body.thumbnailUrl || '').slice(0, 2048),
    card_count: Number.isFinite(Number(body.cardCount)) ? Number(body.cardCount) : cards.length,
    latest_snapshot: snapshot,
  };
}

export function normalizePatchInput(body = {}) {
  const patch = {};
  if (body.title !== undefined) patch.title = String(body.title || '새 프로젝트').trim().slice(0, 120) || '새 프로젝트';
  if (body.projectType !== undefined) patch.project_type = String(body.projectType || 'video').slice(0, 40);
  if (body.sourceType !== undefined) patch.source_type = String(body.sourceType || 'youtube').slice(0, 40);
  if (body.brand !== undefined) patch.brand = String(body.brand || '').slice(0, 80);
  if (body.pageVariant !== undefined) patch.page_variant = String(body.pageVariant || 'default').slice(0, 40);
  if (body.thumbnailUrl !== undefined) patch.thumbnail_url = String(body.thumbnailUrl || '').slice(0, 2048);
  if (body.cardCount !== undefined) patch.card_count = Number(body.cardCount) || 0;
  if (body.snapshot && typeof body.snapshot === 'object') {
    patch.latest_snapshot = body.snapshot;
    if (patch.card_count === undefined) patch.card_count = Array.isArray(body.snapshot.cards) ? body.snapshot.cards.length : 0;
    if (patch.title === undefined) patch.title = String(body.snapshot.name || '새 프로젝트').trim().slice(0, 120) || '새 프로젝트';
    if (patch.source_type === undefined) patch.source_type = String(body.snapshot.sourceType || 'youtube').slice(0, 40);
  }
  return patch;
}

export function sanitizeOutputFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter(file => file && typeof file === 'object')
    .map((file, index) => {
      const bucketKey = String(file.bucketKey || '');
      const safeBucketKey = bucketKey.startsWith('cards/') && !bucketKey.includes('..') ? bucketKey : '';
      return {
        cardIdx: Number.isFinite(Number(file.cardIdx)) ? Number(file.cardIdx) : index,
        bucketKey: safeBucketKey,
        url: String(file.url || '').slice(0, 4096),
        ext: String(file.ext || '').slice(0, 12),
        fileName: String(file.fileName || '').slice(0, 160),
      };
    })
    .filter(file => file.bucketKey || file.url);
}

export async function upsertUserFromSession(session) {
  const email = String(session?.user?.email || '').trim().toLowerCase();
  if (!email) return null;
  const name = String(session?.user?.name || '').slice(0, 160);
  const image = String(session?.user?.image || '').slice(0, 2048);
  const result = await query(
    `insert into app_users (provider, provider_account_id, email, name, image)
     values ('google', $1, $1, $2, $3)
     on conflict (email) do update
       set name = excluded.name,
           image = excluded.image,
           updated_at = now()
     returning id, provider, provider_account_id, email, name, image, created_at, updated_at`,
    [email, name, image],
  );
  return result.rows[0] || null;
}

export async function listProjects(userId) {
  const result = await query(
    `select id, title, project_type, source_type, brand, page_variant, thumbnail_url, card_count, created_at, updated_at
       from projects
      where user_id = $1 and archived_at is null
      order by updated_at desc
      limit 100`,
    [userId],
  );
  return result.rows.map(row => projectRowToDto(row));
}

export async function createProject(userId, input) {
  const result = await query(
    `insert into projects
      (user_id, title, project_type, source_type, brand, page_variant, thumbnail_url, card_count, latest_snapshot)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     returning id, title, project_type, source_type, brand, page_variant, thumbnail_url, card_count, created_at, updated_at, latest_snapshot`,
    [
      userId,
      input.title,
      input.project_type,
      input.source_type,
      input.brand,
      input.page_variant,
      input.thumbnail_url,
      input.card_count,
      JSON.stringify(input.latest_snapshot),
    ],
  );
  return projectRowToDto(result.rows[0], true);
}

export async function getProject(userId, projectId) {
  const result = await query(
    `select id, title, project_type, source_type, brand, page_variant, thumbnail_url, card_count, created_at, updated_at, latest_snapshot
       from projects
      where user_id = $1 and id = $2 and archived_at is null
      limit 1`,
    [userId, projectId],
  );
  return projectRowToDto(result.rows[0], true);
}

export async function updateProject(userId, projectId, patch) {
  const entries = Object.entries(patch || {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return getProject(userId, projectId);
  const values = [];
  const assignments = entries.map(([key, value], index) => {
    values.push(key === 'latest_snapshot' ? JSON.stringify(value) : value);
    return key === 'latest_snapshot'
      ? `${key} = $${index + 1}::jsonb`
      : `${key} = $${index + 1}`;
  });
  values.push(userId, projectId);
  const result = await query(
    `update projects
        set ${assignments.join(', ')}, updated_at = now()
      where user_id = $${values.length - 1}
        and id = $${values.length}
        and archived_at is null
      returning id, title, project_type, source_type, brand, page_variant, thumbnail_url, card_count, created_at, updated_at, latest_snapshot`,
    values,
  );
  return projectRowToDto(result.rows[0], true);
}

export async function archiveProject(userId, projectId) {
  const result = await query(
    `update projects
        set archived_at = now(), updated_at = now()
      where user_id = $1 and id = $2 and archived_at is null
      returning id`,
    [userId, projectId],
  );
  return result.rowCount > 0;
}

export async function ensureProjectOwner(userId, projectId) {
  const result = await query(
    `select id from projects where user_id = $1 and id = $2 and archived_at is null limit 1`,
    [userId, projectId],
  );
  return !!result.rows[0];
}

export async function listOutputs(userId, projectId) {
  const result = await query(
    `select id, project_id, output_type, status, title, thumbnail_url, files, card_count, source_hash, created_at
       from generated_outputs
      where user_id = $1 and project_id = $2
      order by created_at desc
      limit 50`,
    [userId, projectId],
  );
  return result.rows.map(outputRowToDto);
}

export async function createOutput(userId, projectId, body, files) {
  const result = await query(
    `insert into generated_outputs
      (user_id, project_id, output_type, status, title, thumbnail_url, files, card_count, source_hash)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
     returning id, project_id, output_type, status, title, thumbnail_url, files, card_count, source_hash, created_at`,
    [
      userId,
      projectId,
      String(body.outputType || 'cards').slice(0, 40),
      String(body.status || 'completed').slice(0, 40),
      String(body.title || '').slice(0, 160),
      String(body.thumbnailUrl || '').slice(0, 2048),
      JSON.stringify(files),
      Number(body.cardCount) || files.length,
      String(body.sourceHash || '').slice(0, 160),
    ],
  );
  return outputRowToDto(result.rows[0]);
}
