/* Paintball Nations — real OSM Maçka 3D map preview.
 * Real road centerlines/building footprints sourced from © OpenStreetMap contributors.
 * Procedural elevations/materials are stylized, not survey data.
 * No third-party map tile server is used.
 */
(async function () {
    'use strict';
    var status = document.getElementById('status');
    var canvas = document.getElementById('viewport');
    function fail(e) {
        console.error(e);
        status.textContent = 'Harita açılamadı: ' + (e && e.message ? e.message : String(e));
        status.style.display = 'block';
    }
    try {
        if (!window.pc) throw new Error('PlayCanvas 3D motoru yüklenemedi');
        var res = await fetch('./istanbul-macka.json', {cache: 'no-cache'});
        if (!res.ok) throw new Error('OSM verisi HTTP ' + res.status);
        var geo = await res.json();
        if (!geo.metadata || !Array.isArray(geo.roads)) throw new Error('OSM harita biçimi geçersiz');
        var app = new pc.Application(canvas, {
            graphicsDeviceOptions: {antialias: true, alpha: false}
        });
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);
        app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.4);
        app.start();
        var mats = {};
        function material(key,r,g,b) {
            var m = new pc.StandardMaterial();
            m.diffuse = new pc.Color(r,g,b);
            m.cull = pc.CULLFACE_NONE;
            m.gloss = 10;
            m.update();
            mats[key] = m;
            return m;
        }
        material('ground',0.14,0.25,0.24);
        material('park',0.25,0.47,0.31);
        material('road',0.31,0.37,0.42);
        material('footway',0.61,0.57,0.49);
        material('wall',0.80,0.73,0.62);
        material('roof',0.37,0.47,0.57);
        material('boundary',0.13,0.69,0.72);

        function box(name, x,y,z, w,h,d, mat) {
            var e = new pc.Entity(name);
            e.addComponent('render',{type:'box',material:mat});
            e.setPosition(x,y,z);
            e.setLocalScale(w,h,d);
            app.root.addChild(e);
            return e;
        }
        // OSM API bbox: ~337 x 323 m, generalized as a flat terrain for V0.3.
        box('Flat map base (terrain not yet surveyed)',0,-0.23,0,350,0.42,345,mats.ground);
        var bounds = [-168,168,-161,161];
        var geometry = {};
        function buffer(name) {
            return geometry[name] || (geometry[name]={p:[],n:[],ind:[]});
        }
        function addTri(name,a,b,c,normal) {
            var d=buffer(name), k=d.p.length/3;
            d.p.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
            for(var i=0;i<3;i++)d.n.push(normal[0],normal[1],normal[2]);
            d.ind.push(k,k+1,k+2);
        }
        function addQuad(name,a,b,c,d,normal) {
            addTri(name,a,b,c,normal); addTri(name,a,c,d,normal);
        }
        function clip(a,b) {
            var xmin=bounds[0], xmax=bounds[1], zmin=bounds[2],zmax=bounds[3];
            var dx=b[0]-a[0], dz=b[1]-a[1], t0=0,t1=1;
            var p=[-dx,dx,-dz,dz],q=[a[0]-xmin,xmax-a[0],a[1]-zmin,zmax-a[1]];
            for (var i=0;i<4;i++) {
                if (Math.abs(p[i])<1e-10) {if(q[i]<0)return null;}
                else {
                    var u=q[i]/p[i];
                    if(p[i]<0) t0=Math.max(t0,u); else t1=Math.min(t1,u);
                    if(t0>t1)return null;
                }
            }
            return [[a[0]+dx*t0,a[1]+dz*t0],[a[0]+dx*t1,a[1]+dz*t1]];
        }
        geo.roads.forEach(function(road) {
            var pts=road.p, kind=road.type;
            var width=Math.min(12,Math.max(1.6,road.width||3));
            var group=['footway','path','steps','pedestrian','cycleway'].includes(kind)?'footway':'road';
            for(var i=1;i<pts.length;i++) {
                var part=clip(pts[i-1],pts[i]);
                if (!part)continue;
                var a=part[0],b=part[1],vx=b[0]-a[0],vz=b[1]-a[1],ll=Math.hypot(vx,vz);
                if(ll<0.04)continue;
                var nx=-vz/ll*width/2,nz=vx/ll*width/2;
                addQuad(group,[a[0]+nx,0.01,a[1]+nz],
                    [b[0]+nx,0.01,b[1]+nz],
                    [b[0]-nx,0.01,b[1]-nz],
                    [a[0]-nx,0.01,a[1]-nz],[0,1,0]);
            }
        });

        function signedArea(ring) {
            var sum=0;
            for(var i=0;i<ring.length;i++) {
                var a=ring[i],b=ring[(i+1)%ring.length];
                sum += a[0]*b[1]-b[0]*a[1];
            }
            return sum/2;
        }
        function insideTri(p,a,b,c) {
            function side(u,v,w) {return (v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);}
            var s1=side(a,b,p),s2=side(b,c,p),s3=side(c,a,p);
            return (s1>=-0.0001 && s2>=-0.0001 && s3>=-0.0001) ||
                   (s1<=0.0001 && s2<=0.0001 && s3<=0.0001);
        }
        function triangulate(points) {
            var seq=points.map(function(_,i){return i;}), result=[];
            var orient=signedArea(points)>0?1:-1,limit=0;
            while(seq.length>3 && limit++<1000) {
                var cut=false;
                for(var i=0;i<seq.length;i++) {
                    var i0=seq[(i+seq.length-1)%seq.length],
                        i1=seq[i],i2=seq[(i+1)%seq.length],
                        a=points[i0],b=points[i1],c=points[i2];
                    var cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
                    if(cross*orient<=0.001)continue;
                    var blocked=false;
                    for(var j=0;j<seq.length;j++) {
                        var k=seq[j];
                        if(k!==i0 && k!==i1 && k!==i2 && insideTri(points[k],a,b,c)){
                            blocked=true;break;
                        }
                    }
                    if(blocked)continue;
                    result.push([i0,i1,i2]);seq.splice(i,1);cut=true;break;
                }
                if(!cut)break;
            }
            if(seq.length===3)result.push(seq.slice());
            return result;
        }
        var built=0, green=0;
        geo.greenAreas.forEach(function(f) {
            var ring=f.p;
            if(ring.length<3 || ring.length>160) return;
            var faces=triangulate(ring);
            for(var i=0;i<faces.length;i++) {
                var t=faces[i],a=ring[t[0]],b=ring[t[1]],c=ring[t[2]];
                addTri('park',[a[0],0.045,a[1]],[b[0],0.045,b[1]],[c[0],0.045,c[1]],[0,1,0]);
            }
            green++;
        });
        geo.buildings.forEach(function(f) {
            var ring=f.p, h=Math.max(3,Math.min(32,f.h||8));
            if (ring.length<3 || ring.length>160) return;
            var faces=triangulate(ring);
            for(var j=0;j<faces.length;j++) {
                var t=faces[j],a=ring[t[0]],b=ring[t[1]],c=ring[t[2]];
                addTri('roof',[a[0],h,a[1]],[b[0],h,b[1]],[c[0],h,c[1]],[0,1,0]);
            }
            for(var i=0;i<ring.length;i++) {
                var a=ring[i],b=ring[(i+1)%ring.length], dx=b[0]-a[0],dz=b[1]-a[1];
                var len=Math.hypot(dx,dz)||1;
                addQuad('wall',[a[0],0,a[1]],[b[0],0,b[1]],
                    [b[0],h,b[1]],[a[0],h,a[1]],
                    [-dz/len,0,dx/len]);
            }
            built++;
        });
        function submit(name) {
            var d=geometry[name];if(!d || d.p.length<9)return;
            var mesh=new pc.Mesh(app.graphicsDevice);
            mesh.setPositions(new Float32Array(d.p));
            mesh.setNormals(new Float32Array(d.n));
            mesh.setIndices(d.ind);
            mesh.update();
            var instance=new pc.MeshInstance(mesh,mats[name]);
            var e=new pc.Entity('OSM geometry: '+name);
            e.addComponent('render',{meshInstances:[instance]});
            app.root.addChild(e);
        }
        ['park','road','footway','wall','roof'].forEach(submit);
        // Virtual marked area boundary: this is a guide, NOT a physical surveyed feature.
        var perimeter=[
            [0,0,-161,336,.12,.3],
            [0,0,161,336,.12,.3],
            [-168,0,0,.3,.12,322],
            [168,0,0,.3,.12,322]
        ];
        perimeter.forEach(function(b,i) {box('Study boundary '+i,b[0],b[1],b[2],b[3],b[4],b[5],mats.boundary);});
        var light=new pc.Entity('Sun');
        light.addComponent('light',{type:'directional',color:new pc.Color(1,0.96,0.89),intensity:1.7,castShadows:false});
        light.setEulerAngles(65,40,0);app.root.addChild(light);
        app.scene.ambientLight=new pc.Color(0.57,0.64,0.72);
        var camera=new pc.Entity('Map viewer');
        camera.addComponent('camera',{fov:66,nearClip:0.1,farClip:1600,clearColor:new pc.Color(0.55,0.75,0.87)});
        app.root.addChild(camera);
        var moveGuard=null;
        var bird=true,px=0,pz=120,yaw=0,pitch=0,keys={},lookId=null,
            stickId=null,stickX=0,stickY=0,stick=document.getElementById('stick'),
            joy=document.getElementById('joystick'),look=document.getElementById('look');
        function place() {
            if(bird){camera.setPosition(0,250,265);camera.lookAt(0,0,0);}
            else {camera.setPosition(px,1.82,pz);camera.setEulerAngles(pitch,yaw,0);}
        }
        place();
        var mode=document.getElementById('mode');
        function setMode(isBird) {
            bird=isBird;
            mode.textContent=bird?'👣 Yürüyüşe geç':'🗺️ Kuşbakışı göster';
            document.getElementById('mobileControls').style.display=bird?'none':'block';
            place();
        }
        mode.addEventListener('click',function(){setMode(!bird);});
        var detail=document.getElementById('stats');
        detail.textContent='Gerçek OSM: '+geo.roads.length+' yol · '+built+' bina · '+green+' yeşil alan';
        function joyMove(ev) {
            var rect=joy.getBoundingClientRect(),dx=ev.clientX-(rect.left+rect.width/2),
                dy=ev.clientY-(rect.top+rect.height/2), limit=rect.width*0.35,
                len=Math.hypot(dx,dy)||1,scale=Math.min(1,limit/len);
            stickX=dx*scale/limit;stickY=dy*scale/limit;
            stick.style.transform='translate('+(dx*scale)+'px,'+(dy*scale)+'px)';
        }
        joy.addEventListener('pointerdown',function(e){stickId=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e);});
        joy.addEventListener('pointermove',function(e){if(e.pointerId===stickId)joyMove(e);});
        function release(e){if(e.pointerId===stickId){stickId=null;stickX=0;stickY=0;stick.style.transform='translate(0,0)';}}
        joy.addEventListener('pointerup',release);joy.addEventListener('pointercancel',release);
        look.addEventListener('pointerdown',function(e){lookId={id:e.pointerId,x:e.clientX,y:e.clientY};look.setPointerCapture(e.pointerId);});
        look.addEventListener('pointermove',function(e){
            if(!lookId || e.pointerId!==lookId.id)return;
            yaw-=0.18*(e.clientX-lookId.x);
            pitch=Math.max(-60,Math.min(60,pitch-0.14*(e.clientY-lookId.y)));
            lookId.x=e.clientX;lookId.y=e.clientY;
        });
        function stopLook(e){if(lookId && e.pointerId===lookId.id)lookId=null;}
        look.addEventListener('pointerup',stopLook);look.addEventListener('pointercancel',stopLook);
        window.addEventListener('keydown',function(e){keys[e.code]=true;});
        window.addEventListener('keyup',function(e){keys[e.code]=false;});
        app.on('update',function(dt){
            if(bird)return;
            var f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stickY;
            var r=(keys.KeyD?1:0)-(keys.KeyA?1:0)+stickX;
            var size=Math.hypot(f,r);if(size>1){f/=size;r/=size;}
            var angle=yaw*Math.PI/180,step=Math.min(dt,0.05)*13;
            var nx=Math.max(-165,Math.min(165,px+(-Math.sin(angle)*f+Math.cos(angle)*r)*step));
            var nz=Math.max(-155,Math.min(155,pz+(-Math.cos(angle)*f-Math.sin(angle)*r)*step));
            if(!moveGuard || moveGuard(nx,pz)) px=nx;
            if(!moveGuard || moveGuard(px,nz)) pz=nz;
            place();
        });
        window.addEventListener('resize',function(){app.resizeCanvas();});
        setMode(true);
        // Optional game extension. The OSM geometry stays in this map viewer,
        // while paintball gameplay remains a separate, non-destructive module.
        var shared = {
            app:app, camera:camera, geo:geo, box:box, setMode:setMode,
            getMode:function(){return bird;},
            getPlayerPosition:function(){return {x:px,z:pz};},
            setPlayerPosition:function(x,z){px=x;pz=z;place();},
            registerMoveGuard:function(fn){moveGuard=fn;},
            adjustLook:function(dx,dy){
                yaw -= 0.18 * dx;
                pitch = Math.max(-60, Math.min(60, pitch - 0.14 * dy));
                place();
            }
        };
        window.paintballMacka = shared;
        window.dispatchEvent(new CustomEvent('paintball-macka-ready',{detail:shared}));
        status.style.display='none';
    } catch(e) {fail(e);}
})();
