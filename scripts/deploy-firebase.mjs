// Updates the existing, configured Firebase service without changing its secrets or access policy.
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const project='youmeca',region='asia-southeast1',service='youmeca-legacy';
function json(args){return JSON.parse(execFileSync('gcloud',[...args,'--project='+project,'--format=json'],{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:20_000_000}));}
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit'});assert.equal(result.status,0,command+' failed');}
const current=json(['run','services','describe',service,'--region='+region]);
assert.ok(current.spec.template.spec.containers[0].env.some(v=>v.name==='YOUMECA_BACKEND'&&v.value==='firebase'),'Expected the configured Firebase service');
assert.equal(current.spec.template.spec.serviceAccountName,'youmeca-web@youmeca.iam.gserviceaccount.com');
const build=json(['builds','submit','--config=cloudbuild.firebase.yaml','--region='+region,'.']);
assert.equal(build.status,'SUCCESS');
const built=build.results.images[0];
run('gcloud',['run','deploy',service,'--image='+built.name+'@'+built.digest,'--region='+region,'--project='+project,'--quiet']);
run('firebase',['deploy','--only','hosting','--project',project,'--non-interactive']);
const health=await fetch('https://youmeca-service.web.app/api/health',{signal:AbortSignal.timeout(60000)});
assert.equal(health.status,200);assert.equal((await health.json()).backend,'firebase');
console.log(JSON.stringify({project,buildId:build.id,image:built.digest,healthy:true}));
