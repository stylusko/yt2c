import {firebaseBackend,legacyRef,firebaseBucket} from '../../lib/firebase-runtime.mjs';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');if(!firebaseBackend())return res.status(404).end();
  try {await Promise.all([legacyRef('migration/meta').get(),firebaseBucket().getFiles({prefix:'legacy/bucket/',maxResults:1,autoPaginate:false})]);return res.json({ok:true,service:'youmeca',backend:'firebase',videoCreation:false});}
  catch {return res.status(503).json({ok:false});}
}
