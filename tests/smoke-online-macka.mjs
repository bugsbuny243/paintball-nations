/** Browser integration: two Chrome clients, one Colyseus room, OSM 3D render.
 * Runs with the static web server and the experimental online server both local.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_BIN||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
const errors=[];
const url='http://127.0.0.1:8765/maps/macka.html?online=1';
const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1});
const a=await context.newPage(), b=await context.newPage();
for(const [label,page] of [['blue',a],['red',b]]){
  page.on('pageerror',err=>errors.push(label+': '+err.message));
}
try{
  await a.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await a.waitForFunction(()=>document.querySelector('#online-state')?.textContent?.includes('Misafir bağlandı'),
    null,{timeout:45000});
  await b.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await b.waitForFunction(()=>document.querySelector('#online-state')?.textContent?.includes('Misafir bağlandı'),
    null,{timeout:45000});
  for(const page of [a,b]){
    await page.waitForFunction(()=>{
      const text=document.querySelector('#online-teams')?.textContent||'';
      const viewer=window.paintballMacka;
      return text.includes('1 gerçek')&&viewer?.getMode()===false&&
        viewer?.app?.root?.children.some(e=>e.name.startsWith('Online '));
    },null,{timeout:20000});
  }
  const remotePos=()=>b.evaluate(()=>{
    const avatar=window.paintballMacka.app.root.children.find(e=>e.name.startsWith('Online '));
    return avatar?.getPosition().z;
  });
  const z1=await remotePos();
  await a.keyboard.down('KeyW');
  await a.waitForTimeout(800);
  await a.keyboard.up('KeyW');
  await a.waitForTimeout(350);
  const z2=await remotePos();
  assert.equal(typeof z1,'number');
  assert.equal(typeof z2,'number');
  assert.ok(z2<z1-0.2, 'Remote player position should come from server and update after movement');
  assert.equal(errors.length,0,'Browser runtime exceptions: '+errors.join(', '));
  const guestStatus=await a.locator('#online-state').textContent();
  assert.ok(guestStatus?.includes('Misafir bağlandı'),'Expected server-issued guest identity state');
  console.log('A2 two-browser Maçka test PASSED',JSON.stringify({blueConnected:true,redConnected:true,remoteZBefore:z1,remoteZAfter:z2}));
}finally{
  await context.close();await browser.close();
}
