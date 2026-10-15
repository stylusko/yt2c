import {firebaseBucket,objectName,validObjectKey} from '../../../lib/firebase-runtime.mjs';
export const config={api:{bodyParser:false,responseLimit:false}};
export default async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method))return res.status(405).end();
  const key=req.query.key;
  if(!validObjectKey(key)||!['cards/','article-images/','ai-images/'].some(prefix=>key.startsWith(prefix)))return res.status(403).end();
  try {
    const file=firebaseBucket().file(objectName(key));const [metadata]=await file.getMetadata();
    const size=Number(metadata.size);let start=0,end=size-1;
    if(req.headers.range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||!match[1]&&!match[2]){res.setHeader('Content-Range','bytes */'+size);return res.status(416).end();}
      start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));end=match[1]&&match[2]?Math.min(end,Number(match[2])):end;
      if(start>=size||end<start){res.setHeader('Content-Range','bytes */'+size);return res.status(416).end();}
      res.status(206).setHeader('Content-Range','bytes '+start+'-'+end+'/'+size);
    }
    res.setHeader('Content-Type',metadata.contentType||'application/octet-stream');res.setHeader('Content-Length',end-start+1);res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','private, no-store');
    if(req.query.filename)res.setHeader('Content-Disposition','attachment; filename="'+String(req.query.filename).replace(/[^a-zA-Z0-9_.-]/g,'_')+'"');
    if(req.method==='HEAD')return res.end();
    const stream=file.createReadStream({start,end,decompress:false});stream.on('error',()=>{if(!res.headersSent)res.status(503).end();else res.destroy();});stream.pipe(res);
  }catch(e) {return res.status(e.code===404?404:503).end();}
}
