import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args:['--use-angle=d3d11','--disable-dev-shm-usage']});
const errors=[];
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error') errors.push(m.text().slice(0,1000)); });
  await page.addInitScript(() => localStorage.setItem('historicalChessPuzzleSolved','true'));
  const ready = async map => {
    await page.goto(`http://localhost:3000/?map=${map}&skip`, {timeout:120000});
    await page.waitForFunction(() => window.__canopyTest?.scene.getObjectByName('tree-entrance') && window.__canopyBodies?.[2], null, {timeout:120000});
  };
  const photo = async (name, position, target) => {
    await page.evaluate(() => window.__game.useGame.getState().configure({paused:true}));
    await page.waitForTimeout(120);
    await page.evaluate(({position,target}) => {
      const root=window.__canopyTest;
      root.camera.position.set(...position); root.camera.lookAt(...target); root.camera.updateMatrixWorld();
      root.gl.render(root.scene,root.camera);
    }, {position,target});
    await page.addStyleTag({content:'[role="dialog"], [class*="settings"], [class*="Settings"], [class*="backdrop"], [class*="Backdrop"], [class*="overlay"] {visibility:hidden!important}'});
    await page.screenshot({path:`test-results/${name}.png`});
  };
  await ready('phase2');
  await page.waitForTimeout(2200);
  const anchor=await page.evaluate(()=>window.__canopyTest.scene.getObjectByName('tree-entrance').position.toArray());
  await photo('tree-portal-refactored',[anchor[0]+0.4,anchor[1]+2.8,anchor[2]+7],[anchor[0],anchor[1]+1.5,anchor[2]]);
  await photo('tree-portal-side',[anchor[0]+4.7,anchor[1]+2.7,anchor[2]+5],[anchor[0],anchor[1]+1.5,anchor[2]+.3]);
  console.log('Portal screenshot',anchor);
  if (process.argv.includes('--portal-only')) { assert.deepEqual(errors, []); await browser.close(); process.exit(0); }
  await ready('phase3');
  await photo('canopy-arrival-portal',[-10,10.5,18],[-16.6,9.5,14]);
  await page.evaluate(()=>window.__game.useGame.getState().configure({paused:false}));
  await page.waitForTimeout(3400);
  const gone=await page.evaluate(()=>{
    const p=window.__canopyTest.scene.getObjectByName('tree-entrance');
    return p.children.filter(c=>c.type==='Group').every(c=>!c.visible) && p.children.find(c=>c.isPointLight).intensity===0;
  });
  assert.equal(gone,true,'entire arrival portal must disappear');
  // Teleport only for test setup; movement, E, powers and respawn use the real game controllers.
  const place = async (id,p) => {
    await page.evaluate(({id,p})=>{
      const {runtime,useGame}=window.__game;
      useGame.getState().configure({paused:false}); useGame.getState().select(id);
      const body=window.__canopyBodies[id]; body.setBodyType(0,true); body.setTranslation(p,true); body.setLinvel({x:0,y:0,z:0},true);
      runtime.positions[id]={...p};
    },{id,p});
    await page.waitForTimeout(160);
  };
  await place(0,{x:-3,y:16.6,z:-19.5});
  await page.keyboard.press('e'); // white pickup
  await page.keyboard.press('f'); // white focus
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyFocused),true);
  console.log('White focused');
  // Positions stay on the planks, within reach of the existing hanging lianas.
  for(const p of [{x:-13.5,y:8.65,z:13},{x:-3.1,y:11.65,z:-3},{x:1.2,y:11.65,z:-4}]) {
    await place(2,p); await page.keyboard.press('e');
  }
  assert.deepEqual(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyVines),[true,true,true]);
  const harvestVisible=await page.evaluate(()=>{
    const a=[]; window.__canopyTest.scene.traverse(c=>{if(/_liana-(root-road|west-bough|river-bough)$/.test(c.name))a.push(c.visible)});return a;
  });
  assert.deepEqual(harvestVisible,[false,false,false]);
  console.log('Scenery vines harvested');
  await place(1,{x:14,y:31.6,z:-47}); await page.keyboard.press('e');
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyGoldTied),true);
  await place(2,{x:15.7,y:14.6,z:-25}); await page.keyboard.press('e'); await page.keyboard.press('e');
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().puzzle.canopyBridgeBuilt),true);
  await page.waitForTimeout(2000);
  await photo('canopy-cooperative-bridge',[30,29,-17],[16,23,-36]);
  console.log('Bridge built');
  await page.evaluate(()=>window.__game.useGame.getState().configure({paused:false}));
  await page.keyboard.press('e');
  await page.waitForFunction(()=>window.__game.runtime.motions[2]==='vine-walk',null,{timeout:5000});
  await page.evaluate(()=>{window.__game.runtime.yaw=0;});
  await page.keyboard.down('w');
  await page.waitForTimeout(2500); await page.keyboard.up('w');
  assert.ok(await page.evaluate(()=>window.__game.runtime.positions[2].y>15));
  console.log('Brown walking on new bridge');
  await photo('canopy-river-transition',[29,25,-17],[13,5,-40]);
  // Switching restores the first pendulum's original ties and geometry.
  await page.evaluate(()=>{
    const {runtime,useGame}=window.__game; const rope=runtime.swingingVines.get('phase4-swing-plateau');
    rope.releasedAttachment='rear'; rope.grip.y-=2;
    useGame.getState().configure({paused:false}); useGame.getState().select(1);
  });
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__game.runtime.swingingVines.get('phase4-swing-plateau').releasedAttachment),null);
  console.log('First swing restored on selection');
  for(const p of [{x:-13,y:-2,z:14},{x:25,y:16,z:-65}]) {
    await place(2,p);
    await page.waitForFunction(()=>window.__game.runtime.positions[2].z>10 && window.__game.runtime.positions[2].y>8,null,{timeout:5000});
  }
  console.log('Valley and upper-bank falls respawn');
  // Collect and deliver each real prism with E, preserving ownership.
  for(const [id,p] of [[0,{x:-3,y:16.6,z:-19.5}],[1,{x:11,y:31.6,z:-47}],[2,{x:14,y:14.6,z:-25}]]) {
    await place(id,p); await page.keyboard.press('e');
    await place(id,{x:0,y:41.6,z:-66.5}); await page.keyboard.press('e');
  }
  assert.deepEqual(await page.evaluate(()=>window.__game.useGame.getState().puzzle.cubeDelivered),[true,true,true]);
  await page.keyboard.press('e');
  assert.equal(await page.evaluate(()=>window.__game.useGame.getState().cubePuzzleOpen),true);
  console.log('All owners delivered and cube opened');
  assert.deepEqual(errors,[]);
  await writeFile('test-results/canopy-browser-validation.json',JSON.stringify({portalGone:gone,harvestVisible,errors,passed:true},null,2));
} finally { await browser.close(); }
