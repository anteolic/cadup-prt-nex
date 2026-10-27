'use strict';
(()=>{
 const $=id=>document.getElementById(id),board=$('board'),g=board.getContext('2d');
 const KEY='infoa_grid_loops_v1',WIDTH=2000,MIN=5,HISTORY=80;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 let segments=[],past=[],future=[],first=null,preview=null,mode='edit',wallsVisible=true,selected=null,selectedWall=null,wallSession=null;
 let w=0,h=0,dpr=1,scale=1,ox=0,oy=0,height=2000,gesture=null,frame=false,clearArmed=false;
 let cachedKey=null,cached=null,pendingTags=[],dimensionHits=[],editingDimension=null,editorSelectionKey=null;
 const pointers=new Map();
 const copy=a=>a.map(s=>({...s}));
 function save(){try{localStorage.setItem(KEY,JSON.stringify({segments,wallsVisible}));}catch(_){}}
 function restore(){
  try{
   const saved=localStorage.getItem(KEY);
   if(saved){const data=JSON.parse(saved);segments=GridGeometry.normalize(Array.isArray(data.segments)?data.segments:[]);wallsVisible=data.wallsVisible!==false;}
   else{
    // Zadržavaju se obrisi spremljenih prostorija; stari ručno crtani zidovi se ne učitavaju.
    const old=JSON.parse(localStorage.getItem('infoa_tlocrt_minimal_v1')||'null');
    if(old&&Array.isArray(old.rooms)){
     const rects=old.rooms.filter(r=>['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0);
     const edges=[];
     for(const group of RoomGeometry.groups(rects))for(const e of RoomGeometry.union(group.rects).edges){
      edges.push(e.axis==='h'?{x1:e.span[0],y1:e.line,x2:e.span[1],y2:e.line}:{x1:e.line,y1:e.span[0],x2:e.line,y2:e.span[1]});
     }segments=GridGeometry.normalize(edges);
    }
   }
  }catch(_){segments=[];}
 }
 function model(){
  const key=JSON.stringify(segments);
  if(cachedKey!==key){const detected=GridGeometry.detectWithDoors(segments),layout=RoomGeometry.layout(detected.rooms,segments);cached={...detected,layout,wallOutline:RoomGeometry.union([...layout.outer,...layout.inner])};cachedKey=key;}
  return cached;
 }
 const point=(x,y)=>({x:(x-ox)/scale,y:(y-oy)/scale});
 const screen=p=>({x:ox+p.x*scale,y:oy+p.y*scale});
 function step(){for(const s of [5,10,20,50,100,200,500,1000,2000])if(s*scale>=19)return s;return 2000;}
 function snap(x,y){
  const raw=point(x,y),unit=step();
  let q={x:clamp(Math.round(raw.x/unit)*unit,0,WIDTH),y:clamp(Math.round(raw.y/unit)*unit,0,height)},distance=14;
  for(const s of segments)for(const p of [{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}]){
   const d=Math.hypot(raw.x-p.x,raw.y-p.y)*scale;if(d<distance){distance=d;q={...p};}
  }
  // Spoj na postojeći potez zadržava točnu koordinatu i kad se razina mreže promijeni.
  for(const s of segments){
   if(s.y1===s.y2&&q.x>=s.x1&&q.x<=s.x2&&Math.abs(raw.y-s.y1)*scale<9)q.y=s.y1;
   if(s.x1===s.x2&&q.y>=s.y1&&q.y<=s.y2&&Math.abs(raw.x-s.x1)*scale<9)q.x=s.x1;
  }
  return q;
 }
 function second(x,y,axis=null){
  const raw=point(x,y),q=snap(x,y),horizontal=axis?axis==='h':Math.abs(raw.x-first.x)>=Math.abs(raw.y-first.y);
  return horizontal?{x:q.x,y:first.y}:{x:first.x,y:q.y};
 }
 const lengthText=cm=>cm.toLocaleString('hr-HR',{maximumFractionDigits:1})+' cm';
 function resetClear(){clearArmed=false;$('clearAll').textContent='Briši sve';$('clearAll').classList.remove('armed');}
 function status(message){
  $('status').textContent=message||'';
  $('status').hidden=!message;
  $('roomArea').textContent='';
  for(const [id,value] of [['drawMode','draw'],['editMode','edit']]){
   $(id).classList.toggle('active',mode===value);$(id).setAttribute('aria-pressed',String(mode===value));
  }
  $('toggleWalls').setAttribute('aria-pressed',String(wallsVisible));
  $('toggleWalls').setAttribute('aria-label',wallsVisible?'Sakrij zidove':'Prikaži zidove');
  $('toggleWalls').setAttribute('title',wallsVisible?'Zidovi uključeni':'Zidovi isključeni');
  $('cancel').hidden=!first;
  const editingWall=mode==='edit'&&!!selectedWall;
  $('wallActions').hidden=!editingWall;
  $('mainTools').hidden=editingWall;
  syncDimensionEditor();$('undo').disabled=!past.length&&!first;$('redo').disabled=!future.length;
 }
 function commit(before){
  if(JSON.stringify(before)===JSON.stringify(segments)){status();draw();return;}
  past.push(before);if(past.length>HISTORY)past.shift();future=[];selected=null;selectedWall=null;wallSession=null;save();resetClear();status();draw();
 }
 function add(end){
  if(!first)return;
  if(first.x===end.x&&first.y===end.y){status('Odaberi drugu točku linije');return;}
  const before=copy(segments),stroke={x1:first.x,y1:first.y,x2:end.x,y2:end.y};
  segments=GridGeometry.normalize([...segments,stroke]);
  first=mode==='draw'?{...end}:null;preview=first;commit(before);
 }
 function undo(){
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'||gesture?.type==='room-move'){cancelInteraction();return;}
  if(first){first=null;preview=null;status();draw();return;}
  if(!past.length)return;future.push(copy(segments));segments=past.pop();selected=null;selectedWall=null;wallSession=null;save();resetClear();status();draw();
 }
 function redo(){if(!future.length)return;past.push(copy(segments));segments=future.pop();selected=null;selectedWall=null;wallSession=null;save();status();draw();}
 function hitWall(x,y){
  const raw=point(x,y);let best=null,solid=null,solidDistance=Infinity,distance=wallsVisible?Math.max(15,30*scale+3):15;
  const current=model();
  for(const wall of GridGeometry.atomic(segments)){
   const horizontal=wall.y1===wall.y2,along=horizontal?raw.x:raw.y;
   const d=Math.hypot((horizontal?raw.y:raw.x)-(horizontal?wall.y1:wall.x1),along-clamp(along,horizontal?wall.x1:wall.y1,horizontal?wall.x2:wall.y2))*scale;
   if(RoomGeometry.wallSelection(current.rooms,segments,wall,current.layout).some(r=>raw.x>=r.x&&raw.x<=r.x+r.width&&raw.y>=r.y&&raw.y<=r.y+r.height)&&d<solidDistance){solidDistance=d;solid=wall;}
   if(d<distance){distance=d;best=wall;}
  }return solid||best;
 }
 function hitHandle(x,y){
  if(!selectedWall)return null;
  let endpoint=null,distance=20;
  for(const n of [1,2]){const p=screen({x:selectedWall['x'+n],y:selectedWall['y'+n]}),d=Math.hypot(x-p.x,y-p.y);if(d<distance){endpoint=n;distance=d;}}
  return endpoint;
 }
 function updateWallLength(p,drag){
  const h=drag.wall.y1===drag.wall.y2,axis=h?'x':'y';
  const delta=(h?p.x-drag.start.x:p.y-drag.start.y)/scale;
  const target=Math.round((drag.wall[axis+drag.endpoint]+delta)/step())*step();
  const resized=GridGeometry.resizeWall(drag.before,drag.wall,drag.endpoint,target,MIN,WIDTH,height);
  segments=resized.segments;selectedWall=resized.wall;drag.currentWall=resized.wall;schedule();
 }
 function updateWall(p,drag){
  const horizontal=drag.wall.y1===drag.wall.y2;
  const raw=(horizontal?p.y-drag.start.y:p.x-drag.start.x)/scale;
  const old=horizontal?drag.wall.y1:drag.wall.x1;
  const target=Math.round((old+raw)/step())*step();
  const base=horizontal?drag.baseWall.y1:drag.baseWall.x1;
  const moved=GridGeometry.moveWall(drag.baseSegments,drag.baseWall,target-base,MIN,WIDTH,height);
  segments=moved.segments;selectedWall=moved.wall;drag.currentWall=moved.wall;drag.currentOffset=moved.delta;schedule();
 }
 function updateRoom(p,drag){
  const dx=Math.round((p.x-drag.start.x)/scale/step())*step(),dy=Math.round((p.y-drag.start.y)/scale/step())*step();
  const moved=GridGeometry.moveRoom(drag.before,drag.face.rects,dx,dy,WIDTH,height);
  const detected=GridGeometry.detectWithDoors(moved.segments);
  if(detected.faces.length!==drag.faceCount)return;
  segments=moved.segments;drag.dx=moved.dx;drag.dy=moved.dy;
  const cell=drag.face.rects.reduce((a,b)=>a.width*a.height>=b.width*b.height?a:b);
  const x=cell.x+cell.width/2+moved.dx,y=cell.y+cell.height/2+moved.dy;
  selected=detected.rooms.find(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height)?.roomKey??null;schedule();
 }
 function cancelInteraction(){
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'){segments=gesture.before;selectedWall=gesture.wall;wallSession=gesture.beforeSession;}
  if(gesture?.type==='room-move'){segments=gesture.before;selected=gesture.face.id;}
  gesture=null;pointers.clear();first=null;preview=null;status();draw();
 }
 function limitPan(){
  const availableX=w-WIDTH*scale,availableY=h-height*scale;
  ox=availableX>0?availableX/2:clamp(ox,availableX,0);
  oy=availableY>0?availableY/2:clamp(oy,availableY,0);
 }
 function zoomAt(factor,x=w/2,y=h/2){
  const anchor=point(x,y);scale=clamp(scale*factor,w/WIDTH,w/WIDTH*25);ox=x-anchor.x*scale;oy=y-anchor.y*scale;limitPan();status();draw();
 }
 function fit(){scale=w/WIDTH;ox=0;oy=0;limitPan();draw();}
 function resize(){
  const width=board.clientWidth,boardHeight=board.clientHeight;if(!width||!boardHeight)return;
  const initial=!w;
  w=width;h=boardHeight;dpr=Math.min(window.devicePixelRatio||1,3);board.width=w*dpr;board.height=h*dpr;
  // Samo prvo otvaranje postavlja prikaz. Tipkovnica, paneli i rotacija ne mijenjaju kameru.
  height=2000;
  if(initial){scale=Math.max(w/WIDTH,h/height);ox=0;oy=0;}
  draw();
 }
 function schedule(){if(frame)return;frame=true;requestAnimationFrame(()=>{frame=false;status();draw();});}
 function tag(x,y,text,color='#24557e',vertical=false,priority=1,dimension=null){pendingTags.push({x,y,text,color,vertical,priority,dimension});}
 function paintTags(){
  const occupied=[];dimensionHits=[];
  for(const {x:rawX,y:rawY,text,color,vertical,priority,dimension} of pendingTags.sort((a,b)=>b.priority-a.priority)){
  let x=rawX,y=rawY;
  const base=priority===3?7:priority===1?8:12;
  const size=clamp(base+Math.log2(Math.max(1,scale/(w/WIDTH))),base,base+2),boxHeight=size+(priority===3?4:6);
  g.save();g.globalAlpha=(mode==='edit'&&selectedWall&&priority<5)?0.3:1;g.font='600 '+size+'px system-ui';
  const width=g.measureText(text).width+(priority===3?6:10),halfX=(vertical?boxHeight:width)/2,halfY=(vertical?width:boxHeight)/2;
  x=clamp(x,Math.max(0,ox)+halfX+3,Math.min(w,ox+WIDTH*scale)-halfX-3);
  y=clamp(y,Math.max(0,oy)+halfY+3,Math.min(h,oy+height*scale)-halfY-3);
  const bounds={left:x-halfX-3,right:x+halfX+3,top:y-halfY-2,bottom:y+halfY+2};
  if(occupied.some(r=>r.left<bounds.right&&r.right>bounds.left&&r.top<bounds.bottom&&r.bottom>bounds.top)){g.restore();continue;}
  occupied.push(bounds);if(dimension)dimensionHits.push({...bounds,dimension});g.translate(x,y);if(vertical)g.rotate(-Math.PI/2);
  g.beginPath();g.roundRect(-width/2,-boxHeight/2,width,boxHeight,Math.min(5,boxHeight/2));
  g.fillStyle='#f1f3f5';g.fill();g.strokeStyle='#cbd0d6';g.lineWidth=.8;g.stroke();
  g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(text,0,0);g.restore();
  }
 }
 function visibleWallCenter(s,padding=24){
  const a=screen({x:s.x1,y:s.y1}),b=screen({x:s.x2,y:s.y2}),horizontal=s.y1===s.y2;
  if(horizontal){
   if(a.y < -padding||a.y>h+padding||Math.max(a.x,b.x)<0||Math.min(a.x,b.x)>w)return null;
   return {x:(Math.max(0,Math.min(a.x,b.x))+Math.min(w,Math.max(a.x,b.x)))/2,y:a.y};
  }
  if(a.x < -padding||a.x>w+padding||Math.max(a.y,b.y)<0||Math.min(a.y,b.y)>h)return null;
  return {x:a.x,y:(Math.max(0,Math.min(a.y,b.y))+Math.min(h,Math.max(a.y,b.y)))/2};
 }
 function draw(){
  if(!w||!h)return;
  const current=model();pendingTags=[];g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.clearRect(0,0,w,h);g.fillStyle='#e9eef3';g.fillRect(0,0,w,h);
  g.fillStyle='#fff';g.fillRect(ox,oy,WIDTH*scale,height*scale);
  g.globalAlpha=(mode==='edit'&&selectedWall)?0.3:1;
  // Blaga pastelna ispuna samo zatvorenih prostora; mreža i zidovi crtaju se iznad.
  g.fillStyle='#edf6ef';
  for(const face of current.faces){
   g.beginPath();for(const r of face.rects)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);g.fill();
  }
  const unit=scale<=w/WIDTH*(1+1e-9)?100:step();
  g.lineWidth=1;
  // Mreža prekriva cijeli prikaz, uključujući rubove izvan smanjene radne plohe.
  for(let i=Math.ceil(-ox/scale/unit);i<=Math.floor((w-ox)/scale/unit);i++){const x=ox+i*unit*scale;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  for(let i=Math.ceil(-oy/scale/unit);i<=Math.floor((h-oy)/scale/unit);i++){const y=oy+i*unit*scale;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  g.save();g.beginPath();g.rect(ox,oy,WIDTH*scale,height*scale);g.clip();
  if(wallsVisible){
   const boxes=[...current.layout.outer,...current.layout.inner];
   // Jedinstvena ispuna i samo vanjski rub unije: nema šavova na spojevima.
   g.beginPath();for(const r of boxes)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);
   g.fillStyle='#bfc3c8';g.fill();g.beginPath();g.strokeStyle='#1e2329';g.lineWidth=1.5;
   for(const e of current.wallOutline.edges){
    if(e.axis==='h'){g.moveTo(ox+e.span[0]*scale,oy+e.line*scale);g.lineTo(ox+e.span[1]*scale,oy+e.line*scale);}
    else{g.moveTo(ox+e.line*scale,oy+e.span[0]*scale);g.lineTo(ox+e.line*scale,oy+e.span[1]*scale);}
   }g.stroke();
  }
  if(!wallsVisible){g.strokeStyle='#1675d1';g.lineWidth=2;g.beginPath();
   for(const s of segments){g.moveTo(ox+s.x1*scale,oy+s.y1*scale);g.lineTo(ox+s.x2*scale,oy+s.y2*scale);}g.stroke();
  }
  // Kote iz stvarnih rubova zidova: unutarnje i vanjske duljine, bez oznaka prostorija.
  for(const e of current.wallOutline.edges){
   const wall=e.axis==='h'?{x1:e.span[0],y1:e.line,x2:e.span[1],y2:e.line}:{x1:e.line,y1:e.span[0],x2:e.line,y2:e.span[1]};
   const center=visibleWallCenter(wall);if(!center)continue;
   const visibleLength=e.axis==='h'?Math.min(w,ox+wall.x2*scale)-Math.max(0,ox+wall.x1*scale):Math.min(h,oy+wall.y2*scale)-Math.max(0,oy+wall.y1*scale);
   if(visibleLength<36)continue;
   tag(center.x+(e.axis==='v'?e.side*12:0),center.y+(e.axis==='h'?e.side*12:0),lengthText(e.span[1]-e.span[0]),'#24557e',e.axis==='v',1,{axis:e.axis,line:e.line,start:e.span[0],end:e.span[1],side:e.side});
  }
  g.globalAlpha=1;
  if(mode==='edit'&&selectedWall){
   const a=screen({x:selectedWall.x1,y:selectedWall.y1}),b=screen({x:selectedWall.x2,y:selectedWall.y2});
   const horizontal=selectedWall.y1===selectedWall.y2;
   const boxes=RoomGeometry.wallSelection(current.rooms,segments,selectedWall,current.layout);
   g.beginPath();for(const r of boxes)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);
   g.fillStyle='#93c5fd';g.fill();g.strokeStyle='#2563eb';g.lineWidth=2;
   if(mode==='edit')for(const p of [a,b]){g.fillStyle='#fff';g.beginPath();g.arc(p.x,p.y,9,0,Math.PI*2);g.fill();g.stroke();}
   const middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   g.fillStyle='#2563eb';g.fillRect(middle.x-7,middle.y-7,14,14);g.strokeStyle='#fff';g.lineWidth=1.3;
   g.beginPath();g.moveTo(middle.x-4,middle.y);g.lineTo(middle.x+4,middle.y);g.moveTo(middle.x,middle.y-4);g.lineTo(middle.x,middle.y+4);g.stroke();
   const center=visibleWallCenter(selectedWall);if(center)tag(center.x+(horizontal?0:20),center.y+(horizontal?-20:0),lengthText(horizontal?selectedWall.x2-selectedWall.x1:selectedWall.y2-selectedWall.y1),'#1d4ed8',!horizontal,5,{axis:horizontal?'h':'v',line:horizontal?selectedWall.y1:selectedWall.x1,start:horizontal?selectedWall.x1:selectedWall.y1,end:horizontal?selectedWall.x2:selectedWall.y2});
  }
  if(first){
   const color='#1675d1';
   const a=screen(first),b=screen(preview||first);g.strokeStyle=color;g.lineWidth=2.5;g.setLineDash([7,5]);g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();g.setLineDash([]);
   for(const p of [a,b]){g.fillStyle='#fff';g.beginPath();g.arc(p.x,p.y,5,0,Math.PI*2);g.fill();g.stroke();}
   const length=Math.abs((preview||first).x-first.x)+Math.abs((preview||first).y-first.y);
   const center=visibleWallCenter({x1:first.x,y1:first.y,x2:(preview||first).x,y2:(preview||first).y});
   if(length&&center)tag(center.x,center.y-20,lengthText(length),color,false,5);
  }
  paintTags();g.restore();g.globalAlpha=1;
 }
 const xy=e=>{const r=board.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 function pinch(){
  const [a,b]=[...pointers.values()];if(!b)return;
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'){segments=gesture.before;selectedWall=gesture.wall;wallSession=gesture.beforeSession;}
  if(gesture?.type==='room-move'){segments=gesture.before;selected=gesture.face.id;}
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,anchor:point(mid.x,mid.y)};
 }
 function adjust(p,drag){
  if(drag.axis!=='h')return second(p.x,p.y,drag.axis);
  const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  if(!drag.dragMode&&Math.hypot(dx,dy)>9)drag.dragMode=Math.abs(dy)>Math.abs(dx)*1.15?'vertical-length':'direct';
  if(drag.dragMode!=='vertical-length')return second(p.x,p.y,drag.axis);
  const direction=Math.sign(drag.base.x-first.x)||1;
  const length=Math.max(0,Math.round((Math.abs(drag.base.x-first.x)-dy/scale)/step())*step());
  return {x:clamp(first.x+direction*length,0,WIDTH),y:first.y};
 }
 board.addEventListener('pointerdown',e=>{
  closeMenu();
  if(e.button!==undefined&&e.button!==0)return;e.preventDefault();board.setPointerCapture(e.pointerId);
  const p=xy(e);pointers.set(e.pointerId,p);resetClear();
  if(pointers.size>1){pinch();return;}
  const endpoint=mode==='edit'?hitHandle(p.x,p.y):null;
  if(endpoint){gesture={type:'wall-resize',id:e.pointerId,start:p,wall:selectedWall,endpoint,before:copy(segments),currentWall:selectedWall,beforeSession:wallSession};status();draw();return;}
  if(mode==='edit'&&dimensionHits.some(r=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom)){gesture={type:'ignored',id:e.pointerId};return;}
  if(mode==='edit'){
   const wall=hitWall(p.x,p.y);selectedWall=wall;
   if(wall){
    const session=wallSession&&['x1','y1','x2','y2'].every(k=>wallSession.current[k]===wall[k])?wallSession:null;
    gesture={type:'wall-move',id:e.pointerId,start:p,wall,before:copy(segments),currentWall:wall,beforeSession:wallSession,
     baseSegments:session?session.baseSegments:copy(segments),baseWall:session?session.baseWall:wall,currentOffset:session?session.offset:0};status();draw();return;
   }
   const raw=point(p.x,p.y),room=model().rooms.find(r=>raw.x>r.x&&raw.x<r.x+r.width&&raw.y>r.y&&raw.y<r.y+r.height);
   if(room){
    const face=model().faces.find(f=>f.id===room.roomKey);selected=face.id;wallSession=null;
    gesture={type:'room-move',id:e.pointerId,start:p,face,faceCount:model().faces.length,before:copy(segments),dx:0,dy:0};status();draw();return;
   }
   status();draw();
  }
  if(mode==='draw'&&first){const q=second(p.x,p.y),raw=point(p.x,p.y);gesture={type:'preview',id:e.pointerId,start:p,base:q,axis:Math.abs(raw.x-first.x)>=Math.abs(raw.y-first.y)?'h':'v',dragMode:null};preview=q;schedule();return;}
  gesture={type:'single',id:e.pointerId,start:p,ox,oy,moved:false};
 });
 board.addEventListener('pointermove',e=>{
  const p=xy(e);
  if(!pointers.has(e.pointerId)){if(mode==='draw'&&first){preview=second(p.x,p.y);schedule();}return;}
  e.preventDefault();pointers.set(e.pointerId,p);
  if(pointers.size>1){
   if(gesture?.type!=='pinch')pinch();const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   scale=clamp(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,w/WIDTH,w/WIDTH*25);ox=mid.x-gesture.anchor.x*scale;oy=mid.y-gesture.anchor.y*scale;limitPan();schedule();return;
  }
  if(!gesture||gesture.id!==e.pointerId)return;
  if(gesture.type==='preview'){preview=adjust(p,gesture);schedule();}
  else if(gesture.type==='wall-move'){updateWall(p,gesture);}
  else if(gesture.type==='wall-resize'){updateWallLength(p,gesture);}
  else if(gesture.type==='room-move'){updateRoom(p,gesture);}
  else if(gesture.type==='single'){
   const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.hypot(dx,dy)>9)gesture.moved=true;
   if(gesture.moved){ox=gesture.ox+dx;oy=gesture.oy+dy;limitPan();schedule();}
  }
 });
 function release(e,cancelled){
  if(!pointers.has(e.pointerId))return;
  const p=xy(e),last=gesture,wasMulti=last?.type==='pinch'||pointers.size>1;pointers.delete(e.pointerId);
  if(pointers.size){gesture={type:'remaining'};return;}gesture=null;
  if(wasMulti||last?.type==='remaining'){status();draw();return;}
  if(last?.type==='room-move'){
   if(cancelled){segments=last.before;selected=last.face.id;status();draw();}
   else {const selection=selected;commit(last.before);selected=selection;status();draw();}
  }else if(last?.type==='wall-resize'){
   if(cancelled){segments=last.before;selectedWall=last.wall;wallSession=last.beforeSession;status();draw();}
   else{const wall=last.currentWall;commit(last.before);selectedWall=wall;wallSession=null;status();draw();}
  }else if(last?.type==='wall-move'){
   if(cancelled){segments=last.before;selectedWall=last.wall;wallSession=last.beforeSession;status();draw();}
   else{const wall=last.currentWall;commit(last.before);selectedWall=wall;
    wallSession={baseSegments:last.baseSegments,baseWall:last.baseWall,offset:last.currentOffset,current:wall};status();draw();}
  }
  else if(last?.type==='preview'&&first){
   if(cancelled){preview=first;status();draw();}
   else{
    const q=snap(p.x,p.y);
    // Ponovljeni dodir zadnje točke završava niz i na dodirnom zaslonu.
    if(mode==='draw'&&!last.dragMode&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9&&q.x===first.x&&q.y===first.y)changeMode('edit');
    else add(adjust(p,last));
   }
  }
  else if(last?.type==='single'&&!last.moved&&!cancelled){
   if(mode==='draw'){first=snap(p.x,p.y);preview=first;status();draw();}
   else{const raw=point(p.x,p.y);selected=model().rooms.find(r=>raw.x>=r.x&&raw.x<=r.x+r.width&&raw.y>=r.y&&raw.y<=r.y+r.height)?.roomKey??null;status();draw();}
  }
 }
 board.addEventListener('pointerup',e=>{e.preventDefault();release(e,false);});
 board.addEventListener('pointercancel',e=>release(e,true));
 board.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e,true);});
 board.addEventListener('contextmenu',e=>e.preventDefault());
 board.addEventListener('wheel',e=>{closeMenu();e.preventDefault();const p=xy(e);zoomAt(e.deltaY<0?1.1:1/1.1,p.x,p.y);},{passive:false});
 function closeMenu(){$('topMenu').open=false;}
 document.addEventListener('pointerdown',e=>{if(!e.target?.closest?.('#topMenu'))closeMenu();});
 function changeMode(next){closeMenu();cancelInteraction();mode=next;selectedWall=null;wallSession=null;resetClear();status();draw();}
 $('drawMode').addEventListener('click',()=>changeMode('draw'));$('editMode').addEventListener('click',()=>changeMode('edit'));
 $('toggleWalls').addEventListener('click',()=>{wallsVisible=!wallsVisible;save();status();draw();});
 $('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);
 $('cancel').addEventListener('click',()=>changeMode('edit'));
 function deselectWall(){selectedWall=null;wallSession=null;status();draw();}
 $('wallDeselect').addEventListener('click',deselectWall);
 function selectedDimension(){if(!selectedWall)return null;const h=selectedWall.y1===selectedWall.y2;return {axis:h?'h':'v',line:h?selectedWall.y1:selectedWall.x1,start:h?selectedWall.x1:selectedWall.y1,end:h?selectedWall.x2:selectedWall.y2};}
 $('wallDelete').addEventListener('click',()=>{if(mode!=='edit'||!selectedWall)return;const before=copy(segments);segments=GridGeometry.eraseLine(segments,selectedWall);selectedWall=null;commit(before);});
 $('clearAll').addEventListener('click',()=>{
  if(!segments.length)return;
  if(!clearArmed){clearArmed=true;$('clearAll').textContent='Potvrdi';$('clearAll').classList.add('armed');status('Ponovno dodirni za brisanje tlocrta');return;}
  const before=copy(segments);segments=[];first=null;preview=null;commit(before);
 });
 function syncDimensionEditor(){
  if(mode!=='edit'||!selectedWall){editorSelectionKey=null;editingDimension=null;$('dimensionError').textContent='';return;}
  const key=JSON.stringify(selectedWall);if(editorSelectionKey===key)return;
  editorSelectionKey=key;editingDimension=selectedDimension();
  $('dimensionValue').value=String(Math.round((editingDimension.end-editingDimension.start)*1000)/1000).replace('.',',');
  $('dimensionThickness').value=String(selectedWall.thickness??RoomGeometry.defaultThickness(model().rooms,selectedWall)).replace('.',',');
  $('dimensionError').textContent='';
 }
 $('dimensionForm').addEventListener('submit',e=>{
  e.preventDefault();if(!editingDimension)return;
  const text=$('dimensionValue').value.trim().replace(',','.');
  const value=/^\d+(?:\.\d+)?$/.test(text)?Number(text):NaN;
  try{
   const textThickness=$('dimensionThickness').value.trim().replace(',','.');
   const thickness=/^\d+(?:\.\d+)?$/.test(textThickness)?Number(textThickness):NaN;
   if(!Number.isFinite(thickness)||thickness<1||thickness>100)throw new Error('Debljina mora biti od 1 do 100 cm.');
   if(!Number.isFinite(value)||value<MIN)throw new Error('Duljina mora biti najmanje 5 cm.');
   const wall=GridGeometry.wallForDimension(segments,editingDimension).wall;
   const oldThickness=wall.thickness??RoomGeometry.defaultThickness(model().rooms,wall);
   let updated=thickness===oldThickness?segments:GridGeometry.setWallThickness(segments,editingDimension,thickness);
   if(Math.abs(value-(editingDimension.end-editingDimension.start))>.0001){
    let dimension=editingDimension;
    if(thickness!==oldThickness&&dimension.side!==undefined){
     const detected=GridGeometry.detectWithDoors(updated),layout=RoomGeometry.layout(detected.rooms,updated);
     const line=dimension.axis==='h'?wall.y1:wall.x1,expected=line+(dimension.line-line)*thickness/oldThickness;
     const edges=RoomGeometry.union([...layout.outer,...layout.inner]).edges.filter(e=>e.axis===dimension.axis&&e.side===dimension.side&&Math.abs(e.line-expected)<.001);
     edges.sort((a,b)=>(Math.min(b.span[1],dimension.end)-Math.max(b.span[0],dimension.start))-(Math.min(a.span[1],dimension.end)-Math.max(a.span[0],dimension.start)));
     if(edges.length)dimension={...dimension,line:edges[0].line,start:edges[0].span[0],end:edges[0].span[1]};
    }
    updated=GridGeometry.resizeDimension(updated,dimension,value,MIN,WIDTH,height);
   }
   GridGeometry.detectWithDoors(updated);
   const h=wall.y1===wall.y2,selection=GridGeometry.wallForDimension(updated,{axis:h?'h':'v',line:h?wall.y1:wall.x1,start:h?wall.x1:wall.y1,end:h?wall.x2:wall.y2}).wall;
   const before=copy(segments);segments=updated;commit(before);selectedWall=selection;status();draw();
   $('dimensionError').textContent='';status('Mjere zida su promijenjene');
  }catch(error){$('dimensionError').textContent=error.message;}
 });
 $('saveJson').addEventListener('click',()=>{
  try{
   const data={format:'infoa-tlocrt',version:1,unit:'cm',segments:copy(segments),wallsVisible};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='CADup-'+new Date().toISOString().slice(0,10)+'.json';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);status('JSON datoteka je spremna za preuzimanje');
  }catch(_){status('Spremanje nije uspjelo. Pokušaj ponovno.');}
 });
 $('importJson').addEventListener('click',()=>$('jsonFile').click());
 $('jsonFile').addEventListener('change',async e=>{
  const input=e.target,file=input.files?.[0];if(!file)return;
  try{
   if(file.size>1000000)throw new Error('Datoteka je prevelika (najviše 1 MB).');
   const data=JSON.parse(await file.text());
   if(!data||!Array.isArray(data.segments)||data.segments.length>2000||
    (data.format!==undefined&&data.format!=='infoa-tlocrt')||
    (data.version!==undefined&&data.version!==1)||(data.unit!==undefined&&data.unit!=='cm')||
    (data.wallsVisible!==undefined&&typeof data.wallsVisible!=='boolean'))throw new Error('Neispravan format tlocrta.');
   const valid=data.segments.every(s=>s&&['x1','y1','x2','y2'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=2000)&&
    (s.x1===s.x2||s.y1===s.y2)&&(s.x1!==s.x2||s.y1!==s.y2)&&
    (s.thickness===undefined||(Number.isFinite(s.thickness)&&s.thickness>=1&&s.thickness<=100)));
   if(!valid)throw new Error('JSON sadrži neispravne zidove.');
   const imported=GridGeometry.normalize(data.segments);
   GridGeometry.detectWithDoors(imported); // Provjeri složenost prije zamjene crteža.
   cancelInteraction();const before=copy(segments);segments=imported;
   wallsVisible=data.wallsVisible!==false;selected=null;selectedWall=null;wallSession=null;
   commit(before);save();resetClear();draw();status('Tlocrt je uvezen · Poništi vraća prethodni crtež');
  }catch(error){status('Uvoz nije uspio: '+(error instanceof SyntaxError?'Datoteka nije valjan JSON.':error.message));}
  finally{input.value='';}
 });
 $('plus').addEventListener('click',()=>zoomAt(1.16));$('minus').addEventListener('click',()=>zoomAt(1/1.16));$('fit').addEventListener('click',fit);
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.();}catch(_){}});
 window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  else if(e.key==='Escape'){if(mode==='draw')changeMode('edit');else{cancelInteraction();deselectWall();}}
 });
 restore();status();new ResizeObserver(resize).observe(board);resize();
})();
