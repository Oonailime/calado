import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--use-angle=d3d11', '--disable-dev-shm-usage'],
});
const errors = [];
const results = {};
await mkdir('test-results', {recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror', error => errors.push(error.message));
  const ready = async map => {
    await page.goto(`${process.env.GAME_BASE_URL ?? 'http://localhost:3000'}/?map=${map}&skip`, {timeout:120000});
    await page.waitForFunction(() => window.__canopyBodies?.[2] && window.__canopyTest, null, {timeout:120000});
  };
  const place = async (id, p) => {
    await page.evaluate(({id,p}) => {
      const {runtime,useGame}=window.__game;
      useGame.getState().configure({paused:false}); useGame.getState().select(id);
      const body=window.__canopyBodies[id]; body.setBodyType(0,true);
      body.setTranslation(p,true); body.setLinvel({x:0,y:0,z:0},true);
      runtime.positions[id]={...p};
    },{id,p});
    await page.waitForTimeout(100);
  };
  const photo = async (name, position, target) => {
    await page.evaluate(() => window.__game.useGame.getState().configure({paused:true}));
    await page.waitForTimeout(150);
    const png = await page.evaluate(({position,target}) => {
      const {camera,scene,gl}=window.__canopyTest;
      gl.setSize(1440,900,false); camera.aspect=1440/900;camera.updateProjectionMatrix();
      camera.position.set(...position); camera.lookAt(...target); camera.updateMatrixWorld();gl.render(scene,camera);
      return gl.domElement.toDataURL('image/png');
    },{position,target});
    await writeFile(`test-results/${name}.png`,Buffer.from(png.split(',')[1],'base64'));
    await page.evaluate(() => window.__game.useGame.getState().configure({paused:false}));
  };
  await ready('phase3');
  await page.waitForFunction(()=>window.__canopyTest.scene.getObjectByName('canopy-built-vine'),null,{timeout:30000});
  assert.ok(await page.evaluate(()=>{
    let count=0;window.__canopyTest.scene.traverse(m=>{if(m.geometry?.boundsTree) count++;});return count;
  }), 'the current scene must include the spatial index');

  // Compare the same camera and geometry on the same GPU; only raycasting changes.
  await place(2,{x:-1,y:11.6,z:-5});
  await page.evaluate(()=>{const {gl,camera}=window.__canopyTest;gl.setSize(1440,900,false);camera.aspect=1440/900;camera.updateProjectionMatrix();});
  await page.evaluate(()=>{
    window.__profileMeshes=[];
    window.__canopyTest.scene.traverse(mesh=>{
      if(mesh.geometry?.boundsTree) window.__profileMeshes.push({mesh,fast:mesh.raycast,original:Object.getPrototypeOf(mesh).raycast});
    });
  });
  results.performance=[];
  for(const mode of ['original','fast']) {
    await page.evaluate(mode=>{
      window.__rayCost={ms:0,calls:0};
      for(const {mesh,fast,original} of window.__profileMeshes) {
        const raycast=mode==='fast'?fast:original;
        mesh.raycast=function(...args){const t=performance.now();const result=raycast.apply(this,args);window.__rayCost.ms+=performance.now()-t;window.__rayCost.calls++;return result;};
      }
    },mode);
    await page.waitForTimeout(1500);
    const sample=await page.evaluate(()=>new Promise(resolve=>{
      window.__rayCost={ms:0,calls:0};const frames=[];let start=performance.now(),previous=start;
      const tick=now=>{frames.push(now-previous);previous=now;if(now-start<3000)return requestAnimationFrame(tick);frames.sort((a,b)=>a-b);resolve({fps:frames.length*1000/(now-start),p95:frames[Math.floor(frames.length*.95)],rays:window.__rayCost});};requestAnimationFrame(tick);
    }));
    results.performance.push({mode,...sample});console.log('Performance',mode,JSON.stringify(sample));
  }
  assert.ok(results.performance[1].rays.ms < results.performance[0].rays.ms * 0.5, 'spatial index must cut raycast time by at least half');

  // Exercise the real puzzle actions, preserving the owner and order requirements.
  await page.evaluate(()=>{
    const s=window.__game.useGame;s.getState().select(0);
    s.getState().canopyInteract({x:-3,y:16.6,z:-19.5});
  });
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyFocused),true);
  await photo('canopy-harvest-cuff',[29,10.7,-0.5],[27.95,9.4,-1.95]);
  for(const p of [{x:27.18,y:9.61,z:-4.44},{x:27.95,y:9.4,z:-1.95},{x:-21.34,y:13.52,z:-4.83}]) {
    await page.evaluate(p=>{const s=window.__game.useGame;s.getState().select(1);s.getState().canopyInteract(p);},p);
  }
  assert.deepEqual(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyVines),[true,true,true]);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__canopyTest.scene.getObjectByName('harvest-marker-tree-vine-a')===undefined),true);
  await page.evaluate(()=>{
    const s=window.__game.useGame;s.getState().select(1);s.getState().canopyInteract({x:11.25,y:14.6,z:-25.6});
    s.getState().select(2);s.getState().canopyInteract({x:9.25,y:31.6,z:-46});
  });
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyBridgeBuilt),true);
  await page.waitForTimeout(2200);
  await photo('canopy-straight-bridge',[24,26,-32],[10.2,23.5,-35.8]);
  await photo('canopy-lower-tie',[14,16.8,-22],[11.25,14.9,-25.6]);
  await photo('canopy-upper-tie',[12,34,-41],[9.25,31.9,-46]);

  await place(2,{x:12.1,y:14.6,z:-25.6});
  await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__game.runtime.motions[2]==='vine-walk',null,{timeout:5000});
  await page.evaluate(()=>{window.__game.runtime.yaw=0;});
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__game.runtime.positions[2].y>31.5 && window.__game.runtime.motions[2]!=='vine-walk',null,{timeout:25000});
  await page.keyboard.up('w');await page.waitForTimeout(500);
  results.upperLanding=await page.evaluate(()=>({...window.__game.runtime.positions[2]}));
  assert.ok(results.upperLanding.z < -45 && results.upperLanding.y>31);
  await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__game.runtime.motions[2]==='vine-walk',null,{timeout:5000});
  await page.keyboard.down('s');
  await page.waitForFunction(()=>window.__game.runtime.positions[2].y<16 && window.__game.runtime.motions[2]!=='vine-walk',null,{timeout:25000});
  await page.keyboard.up('s');await page.waitForTimeout(500);
  results.lowerLanding=await page.evaluate(()=>({...window.__game.runtime.positions[2]}));
  assert.ok(results.lowerLanding.z > -26.5 && results.lowerLanding.y>14);
  console.log('Both vine landings',results.upperLanding,results.lowerLanding);

  await page.evaluate(()=>{
    const s=window.__game.useGame;
    for(const [id,p] of [[0,{x:-3,y:16.6,z:-19.5}],[1,{x:14,y:14.6,z:-25}],[2,{x:11,y:31.6,z:-47}]]) {
      s.getState().select(id);s.getState().collectCube(id,p);s.getState().canopyInteract({x:0,y:41.6,z:-66.5});
    }
  });
  assert.deepEqual(await page.evaluate(()=>window.__game.useGame.getState().puzzle.cubeDelivered),[true,true,true]);
  await photo('canopy-prisms-half-exposed',[0,42.7,-63],[0,41.6,-67.3]);

  // A leader already on island two used to trigger instant follower catch-up.
  await page.evaluate(()=>window.__game.useGame.getState().configure({map:'islands',paused:false}));
  await page.waitForFunction(()=>document.querySelector('[data-map="islands"]') && window.__canopyBodies?.[2] && window.__game.runtime.positions[2].y<3,null,{timeout:120000});
  await page.evaluate(()=>{
    const s=window.__game.useGame;
    s.setState(state=>({puzzle:{...state.puzzle,selected:2,logs:[true,true,true],powers:[false,true,false]}}));
    s.getState().build({x:3.4,y:1.2,z:-1.7});
  });
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().puzzle.bridge),true);
  await page.waitForTimeout(3000);
  await place(0,{x:-3,y:1.85,z:3});
  await place(1,{x:3,y:1.85,z:3});
  await place(2,{x:0,y:1.85,z:-23});
  results.followers=await page.evaluate(()=>new Promise(resolve=>{
    const r=window.__game.runtime;const previous=r.positions.map(p=>({...p}));const steps=[0,0];const sawBridge=[false,false];const start=performance.now();
    function tick(){for(const id of [0,1]){const p=r.positions[id];steps[id]=Math.max(steps[id],Math.hypot(p.x-previous[id].x,p.z-previous[id].z));if(p.z<-5&&p.z>-14)sawBridge[id]=true;previous[id]={...p};}
      if(r.positions[0].z<-17&&r.positions[1].z<-17||performance.now()-start>22000)resolve({steps,sawBridge,positions:r.positions.map(p=>({...p}))});else requestAnimationFrame(tick);
    }requestAnimationFrame(tick);
  }));
  assert.deepEqual(results.followers.sawBridge,[true,true]);
  assert.ok(results.followers.steps.every(step=>step<0.75),'followers must never teleport');
  assert.ok(results.followers.positions.slice(0,2).every(p=>p.z<-17),'both followers must walk onto island two');
  console.log('Followers crossed',JSON.stringify(results.followers));
  assert.deepEqual(errors,[]);
  results.passed=true;
} finally {
  results.errors=errors;
  await writeFile('test-results/canopy-fixes-validation.json',JSON.stringify(results,null,2));
  await browser.close();
}
