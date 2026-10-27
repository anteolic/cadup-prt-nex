'use strict';
(()=>{
 const $=id=>document.getElementById(id),board=$('board'),g=board.getContext('2d');
 const CUSTOM_KEY='cadup_custom_library_v1',KEY='infoa_grid_loops_v1',WIDTH=2000,MIN=5,HISTORY=80;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 let customLibrary=[],customNaming=false;
 let objects=[],objectIds=new Set(),objectMulti=false,objectEditorKey=null,liveEdit=null,editingGroup=null;
 let segments=[],past=[],future=[],first=null,preview=null,mode='edit',wallsVisible=true,selected=null,selectedWall=null,wallSession=null;
 let w=0,h=0,dpr=1,scale=1,ox=0,oy=0,height=2000,gesture=null,frame=false,clearArmed=false,cursor=null,eraseHover=null,eraseObjectIds=[];
 let cachedKey=null,cached=null,pendingTags=[],dimensionHits=[],editingDimension=null,editorSelectionKey=null;
 const pointers=new Map();
 const copy=a=>a.map(s=>({...s}));
 const snapshot=()=>({segments:copy(segments),objects:copy(objects)});
 function restoreSnapshot(state){eraseHover=null;eraseObjectIds=[];segments=copy(state.segments);objects=copy(state.objects||[]);if(editingGroup&&!objects.some(item=>item.group===editingGroup))editingGroup=null;objectIds.clear();objectMulti=false;objectEditorKey=null;customNaming=false;}
 function recordChange(before){
  if(!liveEdit||!liveEdit.recorded){past.push(liveEdit?liveEdit.before:before);if(past.length>HISTORY)past.shift();}
  if(liveEdit)liveEdit.recorded=true;future=[];
 }
 function setEditorValue(id,value){if(document.activeElement!==$(id))$(id).value=value;}
 function finishMeasureInput(){
  const edit=liveEdit;if(!edit)return;
  if(edit.dirty){edit.dirty=false;edit.apply({preventDefault(){}});}
  if(liveEdit===edit)liveEdit=null;
 }
 function bindLiveEditor(id,apply){
  const form=$(id);
  form.addEventListener('submit',e=>{e.preventDefault();if(liveEdit?.apply===apply)finishMeasureInput();else apply(e);});
  form.addEventListener('input',()=>{if(liveEdit?.apply===apply)liveEdit.dirty=true;});
  form.addEventListener('focusin',e=>{
   if(e.target?.tagName!=='INPUT')return;finishMeasureInput();
   liveEdit={before:snapshot(),recorded:false,dirty:false,apply,input:e.target};
  });
  form.addEventListener('focusout',finishMeasureInput);
  form.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur?.();}});
 }
 function commitObjects(before,ids=[]){
  if(editingGroup&&!objects.some(item=>item.group===editingGroup))editingGroup=null;
  eraseHover=null;eraseObjectIds=[];
  if(JSON.stringify(before)!==JSON.stringify(snapshot())){recordChange(before);save();}
  selectedWall=null;wallSession=null;objectIds=new Set(ids);objectEditorKey=null;status();draw();
 }
 function save(){
  const scene={segments,objects,wallsVisible};
  try{localStorage.setItem(KEY,JSON.stringify({...scene,historyVersion:1,past:past.slice(-HISTORY),future:future.slice(-HISTORY)}));}
  catch(_){try{localStorage.setItem(KEY,JSON.stringify(scene));}catch(_){}}
 }
 function readHistory(history){
  if(!Array.isArray(history))return [];
  try{return history.slice(-HISTORY).map(state=>{
   if(!state||!Array.isArray(state.segments)||state.segments.length>2000||!state.segments.every(s=>s&&['x1','y1','x2','y2'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=2000)&&
    (s.x1===s.x2||s.y1===s.y2)&&(s.thickness===undefined||(Number.isFinite(s.thickness)&&s.thickness>=1&&s.thickness<=100))))throw new Error('Neispravna povijest');
   return {segments:GridGeometry.normalize(state.segments),objects:CadObjects.validate(state.objects??[])};
  });}catch(_){return [];}
 }
 function restore(){
  try{
   const saved=localStorage.getItem(KEY);
   if(saved){const data=JSON.parse(saved);segments=GridGeometry.normalize(Array.isArray(data.segments)?data.segments:[]);objects=CadObjects.validate(data.objects??[]);wallsVisible=true;if(data.historyVersion===1){past=readHistory(data.past);future=readHistory(data.future);}}
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
  if(cachedKey!==key){const detected=GridGeometry.detectWithDoors(segments),layout=RoomGeometry.layout(detected.rooms,segments);const wallOutlines=layout.wallGroups.map(boxes=>RoomGeometry.union(boxes));cached={...detected,layout,junctions:GridGeometry.junctions(segments),wallOutline:{area:RoomGeometry.union([...layout.outer,...layout.inner]).area,edges:wallOutlines.flatMap(outline=>outline.edges)}};cachedKey=key;}
  return cached;
 }
 const point=(x,y)=>({x:(x-ox)/scale,y:(y-oy)/scale});
 const screen=p=>({x:ox+p.x*scale,y:oy+p.y*scale});
 function gridUnit(){return scale<=w/WIDTH*(1+1e-9)?100:step();}
 function step(){for(const s of [5,10,20,50,100,200,500,1000,2000])if(s*scale>=19)return s;return 2000;}
 function guideAxes(){
  const xs=new Set(),ys=new Set();
  for(const s of segments){xs.add(s.x1);xs.add(s.x2);ys.add(s.y1);ys.add(s.y2);}
  if(first){xs.add(first.x);ys.add(first.y);}
  return {x:[...xs].sort((a,b)=>a-b),y:[...ys].sort((a,b)=>a-b)};
 }
 function snapAlignment(raw,q){
  if(mode!=='draw')return q;const axes=guideAxes();
  for(const axis of ['x','y']){let distance=8;for(const value of axes[axis]){const d=Math.abs(raw[axis]-value)*scale;if(d<distance){distance=d;q[axis]=value;}}}
  return q;
 }
 function drawGuides(){
  if(mode!=='draw')return;const axes=guideAxes(),target=first?(preview||first):cursor?snap(cursor.x,cursor.y):null;
  g.save();g.setLineDash([4,5]);
  for(const axis of ['x','y']){let previous=-Infinity;for(const value of axes[axis]){
   const pixel=(axis==='x'?ox:oy)+value*scale,limit=axis==='x'?w:h,active=target&&Math.abs(target[axis]-value)<.001;
   if(pixel<0||pixel>limit||(!active&&pixel-previous<5))continue;previous=pixel;
   g.globalAlpha=active?0.85:0.4;g.strokeStyle=active?'#2563eb':'#93b4d5';g.lineWidth=active?1.25:.75;g.beginPath();
   if(axis==='x'){g.moveTo(pixel,0);g.lineTo(pixel,h);}else{g.moveTo(0,pixel);g.lineTo(w,pixel);}g.stroke();
  }}g.restore();
 }
 function drawWallAxes(){
  g.strokeStyle='#dc2626';g.lineWidth=1.5;g.setLineDash([7,5]);g.beginPath();
  for(const s of segments){g.moveTo(ox+s.x1*scale,oy+s.y1*scale);g.lineTo(ox+s.x2*scale,oy+s.y2*scale);}g.stroke();g.setLineDash([]);
 }
 function drawJoinedNodes(){
  if(mode!=='draw'&&mode!=='erase'&&!selectedWall)return;
  g.save();g.globalAlpha=1;
  for(const node of model().junctions){const p=screen(node);g.beginPath();g.arc(p.x,p.y,clamp(3.2*handleScale(),3.2,5),0,Math.PI*2);g.fillStyle='#dc2626';g.fill();g.strokeStyle='#fff';g.lineWidth=.8;g.stroke();}
  g.restore();
 }
 function snap(x,y){
  const raw=point(x,y),unit=step();
  let q=snapAlignment(raw,{x:clamp(Math.round(raw.x/unit)*unit,0,WIDTH),y:clamp(Math.round(raw.y/unit)*unit,0,height)}),distance=14;
  for(const s of segments)for(const p of [{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}]){
   const d=Math.hypot(raw.x-p.x,raw.y-p.y)*scale;if(d<distance){distance=d;q={...p};}
  }
  // Spoj na postojeći potez zadržava točnu koordinatu i kad se razina mreže promijeni.
  for(const s of segments){
   if(s.y1===s.y2&&q.x>=s.x1&&q.x<=s.x2&&Math.abs(raw.y-s.y1)*scale<9)q.y=s.y1;
   if(s.x1===s.x2&&q.y>=s.y1&&q.y<=s.y2&&Math.abs(raw.x-s.x1)*scale<9)q.x=s.x1;
  }
  let nodeDistance=14;for(const node of model().junctions){const d=Math.hypot(raw.x-node.x,raw.y-node.y)*scale;if(d<nodeDistance){nodeDistance=d;q={x:node.x,y:node.y};}}
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
  $('eraseMode').classList.toggle('active',mode==='erase');$('eraseMode').setAttribute('aria-pressed',String(mode==='erase'));
  $('drawMode').classList.toggle('active',mode==='draw');$('drawMode').setAttribute('aria-pressed',String(mode==='draw'));
  $('drawMode').setAttribute('title',mode==='draw'?'Završi crtanje i uredi':'Crtaj');
  $('drawMode').setAttribute('aria-label',mode==='draw'?'Završi crtanje i uredi':'Crtaj');
  const editingWall=mode==='edit'&&!!selectedWall;
  $('wallActions').hidden=!editingWall;
  const editingObjects=mode==='edit'&&(objectIds.size>0||objectMulti||editingGroup);
  $('editorFooter').hidden=!editingWall&&!editingObjects;
  $('objectActions').hidden=!editingObjects;syncObjectEditor();
  $('mainTools').hidden=false;
  syncDimensionEditor();$('undo').disabled=!past.length&&!first;$('redo').disabled=!future.length;
 }
 function commit(before,keepWall=false){
  eraseHover=null;eraseObjectIds=[];
  if(JSON.stringify(before)===JSON.stringify(segments)){status();draw();return;}
  recordChange(Array.isArray(before)?{segments:before,objects:copy(objects)}:before);selected=null;if(!keepWall)selectedWall=null;wallSession=null;save();resetClear();status();draw();
 }
 function add(end){
  if(!first)return;
  if(first.x===end.x&&first.y===end.y){status('Odaberi drugu točku linije');return;}
  const before=copy(segments),stroke={x1:first.x,y1:first.y,x2:end.x,y2:end.y};
  segments=GridGeometry.normalize([...segments,stroke]);
  first=mode==='draw'?{...end}:null;preview=first;commit(before);
 }
 function undo(){
  liveEdit=null;
  if(gesture?.type==='object-move'||gesture?.type==='wall-move'||gesture?.type==='wall-resize'){cancelInteraction();return;}
  first=null;preview=null;
  if(!past.length){status();draw();return;}future.push(snapshot());restoreSnapshot(past.pop());selected=null;selectedWall=null;wallSession=null;save();resetClear();status();draw();
 }
 function redo(){liveEdit=null;if(!future.length)return;first=null;preview=null;gesture=null;pointers.clear();past.push(snapshot());restoreSnapshot(future.pop());selected=null;selectedWall=null;wallSession=null;save();status();draw();}
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
 function hitEraseSpan(x,y){
  const raw=point(x,y);let best=null,distance=12;
  for(const wall of GridGeometry.atomic(segments)){
   const h=wall.y1===wall.y2,along=h?raw.x:raw.y,start=h?wall.x1:wall.y1,end=h?wall.x2:wall.y2;
   const d=Math.hypot((h?raw.y:raw.x)-(h?wall.y1:wall.x1),along-clamp(along,start,end))*scale;
   if(d<distance){distance=d;best=wall;}
  }return best;
 }
 function eraseTarget(p){
  const raw=point(p.x,p.y),item=CadObjects.hit(objects,raw.x,raw.y);
  if(item)return {kind:'object',ids:CadObjects.expandedSelection(objects,[item.id])};
  const wall=hitEraseSpan(p.x,p.y);return wall?{kind:'wall',wall}:null;
 }
 function updateEraseHover(p){const target=eraseTarget(p);eraseHover=target?.kind==='wall'?target.wall:null;eraseObjectIds=target?.kind==='object'?target.ids:[];return target;}
 function deleteEraseTarget(target){
  if(!target){changeMode('edit');return;}
  if(target.kind==='wall')eraseSpan(target.wall);
  else{const before=snapshot(),ids=new Set(target.ids);objects=objects.filter(item=>!ids.has(item.id));commitObjects(before);}
 }
 function eraseSpan(wall){if(!wall)return;const before=copy(segments);segments=GridGeometry.eraseLine(segments,wall);eraseHover=null;selectedWall=null;commit(before);}
 function handleScale(){return clamp(Math.sqrt(scale/(w/WIDTH)),1,2.5);}
 function hitHandle(x,y){
  if(!selectedWall)return null;
  let endpoint=null,distance=Math.max(20,11*handleScale()+8);
  for(const n of [1,2]){const p=screen({x:selectedWall['x'+n],y:selectedWall['y'+n]}),d=Math.hypot(x-p.x,y-p.y);if(d<distance){endpoint=n;distance=d;}}
  return endpoint;
 }
 function snapWallCoordinate(raw,axis,input,wall){
  let target=Math.round(raw/step())*step(),distance=8;
  for(const s of input){
   if(['x1','y1','x2','y2'].every(k=>s[k]===wall[k]))continue;
   for(const n of [1,2]){const value=s[axis+n],d=Math.abs(raw-value)*scale;if(d<distance){distance=d;target=value;}}
  }
  const h=wall.y1===wall.y2,along=h?'x':'y',other=axis==='x'?'y':'x';let nodeDistance=14;
  for(const node of GridGeometry.junctions(input)){
   const aligned=axis===along?node[other]===(h?wall.y1:wall.x1):node[other]>=wall[other+'1']&&node[other]<=wall[other+'2'];
   const d=Math.abs(raw-node[axis])*scale;if(aligned&&d<nodeDistance){nodeDistance=d;target=node[axis];}
  }
  return target;
 }
 function updateWallLength(p,drag){
  const h=drag.wall.y1===drag.wall.y2,axis=h?'x':'y';
  const delta=(h?p.x-drag.start.x:p.y-drag.start.y)/scale;
  const target=snapWallCoordinate(drag.wall[axis+drag.endpoint]+delta,axis,drag.before,drag.wall);
  const resized=GridGeometry.resizeWall(drag.before,drag.wall,drag.endpoint,target,MIN,WIDTH,height);
  segments=resized.segments;selectedWall=resized.wall;drag.currentWall=resized.wall;schedule();
 }
 function updateWall(p,drag){
  const horizontal=drag.wall.y1===drag.wall.y2;
  const raw=(horizontal?p.y-drag.start.y:p.x-drag.start.x)/scale;
  const old=horizontal?drag.wall.y1:drag.wall.x1;
  const target=snapWallCoordinate(old+raw,horizontal?'y':'x',drag.before,drag.wall);
  const base=horizontal?drag.baseWall.y1:drag.baseWall.x1;
  const moved=GridGeometry.moveWall(drag.baseSegments,drag.baseWall,target-base,MIN,WIDTH,height);
  segments=moved.segments;selectedWall=moved.wall;drag.currentWall=moved.wall;drag.currentOffset=moved.delta;schedule();
 }
 function cancelInteraction(){
  if(gesture?.type==='object-move')restoreSnapshot(gesture.before);
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'){segments=gesture.before;selectedWall=gesture.wall;wallSession=gesture.beforeSession;}
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
  g.save();g.globalAlpha=(mode==='edit'&&(selectedWall||objectIds.size)&&priority<5)?0.9:1;g.font='600 '+size+'px system-ui';
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
  g.globalAlpha=(mode==='edit'&&(selectedWall||objectIds.size))?0.7:1;
  // Blaga pastelna ispuna samo zatvorenih prostora; mreža i zidovi crtaju se iznad.
  g.fillStyle='#edf6ef';
  for(const face of current.faces){
   g.beginPath();for(const r of face.rects)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);g.fill();
  }
  const unit=gridUnit();
  g.lineWidth=1;
  // Mreža prekriva cijeli prikaz, uključujući rubove izvan smanjene radne plohe.
  for(let i=Math.ceil(-ox/scale/unit);i<=Math.floor((w-ox)/scale/unit);i++){const x=ox+i*unit*scale;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  for(let i=Math.ceil(-oy/scale/unit);i<=Math.floor((h-oy)/scale/unit);i++){const y=oy+i*unit*scale;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  g.save();g.beginPath();g.rect(ox,oy,WIDTH*scale,height*scale);g.clip();
  drawGuides();
  if(wallsVisible){
   const boxes=[...current.layout.outer,...current.layout.inner];
   // Jedinstvena ispuna i samo vanjski rub unije: nema šavova na spojevima.
   g.beginPath();for(const r of boxes)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);
   g.fillStyle='#bfc3c8';g.fill();g.beginPath();g.strokeStyle='#1e2329';g.lineWidth=1.5;
   for(const e of current.wallOutline.edges){
    if(e.axis==='h'){g.moveTo(ox+e.span[0]*scale,oy+e.line*scale);g.lineTo(ox+e.span[1]*scale,oy+e.line*scale);}
    else{g.moveTo(ox+e.line*scale,oy+e.span[0]*scale);g.lineTo(ox+e.line*scale,oy+e.span[1]*scale);}
   }if(current.layout.disconnectedOverlap){g.strokeStyle='#fff';g.lineWidth=4;g.stroke();g.strokeStyle='#1e2329';g.lineWidth=1.5;}g.stroke();
   if(current.layout.unjoinedCaps.length){g.beginPath();for(const cap of current.layout.unjoinedCaps){g.moveTo(ox+cap.x1*scale,oy+cap.y1*scale);g.lineTo(ox+cap.x2*scale,oy+cap.y2*scale);}g.strokeStyle='#fff';g.lineWidth=4;g.stroke();g.strokeStyle='#1e2329';g.lineWidth=1.5;g.stroke();}
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
  if(mode==='draw'||mode==='erase')drawWallAxes();
  if(mode==='erase'){
   const nodes=new Map();for(const wall of GridGeometry.atomic(segments))for(const n of [1,2])nodes.set(wall['x'+n]+':'+wall['y'+n],{x:wall['x'+n],y:wall['y'+n]});
   for(const node of nodes.values()){const p=screen(node);g.beginPath();g.arc(p.x,p.y,3,0,Math.PI*2);g.fillStyle='#fff';g.fill();g.strokeStyle='#dc2626';g.lineWidth=1;g.stroke();}
   const wall=eraseHover;
   if(wall){g.strokeStyle='#dc2626';g.lineWidth=4;g.beginPath();g.moveTo(ox+wall.x1*scale,oy+wall.y1*scale);g.lineTo(ox+wall.x2*scale,oy+wall.y2*scale);g.stroke();}
  }
  if(mode==='edit'&&selectedWall){
   const a=screen({x:selectedWall.x1,y:selectedWall.y1}),b=screen({x:selectedWall.x2,y:selectedWall.y2});
   const horizontal=selectedWall.y1===selectedWall.y2;
   const dimension=selectedDimension();
   const visibleWall=horizontal?{...selectedWall,x1:dimension.start,x2:dimension.end}:{...selectedWall,y1:dimension.start,y2:dimension.end};
   const boxes=RoomGeometry.wallSelection(current.rooms,segments,visibleWall,current.layout).map(r=>horizontal?{...r,x:Math.max(r.x,dimension.start),width:Math.min(r.x+r.width,dimension.end)-Math.max(r.x,dimension.start)}:{...r,y:Math.max(r.y,dimension.start),height:Math.min(r.y+r.height,dimension.end)-Math.max(r.y,dimension.start)}).filter(r=>r.width>0&&r.height>0);
   g.beginPath();for(const r of boxes)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);
   g.fillStyle='#93c5fd';g.fill();g.strokeStyle='#2563eb';g.lineWidth=2;
   drawWallAxes();
   g.strokeStyle='#dc2626';const gripScale=handleScale();
   if(mode==='edit')for(const [index,p] of [a,b].entries()){
    if(gesture?.type==='wall-resize'&&gesture.endpoint===index+1)continue;
    g.fillStyle='rgba(255,255,255,0.35)';g.beginPath();g.arc(p.x,p.y,11*gripScale,0,Math.PI*2);g.fill();g.stroke();
   }

  }
  if(first){
   const color='#1675d1';
   const a=screen(first),b=screen(preview||first);g.strokeStyle=color;g.lineWidth=2.5;g.setLineDash([7,5]);g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();g.setLineDash([]);
   for(const p of [a,b]){g.fillStyle='#fff';g.beginPath();g.arc(p.x,p.y,5,0,Math.PI*2);g.fill();g.stroke();}
   const length=Math.abs((preview||first).x-first.x)+Math.abs((preview||first).y-first.y);
   const center=visibleWallCenter({x1:first.x,y1:first.y,x2:(preview||first).x,y2:(preview||first).y});
   if(length&&center)tag(center.x,center.y-20,lengthText(length),color,false,5);
  }
  for(const item of objects){
   const active=objectIds.has(item.id);g.globalAlpha=((selectedWall||objectIds.size||editingGroup)&&!active&&(!editingGroup||item.group!==editingGroup))?0.7:1;
   const attached=CadObjects.attach(item,segments),same=Math.abs(attached.x-item.x)<.01&&Math.abs(attached.y-item.y)<.01&&attached.rotation%180===item.rotation%180;
   const wall=same&&['door','double-door','window'].includes(item.kind)?hitWallForObject(item):null;
   if(wall){
    const horizontal=wall.y1===wall.y2,start=(horizontal?item.x:item.y)-item.width/2,end=start+item.width;
    const objectAlpha=g.globalAlpha;g.globalAlpha=1;g.fillStyle='#fff';const caps=[];
    for(const box of RoomGeometry.wallSelection(current.rooms,segments,wall,current.layout)){
     const a=Math.max(start,horizontal?box.x:box.y),b=Math.min(end,horizontal?box.x+box.width:box.y+box.height);if(b<=a)continue;
     if(horizontal)g.fillRect(ox+a*scale,oy+box.y*scale-1,(b-a)*scale,box.height*scale+2);
     else g.fillRect(ox+box.x*scale-1,oy+a*scale,box.width*scale+2,(b-a)*scale);
     if(horizontal){
      if(Math.abs(a-start)<.001)caps.push({x1:a,y1:box.y,x2:a,y2:box.y+box.height});
      if(Math.abs(b-end)<.001)caps.push({x1:b,y1:box.y,x2:b,y2:box.y+box.height});
     }else{
      if(Math.abs(a-start)<.001)caps.push({x1:box.x,y1:a,x2:box.x+box.width,y2:a});
      if(Math.abs(b-end)<.001)caps.push({x1:box.x,y1:b,x2:box.x+box.width,y2:b});
     }
    }
    g.globalAlpha=objectAlpha;g.strokeStyle='#1e2329';g.lineWidth=1.5;g.beginPath();
    for(const cap of caps){g.moveTo(ox+cap.x1*scale,oy+cap.y1*scale);g.lineTo(ox+cap.x2*scale,oy+cap.y2*scale);}g.stroke();
   }
   const eraseIds=eraseObjectIds;
   CadObjects.draw(g,item,scale,ox,oy,active,0,mode==='erase'&&eraseIds.includes(item.id));
  }
  g.globalAlpha=1;
  if(objectIds.size>1){const box=CadObjects.selectionBounds(objects.filter(item=>objectIds.has(item.id)));if(box){g.strokeStyle='#2563eb';g.lineWidth=1.5;g.setLineDash([5,4]);g.strokeRect(ox+box.left*scale,oy+box.top*scale,box.width*scale,box.depth*scale);g.setLineDash([]);}}
  drawJoinedNodes();paintTags();g.restore();g.globalAlpha=1;
 }
 const xy=e=>{const r=board.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 function pinch(){
  const [a,b]=[...pointers.values()];if(!b)return;
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'){segments=gesture.before;selectedWall=gesture.wall;wallSession=gesture.beforeSession;}
  if(gesture?.type==='object-move'){const ids=gesture.ids;restoreSnapshot(gesture.before);objectIds=new Set(ids);}
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,anchor:point(mid.x,mid.y)};
 }
 function adjust(p,drag){
  if(drag.axis!=='h')return second(p.x,p.y,drag.axis);
  const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
  if(!drag.dragMode&&Math.hypot(dx,dy)>9)drag.dragMode=Math.abs(dy)>Math.abs(dx)*1.15?'vertical-length':'direct';
  if(drag.dragMode!=='vertical-length')return second(p.x,p.y,drag.axis);
  const direction=Math.sign(drag.base.x-first.x)||1;
  const length=Math.max(0,Math.round((Math.abs(drag.base.x-first.x)-dy/scale)/step())*step());
  const end={x:clamp(first.x+direction*length,0,WIDTH),y:first.y};return snapAlignment(end,{...end});
 }
 board.addEventListener('pointerdown',e=>{
  closeMenu();
  if(e.button!==undefined&&e.button!==0)return;e.preventDefault();board.setPointerCapture(e.pointerId);
  const p=xy(e);cursor=p;pointers.set(e.pointerId,p);resetClear();
  if(pointers.size>1){pinch();return;}
  if(mode==='erase'){const target=updateEraseHover(p);gesture={type:'erase-span',id:e.pointerId,start:p,target,ox,oy,moved:false};draw();return;}
  if(mode==='edit'){
   const raw=point(p.x,p.y),item=CadObjects.hit(editingGroup?objects.filter(item=>item.group===editingGroup):objects,raw.x,raw.y);
   if(item){
    const ids=editingGroup?[item.id]:CadObjects.expandedSelection(objects,[item.id]);
    if(objectMulti||e.shiftKey){const remove=ids.every(id=>objectIds.has(id));for(const id of ids)if(remove)objectIds.delete(id);else objectIds.add(id);gesture={type:'object-select',id:e.pointerId};}
    else{if(!objectIds.has(item.id))objectIds=new Set(ids);gesture={type:'object-move',id:e.pointerId,start:p,before:snapshot(),ids:[...objectIds]};}
    selectedWall=null;wallSession=null;objectEditorKey=null;status();draw();return;
   }
   if(objectIds.size||objectMulti){objectIds.clear();objectMulti=false;objectEditorKey=null;status();draw();}
  }
  if(mode==='edit'&&editingGroup){gesture={type:'pan',id:e.pointerId,start:p,ox,oy,moved:false};status();draw();return;}
  const endpoint=mode==='edit'?hitHandle(p.x,p.y):null;
  if(endpoint){gesture={type:'wall-resize',id:e.pointerId,start:p,wall:selectedWall,endpoint,before:copy(segments),currentWall:selectedWall,beforeSession:wallSession};status();draw();return;}
  if(mode==='edit'&&dimensionHits.some(r=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom)){gesture={type:'pan',id:e.pointerId,start:p,ox,oy,moved:false};return;}
  if(mode==='edit'){
   const wall=hitWall(p.x,p.y);selectedWall=wall;
   if(wall){
    const session=wallSession&&['x1','y1','x2','y2'].every(k=>wallSession.current[k]===wall[k])?wallSession:null;
    gesture={type:'wall-move',id:e.pointerId,start:p,wall,before:copy(segments),currentWall:wall,beforeSession:wallSession,
     baseSegments:session?session.baseSegments:copy(segments),baseWall:session?session.baseWall:wall,currentOffset:session?session.offset:0};status();draw();return;
   }
   selected=null;gesture={type:'pan',id:e.pointerId,start:p,ox,oy,moved:false};status();draw();return;
  }
  if(mode==='draw'&&first){const q=second(p.x,p.y),raw=point(p.x,p.y);gesture={type:'preview',id:e.pointerId,start:p,base:q,axis:Math.abs(raw.x-first.x)>=Math.abs(raw.y-first.y)?'h':'v',dragMode:null};preview=q;schedule();return;}
  gesture={type:'single',id:e.pointerId,start:p,ox,oy,moved:false};
 });
 board.addEventListener('pointermove',e=>{
  const p=xy(e);cursor=p;
  if(!pointers.has(e.pointerId)){if(mode==='draw'){if(first)preview=second(p.x,p.y);schedule();}else if(mode==='erase'){updateEraseHover(p);schedule();}return;}
  e.preventDefault();pointers.set(e.pointerId,p);
  if(pointers.size>1){
   if(gesture?.type!=='pinch')pinch();const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   scale=clamp(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,w/WIDTH,w/WIDTH*25);ox=mid.x-gesture.anchor.x*scale;oy=mid.y-gesture.anchor.y*scale;limitPan();schedule();return;
  }
  if(!gesture||gesture.id!==e.pointerId)return;
  if(gesture.type==='erase-span'){if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>9){gesture.moved=true;if(!gesture.target){ox=gesture.ox+p.x-gesture.start.x;oy=gesture.oy+p.y-gesture.start.y;schedule();}}}
  else if(gesture.type==='object-move'){
   if(!gesture.moved&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<3)return;
   gesture.moved=true;
   let moved=CadObjects.moveOnGrid(gesture.before.objects,gesture.ids,(p.x-gesture.start.x)/scale,(p.y-gesture.start.y)/scale,gridUnit());
   moved=CadObjects.snapToWalls(moved,gesture.ids,segments,model().rooms,Math.min(30,14/scale));
   objects=moved;schedule();
  }
  else if(gesture.type==='preview'){preview=adjust(p,gesture);schedule();}
  else if(gesture.type==='wall-move'){updateWall(p,gesture);}
  else if(gesture.type==='wall-resize'){updateWallLength(p,gesture);}
  else if(gesture.type==='single'||gesture.type==='pan'){
   const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.hypot(dx,dy)>9)gesture.moved=true;
   if(gesture.moved){ox=gesture.ox+dx;oy=gesture.oy+dy;schedule();}
  }
 });
 function release(e,cancelled){
  if(!pointers.has(e.pointerId))return;
  const p=xy(e),last=gesture,wasMulti=last?.type==='pinch'||pointers.size>1;pointers.delete(e.pointerId);
  if(pointers.size){gesture={type:'remaining'};return;}gesture=null;
  if(wasMulti||last?.type==='remaining'){status();draw();return;}
  if(last?.type==='erase-span'){if(!cancelled&&!last.moved&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9)deleteEraseTarget(last.target);else{eraseHover=null;eraseObjectIds=[];draw();}return;}
  if(last?.type==='pan'){status();draw();return;}
  if(last?.type==='object-select')return;
  if(last?.type==='object-move'){
   if(cancelled){restoreSnapshot(last.before);objectIds=new Set(last.ids);status();draw();}
   else commitObjects(last.before,last.ids);
   return;
  }
  if(last?.type==='wall-resize'){
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
 function closeMenu(){$('topMenu').open=false;$('objectMenu').open=false;}
 document.addEventListener('pointerdown',e=>{
  if(liveEdit&&e.target!==liveEdit.input){const input=liveEdit.input;finishMeasureInput();input.blur?.();}
  if(!e.target?.closest?.('#topMenu'))$('topMenu').open=false;if(!e.target?.closest?.('#objectMenu'))$('objectMenu').open=false;
 },true);
 function changeMode(next){liveEdit=null;closeMenu();cancelInteraction();mode=next;editingGroup=null;eraseHover=null;eraseObjectIds=[];cursor=null;selectedWall=null;wallSession=null;objectIds.clear();objectMulti=false;objectEditorKey=null;customNaming=false;resetClear();status();draw();}
 $('drawMode').addEventListener('click',()=>changeMode(mode==='draw'?'edit':'draw'));
 $('eraseMode').addEventListener('click',()=>changeMode(mode==='erase'?'edit':'erase'));
 $('reloadApp').addEventListener('click',async()=>{
  const button=$('reloadApp');if(button.disabled)return;
  button.disabled=true;button.textContent='Učitavam…';closeMenu();save();status('Učitavam novu verziju…');
  try{
   // Dohvati kanonsku stranicu i osvježi HTTP cache prije navigacije.
   const target=new URL('CADup.html',window.location.href);target.searchParams.set('v',String(Date.now()));
   const response=await fetch(target.href,{cache:'reload'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const html=await response.text();
   const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match=>new URL(match[1],target.href));
   const required=['room-geometry.js','grid-geometry.js','cad-objects.js','grid-app.js'];
   if(!required.every(name=>scripts.some(url=>url.origin===target.origin&&url.pathname.endsWith('/'+name))))throw new Error('Nepotpuna stranica');
   for(const url of scripts){
    if(url.origin!==target.origin)continue;
    const script=await fetch(url.href,{cache:'reload'});
    if(!script.ok)throw new Error('Skripta: HTTP '+script.status);
    const source=await script.text();if(!source.trim())throw new Error('Prazna skripta');
   }
   save();window.location.replace(target.href);
  }catch(_){status('Nova verzija nije učitana. Provjeri vezu i pokušaj ponovno. Tlocrt je sačuvan.');}
  finally{button.disabled=false;button.textContent='↻ Učitaj novu verziju';}
 });
 $('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);
 function deselectWall(){editingGroup=null;customNaming=false;objectIds.clear();objectMulti=false;objectEditorKey=null;selectedWall=null;wallSession=null;status();draw();}
 function selectedDimension(){if(!selectedWall)return null;const current=model();return RoomGeometry.visibleWallDimension(current.rooms,segments,selectedWall,current.layout);}
 $('wallDelete').addEventListener('click',()=>eraseSpan(selectedWall));
 $('clearAll').addEventListener('click',()=>{
  if(!segments.length&&!objects.length)return;
  if(!clearArmed){clearArmed=true;$('clearAll').textContent='Potvrdi';$('clearAll').classList.add('armed');status('Ponovno dodirni za brisanje tlocrta');return;}
  const before=snapshot();segments=[];objects=[];editingGroup=null;objectIds.clear();first=null;preview=null;commit(before);
 });
 function syncDimensionEditor(){
  if(mode!=='edit'||!selectedWall){editorSelectionKey=null;editingDimension=null;$('dimensionError').textContent='';return;}
  const key=JSON.stringify(selectedWall);if(editorSelectionKey===key)return;
  editorSelectionKey=key;editingDimension=selectedDimension();
  setEditorValue('dimensionValue',String(Math.round((editingDimension.end-editingDimension.start)*1000)/1000).replace('.',','));
  setEditorValue('dimensionThickness',String(selectedWall.thickness??RoomGeometry.defaultThickness(model().rooms,selectedWall)).replace('.',','));
  $('dimensionError').textContent='';
 }
 function applyWallInputs(e){
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
    if(thickness!==oldThickness){
     const detected=GridGeometry.detectWithDoors(updated),layout=RoomGeometry.layout(detected.rooms,updated);
     dimension=RoomGeometry.visibleWallDimension(detected.rooms,updated,{...wall,thickness},layout);
    }
    updated=GridGeometry.resizeDimension(updated,dimension,value,MIN,WIDTH,height);
   }
   GridGeometry.detectWithDoors(updated);
   const h=wall.y1===wall.y2,selection=GridGeometry.wallForDimension(updated,{axis:h?'h':'v',line:h?wall.y1:wall.x1,start:h?wall.x1:wall.y1,end:h?wall.x2:wall.y2}).wall;
   const before=copy(segments);segments=updated;selectedWall=selection;commit(before,true);status();draw();
   $('dimensionError').textContent='';status();
  }catch(error){$('dimensionError').textContent=error.message;}
 }
 bindLiveEditor('dimensionForm',applyWallInputs);
 $('saveJson').addEventListener('click',()=>{
  try{
   const data={format:'infoa-tlocrt',version:1,unit:'cm',segments:copy(segments),objects:copy(objects),customLibrary,wallsVisible};
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
   const importedObjects=CadObjects.validate(data.objects??[]),importedLibrary=CadObjects.validateTemplates(data.customLibrary??[]);
   const mergedLibrary=CadObjects.validateTemplates([...customLibrary,...importedLibrary.filter(template=>!customLibrary.some(saved=>saved.id===template.id))]);
   const imported=GridGeometry.normalize(data.segments);
   GridGeometry.detectWithDoors(imported); // Provjeri složenost prije zamjene crteža.
   if(importedLibrary.length){persistCustomLibrary(mergedLibrary);customLibrary=mergedLibrary;renderObjectLibrary();}
   cancelInteraction();const before=snapshot();segments=imported;objects=importedObjects;editingGroup=null;objectIds.clear();
   wallsVisible=true;selected=null;selectedWall=null;wallSession=null;
   commit(before);save();resetClear();draw();status('Tlocrt je uvezen · Poništi vraća prethodni crtež');
  }catch(error){status('Uvoz nije uspio: '+(error instanceof SyntaxError?'Datoteka nije valjan JSON.':error.message));}
  finally{input.value='';}
 });
 $('plus').addEventListener('click',()=>zoomAt(1.16));$('minus').addEventListener('click',()=>zoomAt(1/1.16));$('fit').addEventListener('click',fit);
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.();}catch(_){}});
 window.addEventListener('keydown',e=>{
  if(e.key!=='Escape'&&(e.target?.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName)))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
  else if(e.key==='Escape'){if(mode==='draw'||mode==='erase')changeMode('edit');else if(editingGroup)closeGroupEditor();else{cancelInteraction();deselectWall();}}
 });
 function hitWallForObject(item){
  const horizontal=item.rotation%180===0;return segments.find(wall=>(wall.y1===wall.y2)===horizontal&&Math.abs((horizontal?wall.y1:wall.x1)-(horizontal?item.y:item.x))<.01&&
   (horizontal?wall.x1:wall.y1)<=(horizontal?item.x:item.y)&&(horizontal?wall.x2:wall.y2)>=(horizontal?item.x:item.y))||null;
 }
 function addObject(kind){
  try{changeMode('edit');const before=snapshot(),center=point(w/2,h/2),item=CadObjects.attach(CadObjects.create(kind,center.x,center.y),segments);objects.push(item);commitObjects(before,[item.id]);}
  catch(error){status(error.message);}
 }
 function syncObjectEditor(){
  const items=objects.filter(item=>objectIds.has(item.id)),count=items.length;
  $('objectMulti').setAttribute('aria-pressed',String(objectMulti));$('objectMulti').classList.toggle('active',objectMulti);
  $('objectGroup').disabled=!!editingGroup||count<2;$('objectUngroup').disabled=!!editingGroup||!items.some(item=>item.group);$('objectCopy').disabled=!count;$('objectDelete').disabled=!count;
  const group=items[0]?.group,canEditGroup=!!group&&items.every(item=>item.group===group);
  $('objectEditGroup').hidden=!editingGroup&&!canEditGroup;$('objectEditGroup').textContent=editingGroup?'Zatvori grupu':'Uredi grupu';$('objectEditGroup').setAttribute('aria-pressed',String(!!editingGroup));
  $('objectTitle').textContent=(editingGroup?'Uređivanje grupe · ':'')+(count===1?CadObjects.definition(items[0].kind).name:count?count+' odabranih elemenata':(editingGroup?'Dodirni element unutar grupe':'Dodirni elemente za višestruki odabir'));
  $('objectRotate').disabled=!count;$('objectMirror').disabled=!count;$('saveCustom').disabled=!count;if(!count)customNaming=false;$('customSaveForm').hidden=!customNaming;
  $('objectWidth').disabled=!count;$('objectDepth').disabled=!count;
  const key=JSON.stringify(items);if(key===objectEditorKey)return;objectEditorKey=key;$('objectError').textContent='';
  if(!count){$('objectWidth').value='';$('objectDepth').value='';return;}
  const box=count===1?items[0]:CadObjects.selectionBounds(items);
  setEditorValue('objectWidth',String(Math.round(box.width*10)/10).replace('.',','));setEditorValue('objectDepth',String(Math.round(box.depth*10)/10).replace('.',','));
 }
 loadCustomLibrary();renderObjectLibrary();
 function loadCustomLibrary(){try{customLibrary=CadObjects.validateTemplates(JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]'));}catch(_){customLibrary=[];}}
 function persistCustomLibrary(library){try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(library));}catch(_){throw new Error('Biblioteka nije spremljena: nema dovoljno prostora u pregledniku.');}}
 function renderObjectLibrary(){$('objectLibrary').innerHTML=buildObjectLibrary();}
 function escapeText(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function customLibraryIcon(template){
  try{const canvas=document.createElement('canvas');canvas.width=72;canvas.height=72;const context=canvas.getContext('2d'),b=CadObjects.selectionBounds(template.items),factor=52/Math.max(b.width,b.depth);
   for(const item of template.items)CadObjects.draw(context,item,factor,36-b.x*factor,36-b.y*factor);return '<img alt="" width="44" height="44" src="'+canvas.toDataURL()+'">';
  }catch(_){return '<span aria-hidden="true">▱</span>';}
 }
 function addCustomObject(id){
  const template=customLibrary.find(item=>item.id===id);if(!template)return;
  try{changeMode('edit');const before=snapshot(),center=point(w/2,h/2),result=CadObjects.instantiate(template,center.x,center.y);objects.push(...result.items);commitObjects(before,result.ids);}
  catch(error){status(error.message);}
 }
 function objectLibraryIcon(item){
  try{
   const canvas=document.createElement('canvas');canvas.width=72;canvas.height=72;const context=canvas.getContext('2d');
   const factor=52/Math.max(item.width,item.depth);CadObjects.draw(context,{...item,x:36,y:['door','double-door'].includes(item.kind)?62:36,width:item.width*factor,depth:item.depth*factor,rotation:0},1,0,0);
   return '<img alt="" width="44" height="44" src="'+canvas.toDataURL()+'">';
  }catch(_){return '<span aria-hidden="true">▱</span>';}
 }
 function buildObjectLibrary(){
  const catalog=CadObjects.catalog.filter(item=>!item.hidden);let html='';
  for(const category of [...new Set(catalog.map(item=>item.category))]){
   html+='<details class="catalog-category" name="object-category"><summary>'+category+'</summary>';
   for(const subcategory of [...new Set(catalog.filter(item=>item.category===category).map(item=>item.subcategory))]){
    html+='<details class="catalog-subcategory" name="object-subcategory-'+category+'"><summary>'+subcategory+'</summary><div class="catalog-items">';
    for(const item of catalog.filter(item=>item.category===category&&item.subcategory===subcategory))html+='<button type="button" data-object="'+item.kind+'">'+objectLibraryIcon(item)+'<span>'+item.name+'</span><small>'+item.width+' × '+item.depth+' cm</small></button>';
    html+='</div></details>';
   }html+='</details>';
  }
  html+='<details class="catalog-category custom-category" name="object-category"><summary>Custom</summary><div class="catalog-items">';
  for(const template of customLibrary){const b=CadObjects.selectionBounds(template.items);html+='<button type="button" data-custom="'+escapeText(template.id)+'">'+customLibraryIcon(template)+'<span>'+escapeText(template.name)+'</span><small>'+Math.round(b.width)+' × '+Math.round(b.depth)+' cm</small></button>';}
  if(!customLibrary.length)html+='<small>Odaberi grupu i spremi je u biblioteku.</small>';
  return html+'</div></details>';
 }
 $('topMenu').addEventListener('toggle',()=>{if($('topMenu').open)$('objectMenu').open=false;});
 $('objectMenu').addEventListener('toggle',()=>{if($('objectMenu').open)$('topMenu').open=false;});
 $('objectLibrary').addEventListener('toggle',e=>{
  const target=e.target;if(!target.open||target.tagName!=='DETAILS'||!target.parentElement)return;
  for(const sibling of target.parentElement.children)if(sibling!==target&&sibling.tagName==='DETAILS')sibling.open=false;
 },true);
 $('objectMenu').addEventListener('click',e=>{const button=e.target?.closest?.('[data-object],[data-custom]');if(button){if(button.dataset.object)addObject(button.dataset.object);else addCustomObject(button.dataset.custom);}});
 $('saveCustom').addEventListener('click',()=>{if(!objectIds.size)return;customNaming=!customNaming;$('customSaveForm').hidden=!customNaming;$('customMessage').textContent='';if(customNaming){$('customName').focus();$('customName').select();}});
 $('customSaveForm').addEventListener('submit',e=>{
  e.preventDefault();try{
   const template=CadObjects.createTemplate(objects,[...objectIds],$('customName').value);
   if(customLibrary.some(item=>item.name.toLocaleLowerCase()===template.name.toLocaleLowerCase()))throw new Error('Taj naziv već postoji. Upiši drugi naziv.');
   const library=CadObjects.validateTemplates([...customLibrary,template]);persistCustomLibrary(library);customLibrary=library;renderObjectLibrary();
   $('customName').value='';customNaming=false;$('customSaveForm').hidden=true;$('customMessage').textContent='Spremljeno u Custom: '+template.name;
  }catch(error){$('customMessage').textContent=error.message;}
 });
 function closeGroupEditor(){
  const group=editingGroup;editingGroup=null;objectIds=new Set(objects.filter(item=>item.group===group).map(item=>item.id));objectMulti=false;objectEditorKey=null;status();draw();
 }
 $('objectEditGroup').addEventListener('click',()=>{
  finishMeasureInput();
  if(editingGroup){closeGroupEditor();return;}
  const items=objects.filter(item=>objectIds.has(item.id)),group=items[0]?.group;
  if(!group||!items.every(item=>item.group===group))return;
  editingGroup=group;objectIds.clear();objectMulti=false;objectEditorKey=null;customNaming=false;status();draw();
 });
 $('objectMulti').addEventListener('click',()=>{objectMulti=!objectMulti;status();draw();});
 $('objectMirror').addEventListener('click',()=>{if(!objectIds.size)return;const before=snapshot();objects=CadObjects.mirror(objects,[...objectIds]);commitObjects(before,[...objectIds]);});
 $('objectRotate').addEventListener('click',()=>{if(!objectIds.size)return;const before=snapshot();try{objects=CadObjects.rotate(objects,[...objectIds]);commitObjects(before,[...objectIds]);}catch(error){$('objectError').textContent=error.message;}});
 $('objectCopy').addEventListener('click',()=>{if(!objectIds.size)return;const before=snapshot();try{const result=CadObjects.duplicate(objects,[...objectIds]);objects=result.items.map(item=>editingGroup&&result.ids.includes(item.id)?{...item,group:editingGroup}:item);commitObjects(before,result.ids);}catch(error){$('objectError').textContent=error.message;}});
 $('objectGroup').addEventListener('click',()=>{if(editingGroup||objectIds.size<2)return;const before=snapshot();objects=CadObjects.group(objects,[...objectIds]);objectMulti=false;commitObjects(before,[...objectIds]);});
 $('objectUngroup').addEventListener('click',()=>{if(editingGroup)return;const before=snapshot();objects=CadObjects.ungroup(objects,[...objectIds]);commitObjects(before,[...objectIds]);});
 $('objectDelete').addEventListener('click',()=>{
  if(!objectIds.size)return;
  const before=snapshot();objects=objects.filter(item=>!objectIds.has(item.id));objectMulti=false;commitObjects(before);
 });
 function applyObjectInputs(e){
  e.preventDefault();if(!objectIds.size)return;const parse=id=>Number($(id).value.trim().replace(',','.'));
  try{const before=snapshot();objects=CadObjects.resize(objects,[...objectIds],parse('objectWidth'),parse('objectDepth'),objects.find(item=>objectIds.has(item.id))?.rotation??0);commitObjects(before,[...objectIds]);}
  catch(error){$('objectError').textContent=error.message;}
 }
 bindLiveEditor('objectForm',applyObjectInputs);
 restore();status();new ResizeObserver(resize).observe(board);resize();
})();
