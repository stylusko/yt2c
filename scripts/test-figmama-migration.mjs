import assert from 'node:assert/strict';
import {retirementAction, FIGMAMA_URL} from '../lib/figmama-retirement.mjs';
import {legacyDownloadSelection} from '../lib/legacy-archive.mjs';
for (const route of ['/', '/easy', '/edit', '/ai-edit', '/bmonly', '/bmonly/', '/bmonly/edit', '/bmonly/article']) {
  assert.deepEqual(retirementAction(route), {kind: 'redirect', status: 307, destination: FIGMAMA_URL});
}
for (const route of ['/bmonly/edit', '/', '/bmonly']) assert.equal(retirementAction(route, 'GET', true).kind, 'preserve');
for (const route of ['/api/jobs', '/api/share', '/api/jobs/existing-id', '/api/share/existing-id']) {
  assert.equal(retirementAction(route, 'GET').kind, 'preserve');
  assert.equal(retirementAction(route, 'POST').status, 410);
  assert.equal(retirementAction(route, 'DELETE', true).status, 410);
}
for (const route of ['/api/ai-edit', '/api/ai-rewrite', '/api/extract-article', '/api/generate-cards-from-article', '/api/regenerate-article-image', '/api/telegram', '/api/frame']) {
  assert.equal(retirementAction(route, 'POST', true).status, 410);
}
for (const route of ['/s/existing-id', '/s/existing-id/bmonly', '/api/download', '/api/queue/status', '/icon-round.png', '/_next/static/old.js']) {
  assert.equal(retirementAction(route).kind, 'preserve');
}
console.log('Figmama entry redirects, retired generation, read-only archive and existing share/download preservation passed.');
const keys=['cards/old-id/0_a.jpg','cards/old-id/0_b.jpg','cards/other-id/0_z.jpg','cards/old-id/1_z.jpg','cards/old-id/0_a.mp4'];
assert.equal(legacyDownloadSelection(keys,'old-id',0,'jpg'),'cards/old-id/0_b.jpg');
assert.equal(legacyDownloadSelection(keys,'old-id',0,'png'),null);
assert.equal(legacyDownloadSelection(keys,'../other-id',0,'jpg'),null);
assert.equal(legacyDownloadSelection(keys,'old-id',0,'../jpg'),null);
assert.equal(legacyDownloadSelection(keys,'old-id',-1,'jpg'),null);
