/** Paintball Nations / Maçka A2 connected-client preview.
 * Build: npm run online:build
 * Loads only with ?online=1. Normal offline game is unaffected.
 * No multiplayer server is hosted by this static page.
 */
import {Client} from '@colyseus/sdk';

if(new URLSearchParams(location.search).get('online')==='1'){
  const params=new URLSearchParams(location.search);
  let started=false;
  function attach(map){
    if(started||!map)return;
    started=true;
    const app=map.app;
    const link=document.getElementById('start-game');
    if(link)link.hidden=true;
    const panel=document.createElement('aside');
    panel.id='online-macka-hud';
    panel.innerHTML=[
      '<strong>🌍 MAÇKA ONLINE · A3 TEST</strong>',
      '<span id="online-state">Sunucu bağlantısı kontrol ediliyor…</span>',
      '<span id="online-teams">🔵 0 gerçek oyuncu · 🔴 0 gerçek oyuncu · 🤖 0 bot</span>',
      '<span id="online-score">Skor: 0 - 0</span>',
      '<button id="online-fire" type="button">BOYA!</button>',
      '<div id="online-feedback"></div>'
    ].join('');
    document.body.appendChild(panel);
    const state=panel.querySelector('#online-state');
    const teams=panel.querySelector('#online-teams');
    const score=panel.querySelector('#online-score');
    const fire=panel.querySelector('#online-fire');
    const feedback=panel.querySelector('#online-feedback');
    const entities=new Map();
    const mat=(r,g,b)=>{
      const m=new pc.StandardMaterial();m.diffuse=new pc.Color(r,g,b);m.gloss=22;m.update();return m;
    };
    const blue=mat(.07,.62,.99),red=mat(.99,.20,.36),mask=mat(.08,.13,.20),white=mat(.97,.97,.93);
    function part(root,name,type,material,x,y,z,w,h,d){
      const e=new pc.Entity(name);
      e.addComponent('render',{type,material});
      e.setLocalPosition(x,y,z);e.setLocalScale(w,h,d);
      root.addChild(e);
    }
    function createAvatar(id,team){
      const root=new pc.Entity('Online '+id);
      part(root,'Sport suit','cylinder',team==='red'?red:blue,0,1.05,0,.85,1.3,.85);
      part(root,'Helmet','sphere',mask,0,1.95,0,.67,.66,.67);
      part(root,'Visor','box',white,0,1.95,-.33,.54,.19,.08);
      part(root,'Team badge','box',team==='red'?red:blue,0,1.3,-.48,.5,.25,.07);
      app.root.addChild(root);
      return root;
    }
    function clearAvatars(){
      for(const e of entities.values())e.destroy();
      entities.clear();
    }
    let room=null,interval=null,seq=0,fireDown=false,space=false,connected=false;
    let ownPosition=null;
    const serverInput=params.get('server')||
      (['localhost','127.0.0.1'].includes(location.hostname)?'http://127.0.0.1:2567':'');
    function status(message,kind){
      state.textContent=message;state.dataset.kind=kind||'neutral';
    }
    function serverUrl(s){
      if(!s)return null;
      try{
        const url=new URL(s);
        if(!['http:','https:','ws:','wss:'].includes(url.protocol))return null;
        if(location.protocol==='https:'&&['http:','ws:'].includes(url.protocol))return null;
        if(url.username||url.password)return null;
        return url.origin;
      }catch{return null;}
    }
    function renderSnapshot(snapshot){
      if(!snapshot||snapshot.mapId!=='TR-MACKA'||!Array.isArray(snapshot.players))return;
      if(!room)return;
      const people=new Set();
      snapshot.players.forEach(p=>{
        if(!p||typeof p.id!=='string'||!Number.isFinite(p.x)||!Number.isFinite(p.z))return;
        if(p.id===room.sessionId){
          // No client-authority on position; camera follows the server snapshot.
          ownPosition=p;
          map.setPlayerPosition(p.x,p.z);
          return;
        }
        people.add(p.id);
        let e=entities.get(p.id);
        if(!e){e=createAvatar(p.id,p.team);entities.set(p.id,e);}
        e.setPosition(p.x,0,p.z);
        e.setEulerAngles(0,p.yaw,0);
        e.enabled=p.active!==false;
      });
      for(const [id,e] of entities){
        if(!people.has(id)){e.destroy();entities.delete(id);}
      }
      teams.textContent='🔵 '+snapshot.playerCounts.blue+' gerçek · 🔴 '+snapshot.playerCounts.red+
        ' gerçek · 🤖 '+snapshot.bots+' bot';
      score.textContent='🔵 '+snapshot.scores.blue+' - '+snapshot.scores.red+' 🔴';
    }
    const paramsUrl=serverUrl(serverInput);
    if(!paramsUrl){
      status('Ağlı test için bir HTTPS oyun sunucusu henüz dağıtılmadı. Çevrim dışı Maçka modu kullanılabilir.','warning');
      fire.hidden=true;
      return;
    }
    fire.addEventListener('pointerdown',e=>{e.preventDefault();fireDown=true;fire.setPointerCapture(e.pointerId);});
    fire.addEventListener('pointerup',()=>{fireDown=false;});
    fire.addEventListener('pointercancel',()=>{fireDown=false;});
    window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();space=true;}});
    window.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});
    function cleanup(){
      connected=false;
      if(interval!==null){clearInterval(interval);interval=null;}
      map.setExternalControl(false);
      clearAvatars();
      fire.disabled=true;
    }
    async function connect(){
      try{
        status('Güvenli misafir oturumu alınıyor…');
        const response=await fetch(paramsUrl+'/api/v1/guest-ticket',{
          method:'POST',cache:'no-store',credentials:'omit'
        });
        if(!response.ok)throw new Error('Misafir girişi reddedildi: HTTP '+response.status);
        const guest=await response.json();
        if(!guest||typeof guest.ticket!=='string'||!guest.guest) {
          throw new Error('Oyun sunucusu geçerli misafir bileti döndürmedi');
        }
        const client=new Client(paramsUrl);
        client.auth.token=guest.ticket;
        status('Bilet doğrulandı · Maçka odasına giriliyor…');
        room=await client.joinOrCreate('macka_frontline');
        connected=true;fire.disabled=false;
        status('Misafir bağlandı · gerçek hesap değil');
        map.setMode(false);
        map.setExternalControl(true);
        room.onMessage('snapshot',renderSnapshot);
        room.onMessage('paint_hit',event=>{
          feedback.textContent=event.shooterId===room.sessionId?'🎯 İsabet!':'🎨 Boya isabeti';
          setTimeout(()=>{feedback.textContent='';},1100);
        });
        room.onLeave(()=>{cleanup();status('Oyun sunucusuyla bağlantı koptu. Sayfayı yenileyerek yeniden bağlanabilirsin.','warning');});
        room.onError((_code,message)=>{status('Bağlantı hatası: '+message,'error');});
        window.addEventListener('beforeunload',()=>{
          if(room)room.leave(true).catch(()=>{});
        },{once:true});
        interval=setInterval(()=>{
          if(!connected)return;
          const axes=map.getControlInput();
          const mx=Math.max(-1,Math.min(1,axes.mx)),
            mz=Math.max(-1,Math.min(1,axes.mz));
          room.send('input',{
            seq:++seq,mx,mz,yaw:axes.yaw,pitch:axes.pitch,fire:fireDown||space
          });
        },50);
      }catch(err){
        cleanup();
        status('Bağlantı kurulamadı: '+String(err.message||err),'error');
      }
    }
    connect();
  }
  window.addEventListener('paintball-macka-ready',event=>attach(event.detail),{once:true});
  if(window.paintballMacka)attach(window.paintballMacka);
}