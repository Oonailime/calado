import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
// The zen portal only remains as phase 2's arrival portal (islands now opens a tree portal).
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args:['--use-angle=d3d11','--disable-dev-shm-usage']});
const result = {};
try {
 const page = await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.BENCHMARK_BASE_URL || 'http://localhost:3000'}/?map=phase2&skip`,{timeout:120000});
 await page.waitForFunction(()=>window.__canopyTest?.scene.getObjectByName('map-portal') && document.querySelector('[data-ready="true"]'),null,{timeout:120000});
 await page.evaluate(()=>{
  const {useGame}=window.__game;
  useGame.getState().configure({quality:'high',reduced:false});
  // Once the game is beaten the arrival portal stays open instead of closing after 3 s.
  useGame.setState(s=>({puzzle:{...s.puzzle,cubeSolved:true}}));
 });
 await page.waitForFunction(()=>window.__canopyTest.scene.getObjectByName('portal-settled-structure')?.visible,null,{timeout:30000});
 await page.evaluate(()=>window.__game.useGame.getState().configure({paused:true}));
 await page.waitForTimeout(300);
 await mkdir('test-results',{recursive:true});
 for(const mode of ['hidden','visible','without-transmission']) {
  const sample=await page.evaluate(async mode=>{
   const {scene,camera,gl}=window.__canopyTest;
   const portal=scene.getObjectByName('map-portal');
   portal.visible=mode!=='hidden';
   const physical=[];
   portal.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.transmission>0){physical.push({name:m.name,transmission:m.transmission});if(mode==='without-transmission'){m.transmission=0;m.needsUpdate=true;}}});
   // 8 m in front of the portal (its local +z), as the islands benchmark framed it.
   const e=portal.matrixWorld.elements,length=Math.hypot(e[8],e[10]);
   const [x,y,z,fx,fz]=[e[12],e[13],e[14],e[8]/length,e[10]/length];
   camera.position.set(x+fx*8,y+3,z+fz*8);camera.lookAt(x,y+1.8,z);camera.updateMatrixWorld();
   gl.info.autoReset=false;
   const context=gl.getContext();
   const frames=[];
   for(let i=0;i<35;i++){
    gl.info.reset();const start=performance.now();gl.render(scene,camera);context.finish();
    if(i>=10)frames.push({ms:performance.now()-start,calls:gl.info.render.calls,triangles:gl.info.render.triangles});
    await new Promise(requestAnimationFrame);
   }
   frames.sort((a,b)=>a.ms-b.ms);
   gl.render(scene,camera);
   const screenshot=gl.domElement.toDataURL();gl.info.autoReset=true;
   return {median:frames[Math.floor(frames.length/2)],p95:frames[Math.floor(frames.length*.95)].ms,physical,screenshot};
  },mode);
  const {screenshot,...metrics}=sample;result[mode]=metrics;
  await writeFile(`test-results/portal-${mode}.png`,Buffer.from(screenshot.split(',')[1],'base64'));
 }
 result.errors=errors;
 await writeFile(`test-results/portal-benchmark-${process.argv[2] || 'current'}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
