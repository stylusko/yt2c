export function blockedWebPath(pathname) {
  let path;
  try { path=decodeURIComponent(pathname).replace(/\\/g,'/').replace(/\/{2,}/g,'/').replace(/\/$/,'').toLowerCase() || '/'; } catch { return true; }
  return path==='/bmonly' || path.startsWith('/bmonly/') || /^\/s\/[^/]+\/bmonly(?:\/|$)/.test(path);
}
export function sameOrigin(origin, expected) {
  try { return new URL(origin).origin===new URL(expected).origin; } catch {return false;}
}
