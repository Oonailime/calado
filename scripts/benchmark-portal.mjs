import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args:['--use-angle=d3d11','--disable-dev-shm-usage']});
const result = {};
try {
 const page = await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.BENCHMARK_BASE_URL || 'http://localhost:3000'}/?map=islands&skip`,{timeout:120000});
 await page.waitForFunction(()=>window.__canopyTest?.scene.getObjectByName('map-portal') && document.querySelector('[data-ready="true"]'),null,{timeout:120000});
 await page.evaluate(()=>{
  const {useGame}=window.__game;
  useGame.getState().configure({quality:'high',reduced:false});
  useGame.setState(s=>({puzzle:{...s.puzzle,built:true}}));
 });
 await page.waitForTimeout(8500);
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
   camera.position.set(0,4.2,-26);camera.lookAt(0,3,-34);camera.updateMatrixWorld();
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
