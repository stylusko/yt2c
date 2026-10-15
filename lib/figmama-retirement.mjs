export const FIGMAMA_URL = 'https://youmeca.web.app/bmonly';
const entryRoutes = new Set(['/', '/easy', '/edit', '/ai-edit', '/bmonly']);
const generationRoutes = new Set([
  '/api/bucket-status', '/api/ai-edit', '/api/ai-rewrite', '/api/extract-article',
  '/api/generate-cards-from-article', '/api/recommend-baemin-layouts',
  '/api/regenerate-article-image', '/api/subtitle', '/api/video-duration',
  '/api/video-info', '/api/frame', '/api/telegram', '/api/admin/clear-image-cache',
]);
export function retirementAction(pathname, method = 'GET', archive = false) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (generationRoutes.has(path)) return {kind: 'closed', status: 410, destination: FIGMAMA_URL};
  if ((path === '/api/jobs' || path.startsWith('/api/jobs/') || path === '/api/share' || path.startsWith('/api/share/')) && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return {kind: 'closed', status: 410, destination: FIGMAMA_URL};
  }
  if (!archive && (entryRoutes.has(path) || path.startsWith('/bmonly/'))) return {kind: 'redirect', status: 307, destination: FIGMAMA_URL};
  return {kind: 'preserve'};
}
