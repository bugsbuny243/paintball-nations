/* Paintball Nations — FPS Training Arena v0.1
 * PlayCanvas classic script, engine 2.x. No external assets required.
 * Attach the `paintballNations` script to an empty Entity in a new scene.
 * This is a local training demo, not a networked 15v15 match.
 */
function createPaintballNationsGame(app) {
    'use strict';
    var arena = new pc.Entity('Paintball Nations - Generated Arena');
    app.root.addChild(arena);
    var mats = {};
    function mat(name, r, g, b, shiny) {
        var m = new pc.StandardMaterial();
        m.diffuse = new pc.Color(r, g, b);
        m.gloss = shiny || 22;
        m.metalness = 0;
        m.update();
        mats[name] = m;
        return m;
    }
    mat('floor', 0.18, 0.26, 0.30);
    mat('blue', 0.06, 0.58, 0.92);
    mat('deepBlue', 0.06, 0.20, 0.40);
    mat('pink', 0.91, 0.13, 0.39);
    mat('orange', 0.98, 0.53, 0.10);
    mat('yellow', 1.00, 0.78, 0.18);
    mat('white', 0.92, 0.95, 0.95);
    mat('dark', 0.06, 0.09, 0.14);
    mat('grass', 0.13, 0.34, 0.26);
    mat('turquoise', 0.10, 0.81, 0.73);
    function primitive(type, name, x, y, z, sx, sy, sz, material, parent) {
        var e = new pc.Entity(name);
        e.addComponent('render', {type: type, material: material});
        e.setLocalPosition(x, y, z);
        e.setLocalScale(sx, sy, sz);
        (parent || arena).addChild(e);
        return e;
    }
    function box(name, x, y, z, sx, sy, sz, material, parent) {
        return primitive('box', name, x, y, z, sx, sy, sz, material, parent);
    }
    box('Arena floor', 0, -0.20, 0, 36, 0.40, 42, mats.floor);
    box('Center stripe', 0, 0.015, 0, 0.22, 0.025, 40, mats.yellow);
    box('Blue baseline', 0, 0.02, 16.6, 33, 0.045, 0.20, mats.blue);
    box('Red baseline', 0, 0.02, -16.6, 33, 0.045, 0.20, mats.pink);
    box('Back wall N', 0, 1.35, -20.5, 36, 2.7, 0.45, mats.deepBlue);
    box('Back wall S', 0, 1.35, 20.5, 36, 2.7, 0.45, mats.deepBlue);
    box('Left wall', -18, 1.35, 0, 0.5, 2.7, 41, mats.deepBlue);
    box('Right wall', 18, 1.35, 0, 0.5, 2.7, 41, mats.deepBlue);
    // Non-realistic, brightly colored paintball barriers.
    var blockers = [];
    function cover(name, x, z, w, h, d, material) {
        box(name, x, h / 2, z, w, h, d, material);
        blockers.push({x:x, z:z, w:w, d:d, h:h});
    }
    cover('Left tall barricade', -8.5, 4.7, 3.2, 2.2, 1.3, mats.blue);
    cover('Right tall barricade', 8.5, 4.7, 3.2, 2.2, 1.3, mats.blue);
    cover('Center low barricade', 0, 2, 4.3, 1.25, 1.2, mats.orange);
    cover('Left center barricade', -5.8, -4.7, 3.2, 2.0, 1.3, mats.turquoise);
    cover('Right center barricade', 5.8, -4.7, 3.2, 2.0, 1.3, mats.yellow);
    cover('Middle back barricade', 0, -10.7, 3, 1.75, 1.25, mats.blue);
    cover('Rear left shield', -11.2, -11.8, 2.4, 1.5, 1.1, mats.orange);
    cover('Rear right shield', 11.2, -11.8, 2.4, 1.5, 1.1, mats.orange);
    // Decorative columns and bright top caps.
    [-15, 15].forEach(function (x) {
        [-15, -5, 5, 15].forEach(function (z) {
            primitive('cylinder','Boundary post',x,1.7,z,0.42,3.4,0.42,mats.turquoise);
            primitive('sphere','Boundary lamp',x,3.48,z,0.65,0.65,0.65,mats.yellow);
        });
    });
    var sun = new pc.Entity('Sunny light');
    sun.addComponent('light', {type:'directional', intensity:1.7, color:new pc.Color(1,0.97,0.89), castShadows:false});
    sun.setEulerAngles(50, 27, 0);
    arena.addChild(sun);
    app.scene.ambientLight = new pc.Color(0.58, 0.65, 0.76);
    var camera = new pc.Entity('Paintball FPS camera');
    camera.addComponent('camera', {priority:100, fov:73, nearClip:0.05, farClip:100, clearColor:new pc.Color(0.43,0.73,0.89)});
    arena.addChild(camera);
    // Simple stylized paintball marker shown from the first-person camera.
    var marker = new pc.Entity('Free starter marker - cosmetic model');
    camera.addChild(marker);
    box('Marker body',0.35,-0.32,-0.72,0.22,0.20,0.60,mats.deepBlue,marker);
    box('Marker grip',0.35,-0.48,-0.55,0.15,0.30,0.14,mats.dark,marker);
    var tube = primitive('cylinder','Marker tube',0.35,-0.29,-1.07,0.105,0.64,0.105,mats.turquoise,marker);
    tube.setLocalEulerAngles(90,0,0);
    primitive('sphere','Paintball hopper',0.35,-0.10,-0.70,0.32,0.27,0.32,mats.pink,marker);
    // Static mesh targets are practice dummies, not players.
    var targets = [];
    var positions = [
        [-13.0,-4.0],[-9.6,-7.0],[-3.8,-8.0],[3.7,-8.0],[10.0,-7.0],
        [-14.0,-14.3],[-6.4,-14.2],[0,-15.0],[6.4,-14.2],[14.0,-14.3]
    ];
    positions.forEach(function (pos, idx) {
        var root = new pc.Entity('Target ' + (idx+1));
        arena.addChild(root);
        root.setPosition(pos[0],0,pos[1]);
        primitive('cylinder','Dummy body',0,1.1,0,0.85,1.55,0.85,mats.pink,root);
        primitive('sphere','Dummy head',0,2.0,0,0.67,0.67,0.67,mats.orange,root);
        box('Dummy chest square',0,1.15,0.46,0.53,0.50,0.06,mats.yellow,root);
        targets.push({entity:root, baseX:pos[0], z:pos[1], alive:true, downTime:0, phase:idx*1.9});
    });
    var px=0, pz=14.3, eye=1.68, yaw=0, pitch=0, t=0;
    var keys={}, stickX=0, stickY=0, pointerLook=null, joyPointer=null;
    var score=0, hits=0, shots=0, timeLeft=120, cooldown=0, holdFire=false, ended=false;
    var effects=[], splats=[];
    camera.setPosition(px,eye,pz);
    var style = document.createElement('style');
    style.textContent = ''+
      '#pb-root{position:fixed;inset:0;z-index:9000;pointer-events:none;color:#fff;font-family:system-ui,Arial,sans-serif;user-select:none;-webkit-user-select:none}'+
      '#pb-top{position:absolute;top:0;left:0;right:0;padding:12px 14px 10px;background:linear-gradient(#021421aa,transparent);display:flex;justify-content:space-between;align-items:flex-start;gap:10px;font-weight:800;text-shadow:0 1px 4px #000}'+
      '#pb-title{font-size:14px;color:#7af6ed;letter-spacing:0.8px}#pb-sub{font-size:10px;color:#d6f6f8;font-weight:600;margin-top:3px}'+
      '#pb-score{background:#002035b8;border:1px solid #ffffff55;border-radius:10px;padding:8px 12px;text-align:center;font-size:15px;white-space:nowrap}'+
      '#pb-score small{font-size:10px;font-weight:600;opacity:.9}'+
      '#pb-cross{position:absolute;left:50%;top:49%;transform:translate(-50%,-50%);font-size:30px;font-weight:300;line-height:1;color:white;text-shadow:0 0 3px black}'+
      '#pb-message{position:absolute;top:58%;left:50%;transform:translate(-50%,-50%);text-align:center;background:#00172499;border-radius:9px;padding:6px 12px;font-size:13px;font-weight:700;max-width:80%;text-shadow:0 1px 3px black}'+
      '#pb-bottom{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);font-size:11px;text-align:center;background:#061923a6;padding:6px 9px;border-radius:8px;white-space:nowrap}'+
      '#pb-look{position:absolute;right:0;top:13%;width:57%;height:75%;pointer-events:auto;touch-action:none}'+
      '#pb-joy{position:absolute;left:24px;bottom:48px;width:120px;height:120px;border-radius:50%;border:2px solid #c6faff90;background:#083c6388;pointer-events:auto;touch-action:none}'+
      '#pb-thumb{position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:#7ef3eeaf;border:2px solid white}'+
      '#pb-fire{position:absolute;right:23px;bottom:67px;border:3px solid #ffdfc2;border-radius:50%;width:94px;height:94px;background:#eb527cbb;color:white;font-weight:900;font-size:16px;pointer-events:auto;touch-action:none}'+
      '#pb-restart{position:absolute;top:68%;left:50%;transform:translateX(-50%);background:#20b4aa;color:white;border:0;border-radius:12px;padding:13px 20px;font-size:15px;font-weight:900;pointer-events:auto;display:none}'+
      '@media(pointer:fine){#pb-joy,#pb-fire,#pb-look{display:none}#pb-bottom{bottom:18px}}'+
      '@media(max-width:420px){#pb-title{font-size:12px}#pb-score{font-size:13px;padding:5px 7px}#pb-joy{width:105px;height:105px;left:14px;bottom:40px}#pb-thumb{left:34px;top:34px}#pb-fire{width:84px;height:84px;right:15px;bottom:52px}#pb-bottom{font-size:10px;bottom:9px}}';
    document.head.appendChild(style);
    var hud = document.createElement('div');
    hud.id='pb-root';
    hud.innerHTML = '<div id="pb-top"><div><div id="pb-title">🎨 PAINTBALL NATIONS</div><div id="pb-sub">ÜCRETSİZ BAŞLANGIÇ • FPS ANTRENMAN</div></div><div id="pb-score">🔵 <span id="pb-points">0</span> : <span id="pb-targets">10</span> 🔴<div><small>⏱ <span id="pb-time">02:00</span> • İSABET <span id="pb-accuracy">0</span>%</small></div></div></div><div id="pb-cross">+</div><div id="pb-message">Hedefleri boya! +100 puan</div><div id="pb-look"></div><div id="pb-joy"><div id="pb-thumb"></div></div><button id="pb-fire" type="button">BOYA!</button><button id="pb-restart" type="button">TEKRAR OYNA</button><div id="pb-bottom">SOL: HAREKET • SAĞ: BAKIŞ • BOYA: ATIŞ</div>';
    document.body.appendChild(hud);
    function $id(id){return hud.querySelector('#'+id);}
    var joy=$id('pb-joy'), thumb=$id('pb-thumb'), look=$id('pb-look'), fire=$id('pb-fire');
    var msg=$id('pb-message');
    var messageUntil=3;
    function showMessage(text, seconds){msg.textContent=text;messageUntil=t+(seconds||0.7);msg.style.display='block';}
    function moveThumb(ev) {
        var rc=joy.getBoundingClientRect();
        var mx=rc.left+rc.width/2, my=rc.top+rc.height/2;
        var dx=ev.clientX-mx,dy=ev.clientY-my,limit=rc.width*0.32;
        var len=Math.hypot(dx,dy)||1, scale=Math.min(1,limit/len);
        dx*=scale;dy*=scale;
        stickX=dx/limit;stickY=dy/limit;
        thumb.style.transform='translate('+dx+'px,'+dy+'px)';
    }
    function joyDown(ev){ev.preventDefault();joyPointer=ev.pointerId;joy.setPointerCapture(ev.pointerId);moveThumb(ev);}
    function joyMove(ev){if(ev.pointerId===joyPointer) moveThumb(ev);}
    function joyUp(ev){if(ev.pointerId===joyPointer){joyPointer=null;stickX=0;stickY=0;thumb.style.transform='translate(0,0)';}}
    joy.addEventListener('pointerdown',joyDown);
    joy.addEventListener('pointermove',joyMove);
    joy.addEventListener('pointerup',joyUp);
    joy.addEventListener('pointercancel',joyUp);
    function lookDown(ev){ev.preventDefault();pointerLook={id:ev.pointerId,x:ev.clientX,y:ev.clientY};look.setPointerCapture(ev.pointerId);}
    function lookMove(ev){if(pointerLook && pointerLook.id===ev.pointerId){
        var dx=ev.clientX-pointerLook.x,dy=ev.clientY-pointerLook.y;
        yaw-=dx*0.21;pitch=Math.max(-62,Math.min(62,pitch-dy*0.18));
        pointerLook.x=ev.clientX;pointerLook.y=ev.clientY;
    }}
    function lookUp(ev){if(pointerLook&&pointerLook.id===ev.pointerId)pointerLook=null;}
    look.addEventListener('pointerdown',lookDown);
    look.addEventListener('pointermove',lookMove);
    look.addEventListener('pointerup',lookUp);
    look.addEventListener('pointercancel',lookUp);
    function fireDown(ev){ev.preventDefault();holdFire=true;fire.setPointerCapture(ev.pointerId);shoot();}
    function fireUp(){holdFire=false;}
    fire.addEventListener('pointerdown',fireDown);
    fire.addEventListener('pointerup',fireUp);
    fire.addEventListener('pointercancel',fireUp);
    function keyDown(ev){keys[ev.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(ev.code)>=0)ev.preventDefault();}
    function keyUp(ev){keys[ev.code]=false;}
    function mouseMove(ev){if(document.pointerLockElement===app.graphicsDevice.canvas){yaw-=ev.movementX*0.11;pitch=Math.max(-62,Math.min(62,pitch-ev.movementY*0.11));}}
    function mouseDown(ev){if(ev.button===0&&ev.target===app.graphicsDevice.canvas){shoot();if(app.graphicsDevice.canvas.requestPointerLock && document.pointerLockElement!==app.graphicsDevice.canvas) app.graphicsDevice.canvas.requestPointerLock();}}
    window.addEventListener('keydown',keyDown);
    window.addEventListener('keyup',keyUp);
    window.addEventListener('mousemove',mouseMove);
    app.graphicsDevice.canvas.addEventListener('pointerdown',mouseDown);
    app.graphicsDevice.canvas.style.touchAction='none';
    function raySphere(origin,dir,x,y,z,r){
        var ox=origin.x-x,oy=origin.y-y,oz=origin.z-z;
        var b=ox*dir.x+oy*dir.y+oz*dir.z;
        var c=ox*ox+oy*oy+oz*oz-r*r;
        var d=b*b-c;
        if(d<0)return Infinity;
        var s=Math.sqrt(d),u=-b-s;
        return u>=0?u:(-b+s>=0?-b+s:Infinity);
    }
    function rayBox(origin,dir,c){
        var min=[c.x-c.w/2,0,c.z-c.d/2],max=[c.x+c.w/2,c.h,c.z+c.d/2];
        var o=[origin.x,origin.y,origin.z],v=[dir.x,dir.y,dir.z];
        var near=-Infinity,far=Infinity;
        for(var k=0;k<3;k++){
            if(Math.abs(v[k])<0.000001){if(o[k]<min[k]||o[k]>max[k])return Infinity;}
            else{var a=(min[k]-o[k])/v[k],b=(max[k]-o[k])/v[k];if(a>b){var q=a;a=b;b=q;}near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;}
        }
        return far>=0?Math.max(near,0):Infinity;
    }
    function splat(x,y,z){
        var s=primitive('sphere','Paint splash',x,y,z,0.34,0.23,0.34,Math.random()>.5?mats.turquoise:mats.yellow);
        splats.push({e:s,die:t+2.5});
    }
    function shoot(){
        if(ended||cooldown>0)return;
        cooldown=0.24;shots++;
        var dir=camera.forward.clone().normalize();
        var origin=camera.getPosition().clone();
        var best=45,hit=null;
        for(var i=0;i<blockers.length;i++)best=Math.min(best,rayBox(origin,dir,blockers[i]));
        for(var j=0;j<targets.length;j++){
            var a=targets[j];if(!a.alive)continue;
            var p=a.entity.getPosition();
            var distance=raySphere(origin,dir,p.x,1.40,p.z,0.88);
            if(distance<best){best=distance;hit=a;}
        }
        var end=origin.clone().add(dir.clone().scale(best));
        // Visual paintball, purely arcade: no physical weapon simulation.
        var pellet=primitive('sphere','Flying paintball',origin.x,origin.y,origin.z,0.17,0.17,0.17,mats.yellow);
        effects.push({e:pellet,from:origin,to:end,time:0,life:Math.max(0.07,Math.min(.65,best/58))});
        if(best<45)splat(end.x,end.y,end.z);
        if(hit){
            hit.alive=false;hit.downTime=t+4;hit.entity.enabled=false;hits++;score+=100;
            showMessage('🎯 İSABET! +100 PUAN',1);
        } else if(best>=45){showMessage('Boya hedefi bulamadı',0.4);}
        updateHud();
    }
    function updateHud(){
        $id('pb-points').textContent=score;
        $id('pb-targets').textContent=targets.filter(function(a){return a.alive;}).length;
        $id('pb-time').textContent=String(Math.floor(Math.max(0,timeLeft)/60)).padStart(2,'0')+':'+String(Math.floor(Math.max(0,timeLeft)%60)).padStart(2,'0');
        $id('pb-accuracy').textContent=shots?Math.round(hits/shots*100):0;
    }
    function reset(){
        score=0;hits=0;shots=0;timeLeft=120;cooldown=0;ended=false;
        px=0;pz=14.3;yaw=0;pitch=0;
        targets.forEach(function(a){a.alive=true;a.entity.enabled=true;});
        $id('pb-restart').style.display='none';
        showMessage('Yeni tur başladı! 🎨',2);
        updateHud();
    }
    $id('pb-restart').addEventListener('click',reset);
    function canMove(x,z){
        if(x<-16.9||x>16.9||z<-19.3||z>19.3)return false;
        for(var i=0;i<blockers.length;i++){
            var c=blockers[i];
            if(Math.abs(x-c.x)<c.w/2+0.46 && Math.abs(z-c.z)<c.d/2+0.46)return false;
        }
        return true;
    }
    function update(dt){
        dt=Math.min(dt,0.05);t+=dt;
        if(!ended){
            timeLeft-=dt;
            if(timeLeft<=0){timeLeft=0;ended=true;holdFire=false;showMessage('TUR BİTTİ — SKORUN: '+score,1000);$id('pb-restart').style.display='block';}
        }
        cooldown=Math.max(0,cooldown-dt);
        if(messageUntil<t)msg.style.display='none';
        if(!ended){
            var f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stickY;
            var r=(keys.KeyD?1:0)-(keys.KeyA?1:0)+stickX;
            var mag=Math.hypot(f,r);if(mag>1){f/=mag;r/=mag;}
            if(keys.ArrowLeft)yaw+=95*dt;
            if(keys.ArrowRight)yaw-=95*dt;
            var rad=yaw*Math.PI/180,sp=5.6*dt;
            var dx=(-Math.sin(rad)*f+Math.cos(rad)*r)*sp;
            var dz=(-Math.cos(rad)*f-Math.sin(rad)*r)*sp;
            if(canMove(px+dx,pz))px+=dx;
            if(canMove(px,pz+dz))pz+=dz;
            camera.setLocalPosition(px,eye,pz);
            camera.setLocalEulerAngles(pitch,yaw,0);
            marker.setLocalPosition(0,Math.sin(t*9)*0.006*(mag>0?1:0),0);
            if((holdFire||keys.Space)&&cooldown<=0)shoot();
            for(var j=0;j<targets.length;j++){
                var a=targets[j];
                if(!a.alive&&t>=a.downTime){a.alive=true;a.entity.enabled=true;}
                if(a.alive){a.entity.setPosition(a.baseX+Math.sin(t*0.85+a.phase)*0.48,0,a.z);a.entity.setEulerAngles(0,Math.sin(t+a.phase)*18,0);}
            }
        }
        for(var n=effects.length-1;n>=0;n--){
            var fx=effects[n];fx.time+=dt;var k=Math.min(1,fx.time/fx.life);
            fx.e.setPosition(fx.from.x+(fx.to.x-fx.from.x)*k,fx.from.y+(fx.to.y-fx.from.y)*k,fx.from.z+(fx.to.z-fx.from.z)*k);
            if(k>=1){fx.e.destroy();effects.splice(n,1);}
        }
        for(var m=splats.length-1;m>=0;m--){if(t>=splats[m].die){splats[m].e.destroy();splats.splice(m,1);}}
        updateHud();
    }
    updateHud();
    function dispose(){
        window.removeEventListener('keydown',keyDown);
        window.removeEventListener('keyup',keyUp);
        window.removeEventListener('mousemove',mouseMove);
        app.graphicsDevice.canvas.removeEventListener('pointerdown',mouseDown);
        hud.remove();style.remove();arena.destroy();
    }
    return {update:update,dispose:dispose};
}
// PlayCanvas Editor integration. In a new scene add the Script component to an entity,
// create a classic script asset named paintballNations.js, paste this file, and attach it.
var PaintballNations = pc.createScript('paintballNations');
PaintballNations.prototype.initialize = function() {
    this._paintball = createPaintballNationsGame(this.app);
    this.on('destroy', function() {
        if (this._paintball) this._paintball.dispose();
    }, this);
};
PaintballNations.prototype.update = function(dt) {
    if (this._paintball) this._paintball.update(dt);
};