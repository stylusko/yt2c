const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id);
export function legacyDownloadSelection(keys, id, index, extension) {
  if (!validId(id) || !Number.isInteger(index) || index < 0 || index > 9999 || !['jpg','jpeg','png','webp','mp4'].includes(extension)) return null;
  const prefix = `cards/${id}/${index}_`;
  return keys.filter(key => typeof key === 'string' && key.startsWith(prefix) && key.endsWith('.'+extension) && !key.includes('..')).sort().at(-1) || null;
}
export async function legacyDownloadURL(id, index, extension) {
  if (!validId(id) || !Number.isInteger(index) || index < 0 || index > 9999 || !['jpg','jpeg','png','webp','mp4'].includes(extension)) return null;
  const {listKeys, getDownloadUrl} = await import('./bucket.js');
  const key = legacyDownloadSelection(await listKeys(`cards/${id}/${index}_`), id, index, extension);
  return key ? getDownloadUrl(key, 3600, `card-${index+1}.${extension}`) : null;
}
export async function legacyShare(id) {
  if (!validId(id)) return null;
  if(process.env.YOUMECA_BACKEND==='firebase') {const {readFirebaseObject}=await import('./firebase-runtime.mjs');return (await readFirebaseObject('legacy-shares/'+id+'.txt'))?.toString()||null;}
  const {getDownloadUrl} = await import('./bucket.js');
  const url = await getDownloadUrl(`legacy-shares/${id}.txt`);
  if (!url) return null;
  const response = await fetch(url, {signal: AbortSignal.timeout(60000)});
  if (response.status === 404) return null;
  if (!response.ok || Number(response.headers.get('content-length') || 0) > 50_000_000) throw new Error('기존 프로젝트 보관본을 읽을 수 없습니다.');
  return response.text();
}
