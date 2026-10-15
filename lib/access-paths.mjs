export function blockedWebPath(pathname) {
  let path;
  try { path=decodeURIComponent(pathname).replace(/\\/g,'/').replace(/\/{2,}/g,'/').replace(/\/$/,'').toLowerCase() || '/'; } catch { return true; }
  return path==='/bmonly' || path.startsWith('/bmonly/') || /^\/s\/[^/]+\/bmonly(?:\/|$)/.test(path);
}
export function sameOrigin(origin, expected) {
  try {const actual=new URL(origin).origin;return String(expected).split(',').some(value=>actual===new URL(value.trim()).origin);} catch {return false;}
}
