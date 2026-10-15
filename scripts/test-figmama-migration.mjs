import assert from 'node:assert/strict';
import {retirementAction} from '../lib/figmama-retirement.mjs';
import {legacyDownloadSelection} from '../lib/legacy-archive.mjs';
for(const path of ['/bmonly','/bmonly/','/bmonly/edit','/bmonly/article','/s/old/bmonly','/%62monly/edit','//bmonly/edit']) {
  for(const method of ['GET','POST','HEAD']) for(const archive of [false,true]) assert.equal(retirementAction(path,method,archive).status,403);
}
for(const path of ['/','/easy','/edit','/api/jobs','/api/share','/api/download','/s/existing-id']) assert.equal(retirementAction(path).kind,'preserve');
const keys=['cards/old-id/0_a.jpg','cards/old-id/0_b.jpg','cards/other-id/0_z.jpg','cards/old-id/1_z.jpg','cards/old-id/0_a.mp4'];
assert.equal(legacyDownloadSelection(keys,'old-id',0,'jpg'),'cards/old-id/0_b.jpg');
for(const args of [['old-id',0,'png'],['../other-id',0,'jpg'],['old-id',0,'../jpg'],['old-id',-1,'jpg']]) assert.equal(legacyDownloadSelection(keys,...args),null);
console.log('Closed BM-only entry and preserved legacy data selection passed.');
