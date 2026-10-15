import {randomUUID} from 'node:crypto';
import {firebaseApp,firebaseBucket,objectName,legacyRef,signedInUser} from './firebase-runtime.mjs';
const MAX_BYTES=52_428_800;
export async function prepareUpload(req,res) {
  if(req.method!=='POST')return res.status(405).end();
  const user=signedInUser(req),{purpose,bytes}=req.body||{};
  if(!user||!['share','jobs'].includes(purpose)||!Number.isInteger(bytes)||bytes<1||bytes>MAX_BYTES)return res.status(400).json({error:'업로드할 파일의 크기를 확인해 주세요. 최대 50MB입니다.'});
  const id=randomUUID(),key=purpose==='share'?'legacy-shares/'+id+'.txt':'job-submissions/'+id+'.json';
  try {
    const token=await firebaseApp().options.credential.getAccessToken();
    const response=await fetch('https://storage.googleapis.com/upload/storage/v1/b/youmeca.firebasestorage.app/o?uploadType=resumable&ifGenerationMatch=0',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',Origin:req.headers.origin,'X-Upload-Content-Type':'text/plain; charset=utf-8','X-Upload-Content-Length':String(bytes)},body:JSON.stringify({name:objectName(key),contentType:'text/plain; charset=utf-8',cacheControl:'private, no-store',metadata:{ownerUid:user.uid,purpose}}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Storage upload preparation failed');
    const uploadUrl=response.headers.get('location');if(!uploadUrl?.startsWith('https://storage.googleapis.com/'))throw Error('Invalid upload destination');
    await legacyRef('uploads/'+id).set({key,purpose,bytes,uid:user.uid,expiresAt:Date.now()+3600_000});
    return res.json({id,uploadUrl});
  }catch {return res.status(503).json({error:'파일 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}
}
export async function uploadedPayload(id,purpose,user) {
  if(!user||typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('업로드 요청을 확인해 주세요.');
  const value=(await legacyRef('uploads/'+id).get()).val();
  if(!value||value.uid!==user.uid||value.purpose!==purpose||value.expiresAt<Date.now())throw Error('업로드 시간이 만료되었거나 권한이 없습니다.');
  const file=firebaseBucket().file(objectName(value.key));const [meta]=await file.getMetadata();
  if(Number(meta.size)!==value.bytes||Number(meta.size)>MAX_BYTES||meta.metadata?.ownerUid!==user.uid||meta.metadata?.purpose!==purpose||meta.metadata?.firebaseStorageDownloadTokens)throw Error('업로드가 완료되지 않았습니다. 다시 시도해 주세요.');
  return {...value,file};
}
