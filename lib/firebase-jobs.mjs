import {CloudTasksClient} from '@google-cloud/tasks';
import {OAuth2Client} from 'google-auth-library';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {legacyRef,writeFirebaseObject,readFirebaseObject,signedInUser} from './firebase-runtime.mjs';
const parent='projects/youmeca/locations/asia-southeast1/queues/youmeca-images';
const serviceAccount='youmeca-web@youmeca.iam.gserviceaccount.com';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(id);
export async function createImageJobs(req,res) {
  if(req.method!=='POST')return res.status(405).end();
  const {cards,outputSize=1080,outputFormat='jpg'}=req.body||{};
  if(!Array.isArray(cards)||!cards.length||cards.length>10)return res.status(400).json({error:'1~10장의 카드를 선택해 주세요.'});
  if(!['jpg','image','png'].includes(outputFormat)&&cards.some(c=>!c.backgroundData))return res.status(400).json({error:'영상 제작 기능은 제공하지 않습니다. 사진 또는 텍스트로 구성해 주세요.'});
  if(![540,720,1080,1440,2160].includes(Number(outputSize)))return res.status(400).json({error:'지원하지 않는 출력 크기입니다.'});
  for(const c of cards)if(typeof c.overlayData!=='string'||!/^data:image\/(png|webp);base64,/.test(c.overlayData)||c.overlayData.length>12_000_000)return res.status(400).json({error:'카드 이미지를 다시 준비해 주세요.'});
  const origin=process.env.YOUMECA_TASK_ORIGIN;if(!origin)return res.status(503).json({error:'이미지 생성 서버를 준비 중입니다.'});
  const jobId=randomUUID(),user=signedInUser(req),now=Date.now();
  const records=Object.fromEntries(cards.map((_,i)=>[i,{cardIdx:i,status:'waiting',progress:0}]));
  await legacyRef('jobs/'+jobId).set({createdAt:now,ownerUid:user?.uid||'',cards:records});
  const tasks=new CloudTasksClient();
  try {
    for(let i=0;i<cards.length;i++) {
      await writeFirebaseObject('job-inputs/'+jobId+'/'+i+'.json',Buffer.from(JSON.stringify({jobId,cardIdx:i,card:cards[i],outputSize:Number(outputSize)})),'application/json');
      await tasks.createTask({parent,task:{name:parent+'/tasks/'+jobId+'-'+i,httpRequest:{httpMethod:'POST',url:origin+'/api/internal/render',headers:{'Content-Type':'application/json'},body:Buffer.from(JSON.stringify({jobId,cardIdx:i})),oidcToken:{serviceAccountEmail:serviceAccount,audience:origin}},dispatchDeadline:{seconds:300}}});
    }
    return res.json({jobId,cardCount:cards.length,status:'queued',jobIds:cards.map((_,i)=>jobId+'-'+i)});
  }catch(e) {
    console.error('[firebase-image-dispatch] '+e.message);
    await legacyRef('jobs/'+jobId).update({dispatchError:true});
    return res.status(503).json({error:'생성 요청을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  }finally {await tasks.close();}
}
export async function imageJobStatus(req,res) {
  const {id,download,cardIdx,ext}=req.query;if(!validId(id))return res.status(400).end();
  if(req.method==='DELETE') {const ref=legacyRef('jobs/'+id);if(!(await ref.get()).exists())return res.status(404).end();await ref.update({cancelled:true});return res.json({jobId:id,cancelled:1});}
  if(req.method!=='GET')return res.status(405).end();
  if(download==='true') {
    const {legacyDownloadURL}=await import('./legacy-archive.mjs');
    const url=await legacyDownloadURL(id,Number(cardIdx),ext||'jpg');return url?res.redirect(307,url):res.status(404).json({error:'파일을 찾을 수 없습니다.'});
  }
  const value=(await legacyRef('jobs/'+id).get()).val();if(!value)return res.status(404).json({error:'생성 내역을 찾을 수 없습니다.'});
  const cards=Object.values(value.cards||{}).map(c=>({...c,...(c.status==='completed'?{downloadUrl:'/api/jobs/'+id+'?download=true&cardIdx='+c.cardIdx+'&ext=jpg'}:{})}));
  return res.json({jobId:id,cardCount:cards.length,cards:cards.sort((a,b)=>a.cardIdx-b.cardIdx)});
}
export async function imageQueueStatus(req,res) {
  if(req.method!=='GET')return res.status(405).end();
  const id=req.query.jobId,group=validId(id)?(await legacyRef('jobs/'+id).get()).val():null;
  const cards=Object.values(group?.cards||{});
  return res.json({waiting:cards.filter(c=>c.status==='waiting').length,active:cards.filter(c=>c.status==='active').length,delayed:0,concurrency:2,avgSecondsPerCard:0,estimatedWaitSeconds:0,...(group?{jobId:id,remainingCards:cards.filter(c=>!['completed','failed'].includes(c.status)).length}: {})});
}
export async function runImageTask(req,res) {
  if(req.method!=='POST')return res.status(405).end();
  const bearer=/^Bearer (.+)$/.exec(req.headers.authorization||'');
  try {const ticket=await new OAuth2Client().verifyIdToken({idToken:bearer?.[1]||'',audience:process.env.YOUMECA_TASK_ORIGIN});const p=ticket.getPayload();if(p.email!==serviceAccount||!p.email_verified)return res.status(403).end();}
  catch {return res.status(403).end();}
  const {jobId,cardIdx}=req.body||{};if(!validId(jobId)||!Number.isInteger(cardIdx)||cardIdx<0||cardIdx>9)return res.status(400).end();
  const ref=legacyRef('jobs/'+jobId+'/cards/'+cardIdx),group=(await legacyRef('jobs/'+jobId).get()).val();
  if(!group||group.cancelled)return res.status(204).end();
  const result=await ref.transaction(current=>current===null?null:current.status==='completed'||current.status==='active'&&current.startedAt>Date.now()-240_000?undefined:{...current,status:'active',progress:10,startedAt:Date.now()});
  if(!result.snapshot.exists())return res.status(204).end();
  if(!result.committed)return res.status(result.snapshot.val()?.status==='completed'?204:503).end();
  const directory=path.join('/tmp','youmeca-image-'+jobId+'-'+cardIdx);await fs.mkdir(directory,{recursive:true});
  try {
    const bytes=await readFirebaseObject('job-inputs/'+jobId+'/'+cardIdx+'.json');if(!bytes)throw Error('생성 원본을 찾지 못했습니다.');
    const input=JSON.parse(bytes.toString()),card=input.card;
    const overlay=Buffer.from(card.overlayData.split(',')[1],'base64');
    const overlayPath=path.join(directory,'overlay.png');await fs.writeFile(overlayPath,overlay);
    let bg;
    if(typeof card.backgroundData==='string'&&card.backgroundData.startsWith('data:image/'))bg=Buffer.from(card.backgroundData.split(',')[1],'base64');
    else if(typeof card.backgroundData==='string'&&/^https?:\/\//.test(card.backgroundData)) {
      const {fetchImageBufferDirectThenProxy}=await import('./article-extractor.js');
      bg=(await fetchImageBufferDirectThenProxy(card.backgroundData,{headers:{Referer:input.card.bgSourceUrl||new URL(card.backgroundData).origin+'/'},timeout:15000},'[firebase-image]')).buffer;
    }else bg=await sharp({create:{width:1080,height:1440,channels:4,background:'#ffffff'}}).png().toBuffer();
    if(bg.length>30_000_000)throw Error('사진 크기가 너무 큽니다.');
    const backgroundPath=path.join(directory,'background.png');await fs.writeFile(backgroundPath,bg);await ref.update({progress:35});
    const {processCard}=await import('./worker.js');
    const outputHash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
    const output=await processCard({jobId,cardIdx,cardConfig:card.cardConfig||{},url:'',overlayPath,backgroundPath,outputFormat:'jpg',outputSize:input.outputSize,outputHash});
    if(!output.bucketKey)throw Error('생성 파일을 저장하지 못했습니다.');
    if((await legacyRef('jobs/'+jobId+'/cancelled').get()).val())return res.status(204).end();
    await ref.update({status:'completed',progress:100,bucketKey:output.bucketKey,finishedAt:Date.now()});await fs.rm(output.outputPath,{force:true});return res.status(204).end();
  }catch(e) {
    // A failed task is visible to the user. Cloud Tasks may retry transient failures.
    const final=Number(req.headers['x-cloudtasks-taskretrycount']||0)>=2;
    await ref.update({status:final?'failed':'waiting',progress:final?100:0,error:final?'이미지를 생성하지 못했습니다. 다시 시도해 주세요.':'일시적인 오류로 다시 시도하고 있습니다.',finishedAt:Date.now()});console.error('[firebase-image] '+e.message);return res.status(500).end();
  }finally {await fs.rm(directory,{recursive:true,force:true});}
}
