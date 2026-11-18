/* Paintball Nations — Maçka OSM Paintball Training V0.3
 * Actual OSM roads/building outlines rendered by macka-viewer.js.
 * This module adds a purely fictional sporting arena, 15 red practice targets,
 * 14 blue teammate mannequins + the player, cover, score and mobile paintball.
 * It is NOT a networked 15v15 match.
 * © OpenStreetMap contributors — https://www.openstreetmap.org/copyright
 */
(function () {
    'use strict';
    var params = new URLSearchParams(window.location.search);
    if (params.get('play') !== '1') return;

    function mount(ev) {
        var map = ev.detail;
        if (!map || !map.app || !map.geo) return;
        var launchLink=document.getElementById('start-game');
        if(launchLink)launchLink.hidden=true;
        var app = map.app, camera = map.camera, boxes = [],
            cover = [], enemies = [], friends = [], particles = [];
        var score = 0, shots = 0, hits = 0, clock = 150,
            cooldown = 0, ended = false, tick = 0, recoil = 0;
        var attributions = ['© OpenStreetMap contributors'];
        var wallRings = map.geo.buildings.map(function (b) {return b.p;});
        var buildingBounds = map.geo.buildings.map(function (b) {
            var xs = b.p.map(function (p) {return p[0];}),
                zs = b.p.map(function (p) {return p[1];});
            return {
                minX:Math.min.apply(null,xs), maxX:Math.max.apply(null,xs),
                minZ:Math.min.apply(null,zs), maxZ:Math.max.apply(null,zs),
                minY:0, maxY:Math.max(3,Math.min(32,b.h || 8))
            };
        });

        function material(r,g,b) {
            var m = new pc.StandardMaterial();
            m.diffuse = new pc.Color(r,g,b);
            m.gloss = 23;
            m.update();
            return m;
        }
        var blue = material(0.06,0.62,0.94),
            red = material(0.98,0.19,0.36),
            yellow = material(1.0,0.77,0.18),
            green = material(0.22,0.95,0.73),
            white = material(0.9,0.97,0.96),
            dark = material(0.07,0.15,0.23),
            steel = material(0.29,0.38,0.49),
            paintColors = [green,yellow,blue,red];
        function localShape(parent,name,type,mat,x,y,z,sx,sy,sz) {
            var entity = new pc.Entity(name);
            entity.addComponent('render',{type:type,material:mat});
            entity.setLocalPosition(x,y,z);
            entity.setLocalScale(sx,sy,sz);
            parent.addChild(entity);
            return entity;
        }
        function fixedShape(name,type,mat,x,y,z,sx,sy,sz) {
            var e = new pc.Entity(name);
            app.root.addChild(e);
            return localShape(e,name+' mesh',type,mat,0,y,0,sx,sy,sz), e.setPosition(x,0,z),e;
        }
        function pointInPolygon(x,z,p) {
            var inside=false;
            for(var i=0,j=p.length-1;i<p.length;j=i++) {
                var a=p[i],b=p[j];
                if(((a[1]>z)!==(b[1]>z)) &&
                  x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
            }
            return inside;
        }
        function segDist(x,z,a,b) {
            var dx=b[0]-a[0],dz=b[1]-a[1],
                t=((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1);
            t=Math.max(0,Math.min(1,t));
            return Math.hypot(x-(a[0]+dx*t),z-(a[1]+dz*t));
        }
        function blocked(x,z,radius) {
            if(x < -96 || x > 96 || z < -124 || z > 124) return true;
            for(var k=0;k<wallRings.length;k++) {
                var polygon=wallRings[k];
                if(pointInPolygon(x,z,polygon)) return true;
                for(var i=0;i<polygon.length;i++) {
                    if(segDist(x,z,polygon[i],polygon[(i+1)%polygon.length])<radius) return true;
                }
            }
            for(var j=0;j<cover.length;j++) {
                var c=cover[j];
                if(Math.abs(x-c.x)<c.w/2+radius &&
                   Math.abs(z-c.z)<c.d/2+radius) return true;
            }
            return false;
        }
        // Keep real building footprints collidable in the playable central field.
        map.registerMoveGuard(function(x,z){return !blocked(x,z,0.75);});

        // Bright removable arena features; not real-world OSM objects.
        function barricade(name,x,z,w,d,h,col) {
            if(blocked(x,z,1)) return;
            var e = fixedShape(name,'box',col,x,h/2,z,w,h,d);
            boxes.push(e);
            fixedShape(name+' cap','box',white,x,h+.035,z,w+.09,.07,d+.09);
            cover.push({x:x,z:z,w:w,d:d,h:h});
        }
        [-58,-29,0,29,58].forEach(function(x,i) {
            barricade('North paintball cover '+i,x,-8,8,2.5,1.75,i%2?red:blue);
            barricade('South paintball cover '+i,x,15,7,2.6,1.55,i%2?blue:red);
        });
        [-80,80].forEach(function(x) {
            [-100,-45,45,100].forEach(function(z) {
                barricade('Side barrel',x,z,2.5,2.5,1.5,z>0?blue:red);
            });
        });
        // Team area stripes and large color markers.
        fixedShape('Blue spawn stripe','box',blue,0,.055,111,110,.10,.65);
        fixedShape('Red spawn stripe','box',red,0,.055,-111,110,.10,.65);
        fixedShape('Center mark','cylinder',yellow,0,.025,0,7,.045,7);
        var bannerA=fixedShape('BLUE','box',blue,-95,2,0,0.8,4,250);
        var bannerB=fixedShape('RED','box',red,95,2,0,0.8,4,250);
        bannerA.enabled=true;bannerB.enabled=true;

        // Cartoon sports dummies, not living opponents.
        function dummy(team,i,x,z) {
            var root=new pc.Entity((team==='red'?'Red':'Blue')+' paintball target '+(i+1));
            app.root.addChild(root);
            root.setPosition(x,0,z);
            var color=team==='red'?red:blue;
            localShape(root,'Feet','box',dark,0,.17,0,.86,.34,.42);
            localShape(root,'Sports suit','cylinder',color,0,1.16,0,.84,1.25,.84);
            localShape(root,'Paintball mask','sphere',dark,0,2.06,0,.75,.7,.75);
            localShape(root,'Face visor','box',white,0,2.09,-.36,.58,.23,.07);
            localShape(root,'Training plate','box',yellow,0,1.23,-.44,.54,.57,.08);
            return {entity:root,team:team,baseX:x,baseZ:z,phase:i*1.43,active:true};
        }
        function chooseFree(x,z) {
            for(var shift=0;shift<15;shift++){
                var cx=x + ((shift%5)-2)*5.5, cz=z + Math.floor(shift/5)*5;
                if(!blocked(cx,cz,1.2)) return [cx,cz];
            }
            return null;
        }
        // 15 red practice targets, 14 blue teammates + FPS player = 15 blue slots.
        for(var i=0;i<15;i++){
            var x=((i%5)-2)*21,z=-45-Math.floor(i/5)*21;
            var pos=chooseFree(x,z);
            if(pos)enemies.push(dummy('red',i,pos[0],pos[1]));
        }
        for(var j=0;j<14;j++){
            var fx=((j%5)-2)*19,fz=36+Math.floor(j/5)*23;
            var where=chooseFree(fx,fz);
            if(where)friends.push(dummy('blue',j,where[0],where[1]));
        }
        function findSpawn() {
            var options=[[0,114],[0,100],[-15,112],[15,112]];
            for(var i=0;i<options.length;i++) {
                if(!blocked(options[i][0],options[i][1],1.1))return options[i];
            }
            return [0,105];
        }
        var spawn=findSpawn();
        map.setPlayerPosition(spawn[0],spawn[1]);

        // A small paintball marker model anchored below/right of camera view.
        var marker=new pc.Entity('Free paintball starter marker');
        camera.addChild(marker);
        marker.setLocalPosition(.26,-.20,-.35);
        localShape(marker,'Marker shell','box',steel,.12,-.28,-.52,.23,.20,.7);
        localShape(marker,'Grip','box',dark,.13,-.42,-.42,.14,.3,.14);
        var tube=localShape(marker,'Paintball barrel','cylinder',blue,.12,-.25,-.98,.1,.71,.1);
        tube.setLocalEulerAngles(90,0,0);
        localShape(marker,'Paint hopper','sphere',yellow,.12,-.08,-.43,.29,.33,.30);
        marker.setLocalScale(.76,.76,.76);

        var hud=document.createElement('div');
        hud.id='macka-paintball-hud';
        hud.innerHTML=
            '<div id="mp-score"><div>🔵 MAVİ TAKIM <b id="mp-blue">0</b> : <b id="mp-red">15</b> 🔴 HEDEF</div>'+
            '<small>⏱ <span id="mp-clock">02:30</span> · PUAN <span id="mp-points">0</span> · İSABET <span id="mp-accuracy">0</span>%</small></div>'+
            '<div id="mp-cross">+</div><div id="mp-flash"></div>'+
            '<div id="mp-tip">🎨 MAÇKA ANTRENMANI · 15 KIRMIZI HEDEF · 14 MAVİ MAKET</div>'+
            '<button id="mp-fire" type="button">BOYA!</button>'+
            '<button id="mp-restart" type="button" hidden>YENİDEN OYNA</button>';
        document.body.appendChild(hud);
        var $=function(sel){return hud.querySelector(sel);};
        var fire=$('#mp-fire'), restart=$('#mp-restart'),message=$('#mp-flash'), messageUntil=0;
        function announce(msg,seconds){message.textContent=msg;message.style.opacity='1';messageUntil=tick+(seconds||.85);}
        function scoreboard() {
            hud.dataset.shots=String(shots);
            hud.dataset.redCount=String(enemies.length);
            hud.dataset.blueTeammates=String(friends.length);
            $('#mp-blue').textContent=hits;
            $('#mp-red').textContent=enemies.filter(function(e){return e.active;}).length;
            $('#mp-points').textContent=score;
            $('#mp-accuracy').textContent=shots?Math.round(hits/shots*100):0;
            var secs=Math.max(0,Math.ceil(clock));
            $('#mp-clock').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
        }
        function raySphere(o,d,pos,r) {
            var ox=o.x-pos.x,oy=o.y-pos.y,oz=o.z-pos.z,
                b=ox*d.x+oy*d.y+oz*d.z,
                c=ox*ox+oy*oy+oz*oz-r*r,delta=b*b-c;
            if(delta<0) return Infinity;
            var t=-b-Math.sqrt(delta),u=-b+Math.sqrt(delta);
            return t>=0?t:(u>=0?u:Infinity);
        }
        function rayBox(o,d,b) {
            var lo=[b.minX,b.minY,b.minZ],hi=[b.maxX,b.maxY,b.maxZ],
                origin=[o.x,o.y,o.z],dir=[d.x,d.y,d.z],near=0,far=220;
            for(var i=0;i<3;i++){
                if(Math.abs(dir[i])<.000001){
                    if(origin[i]<lo[i] || origin[i]>hi[i])return Infinity;
                } else {
                    var t=(lo[i]-origin[i])/dir[i],u=(hi[i]-origin[i])/dir[i];
                    if(t>u){var temp=t;t=u;u=temp;}
                    near=Math.max(near,t);far=Math.min(far,u);
                    if(near>far)return Infinity;
                }
            }
            return far>=0?near:Infinity;
        }
        function spray(pos) {
            var mat=paintColors[Math.floor(Math.random()*paintColors.length)];
            for(var i=0;i<5;i++){
                var angle=Math.PI*2*i/5,offset=.14+Math.random()*.3;
                var dot=fixedShape('Paint splatter','sphere',mat,
                    pos.x+Math.cos(angle)*offset,
                    Math.max(.15,pos.y+(Math.random()-.5)*.4),
                    pos.z+Math.sin(angle)*offset,
                    .17,.12,.17);
                particles.push({e:dot,life:1.4});
            }
        }
        var held=false;
        function shoot(){
            if(ended || map.getMode() || cooldown>0)return;
            cooldown=.22;shots++;recoil=1;
            var o=camera.getPosition().clone(),d=camera.forward.clone().normalize(),
                limit=175,target=null;
            for(var i=0;i<buildingBounds.length;i++){
                limit=Math.min(limit,rayBox(o,d,buildingBounds[i]));
            }
            for(var c=0;c<cover.length;c++){
                var b=cover[c],aabb={minX:b.x-b.w/2,maxX:b.x+b.w/2,
                    minY:0,maxY:b.h,minZ:b.z-b.d/2,maxZ:b.z+b.d/2};
                limit=Math.min(limit,rayBox(o,d,aabb));
            }
            enemies.forEach(function(e){
                if(!e.active)return;
                var p=e.entity.getPosition(),center=new pc.Vec3(p.x,1.35,p.z);
                var dist=raySphere(o,d,center,.85);
                if(dist<limit){limit=dist;target=e;}
            });
            // Blue teammates block paintballs rather than counting as enemy hits.
            friends.forEach(function(e){
                var p=e.entity.getPosition(),center=new pc.Vec3(p.x,1.35,p.z);
                var dist=raySphere(o,d,center,.85);
                if(dist<limit){limit=dist;target=null;}
            });
            var point=o.clone().add(d.clone().scale(limit));
            if(limit<175)spray(point);
            if(target){
                target.active=false;
                target.entity.enabled=false;
                hits++;score+=100;
                announce('🎯 BOYA İSABETİ! +100',1.0);
                if(hits>=enemies.length)finish('TÜM KIRMIZI HEDEFLER BOYANDI!');
            } else announce('BOYA ATIŞI',.32);
            scoreboard();
        }
        function finish(msg){
            ended=true;held=false;
            restart.hidden=false;
            announce(msg+' · '+score+' PUAN',100000);
            fire.disabled=true;
        }
        function reset(){
            score=0;shots=0;hits=0;clock=150;cooldown=0;ended=false;held=false;
            fire.disabled=false;restart.hidden=true;
            enemies.forEach(function(e){e.active=true;e.entity.enabled=true;});
            map.setPlayerPosition(spawn[0],spawn[1]);
            map.setMode(false);
            scoreboard();announce('YENİ TUR BAŞLADI',1.4);
        }
        fire.addEventListener('pointerdown',function(ev){
            ev.preventDefault();
            held=true;fire.setPointerCapture(ev.pointerId);shoot();
        });
        function fireUp(){held=false;}
        fire.addEventListener('pointerup',fireUp);
        fire.addEventListener('pointercancel',fireUp);
        restart.addEventListener('click',reset);
        window.addEventListener('keydown',function(ev){
            if(ev.code==='Space'){ev.preventDefault();held=true;shoot();}
        });
        window.addEventListener('keyup',function(ev){if(ev.code==='Space')held=false;});
        // Browser mouse aiming, with no change to mobile touch-look behavior.
        var canvas=app.graphicsDevice.canvas;
        canvas.addEventListener('pointerdown',function(ev){
            if(ev.button!==0 || map.getMode())return;
            shoot();
            if(canvas.requestPointerLock && document.pointerLockElement!==canvas){
                canvas.requestPointerLock();
            }
        });
        document.addEventListener('mousemove',function(ev){
            if(document.pointerLockElement===canvas && map.adjustLook){
                map.adjustLook(ev.movementX,ev.movementY);
            }
        });
        map.setMode(false);
        scoreboard();
        announce('MAÇKA ARENASINA HOŞ GELDİN!',2);
        app.on('update',function(dt){
            dt=Math.min(.05,Math.max(0,dt));
            tick+=dt;
            if(messageUntil<tick)message.style.opacity='0';
            if(map.getMode() || ended) return;
            clock-=dt;
            if(clock<=0){clock=0;finish('SÜRE BİTTİ');scoreboard();return;}
            cooldown=Math.max(0,cooldown-dt);
            recoil=Math.max(0,recoil-dt*8);
            marker.setLocalPosition(.26,-.20-recoil*.025,-.35+recoil*.065);
            if(held && cooldown<=0)shoot();
            // Subtle mannequin sway only; no autonomous firing or simulated multiplayer.
            enemies.forEach(function(e,i){
                if(e.active)e.entity.setLocalEulerAngles(0,Math.sin(tick*.8+e.phase)*9,0);
            });
            friends.forEach(function(e){e.entity.setLocalEulerAngles(0,Math.sin(tick*.6+e.phase)*7,0);});
            for(var i=particles.length-1;i>=0;i--){
                var p=particles[i];p.life-=dt;
                if(p.life<=0){p.e.destroy();particles.splice(i,1);}
            }
            scoreboard();
        });
        console.info('Paintball Nations Maçka training ready. OSM features:',map.geo.metadata.counts,
            'red practice targets:',enemies.length, 'blue mannequins:',friends.length);
    }
    window.addEventListener('paintball-macka-ready',mount,{once:true});
    // Defensive fallback if the map viewer completed before this script loaded.
    if(window.paintballMacka)mount({detail:window.paintballMacka});
})();