/** C2 Chrome/PlayCanvas test: two separate local PostgreSQL pilot accounts.
 * This tests browser-to-Colyseus-to-database admission on the GitHub runner.
 * It is not a production Internet or Android device test.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({
  headless:true,executablePath:process.env.CHROME_BIN||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
const context=await browser.newContext({viewport:{width:960,height:540}});
const tr=await context.newPage(),de=await context.newPage();
const errors=[];
const httpErrors=[];
for(const [name,page] of [['TR',tr],['DE',de]]){
  page.on('response',r=>{
    if(r.status()>=400)httpErrors.push(name+' HTTP '+r.status()+' '+new URL(r.url()).pathname);
  });
  page.on('console',msg=>{
    if(msg.type()==='error')errors.push(name+' console: '+msg.text());
  });
}
async function waitForPilot(page,label){
  try{
    await page.waitForFunction(faction=>{
      const panel=document.querySelector('#online-macka-hud');
      return panel?.dataset.factionId===faction&&
        panel?.dataset.pilotId?.length===36&&
        document.querySelector('#online-state')?.textContent?.includes('Pilot bağlandı');
    },label,{timeout:25000});
  }catch(error){
    const state=await page.locator('#online-state').textContent().catch(()=>null);
    console.error('C2 browser '+label+' did not connect:',state,'http:',httpErrors,'runtime:',errors);
    throw error;
  }
}
for(const [label,page] of [['TR',tr],['DE',de]])
  page.on('pageerror',err=>errors.push(label+': '+err.message));
try{
  const root='http://127.0.0.1:8765/maps/macka.html?online=1&pilot=1&faction=';
  await tr.goto(root+'TR',{waitUntil:'domcontentloaded',timeout:30000});
  await waitForPilot(tr,'TR');
  await de.goto(root+'DE',{waitUntil:'domcontentloaded',timeout:30000});
  await waitForPilot(de,'DE');
  const idTr=await tr.locator('#online-macka-hud').getAttribute('data-pilot-id');
  const idDe=await de.locator('#online-macka-hud').getAttribute('data-pilot-id');
  assert.notEqual(idTr,idDe);
  for(const page of [tr,de])await page.waitForFunction(()=>{
    const text=document.querySelector('#online-teams')?.textContent||'';
    return text.includes('🔵 1 gerçek')&&text.includes('🔴 1 gerçek')&&
      window.paintballMacka?.app?.root?.children.some(e=>e.name.startsWith('Online '));
  },null,{timeout:20000});
  const remotePosition=()=>de.evaluate(()=>{
    const entity=window.paintballMacka.app.root.children.find(e=>e.name.startsWith('Online '));
    return entity?.getPosition().z;
  });
  const before=await remotePosition();
  await tr.keyboard.down('KeyW');
  await tr.waitForTimeout(700);
  await tr.keyboard.up('KeyW');
  await tr.waitForTimeout(350);
  const after=await remotePosition();
  assert.equal(typeof before,'number');
  assert.equal(typeof after,'number');
  assert.ok(after<before-0.2,'DE browser must see TR pilot movement from Colyseus');
  assert.equal(errors.length,0,'Browser runtime errors: '+errors.join(' / '));
  console.log('C2 pilot-to-PostgreSQL-to-Colyseus Chrome test PASSED',
    JSON.stringify({twoProfiles:true,factions:['TR','DE'],remoteMoved:true}));
}finally{await context.close();await browser.close();}
