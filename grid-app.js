'use strict';
(()=>{
 const $=id=>document.getElementById(id),board=$('board'),g=board.getContext('2d');
 const CUSTOM_KEY='cadup_custom_library_v1',KEY='infoa_grid_loops_v1',WIDTH=2000,MIN=5,HISTORY=80;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const VIEW_KEY='cadup_view_settings_v1';
 let showGrid=true,showMeasures=true,viewportTurns=0,autoFullscreen=true,fullscreenPending=true,continuousDrawing=true;
 let customLibrary=[],customNaming=false;
 let objects=[],objectIds=new Set(),objectMulti=false,objectEditorKey=null,liveEdit=null,editingGroup=null,editingObjectId=null,lastGroupTap=null;
 let segments=[],past=[],future=[],first=null,preview=null,mode='edit',wallsVisible=true,selected=null,selectedWall=null,wallSession=null;
 let w=0,h=0,dpr=1,scale=1,ox=0,oy=0,height=2000,gesture=null,frame=false,clearArmed=false,cursor=null,eraseHover=null,eraseObjectIds=[];
 let cachedKey=null,cached=null,pendingTags=[],dimensionHits=[],editingDimension=null,editorSelectionKey=null;
 const pointers=new Map();
 const copy=a=>a.map(s=>({...s}));
 const snapshot=()=>({segments:copy(segments),objects:copy(objects)});
 function restoreSnapshot(state){eraseHover=null;eraseObjectIds=[];segments=copy(state.segments);objects=copy(state.objects||[]);if(editingGroup&&!objects.some(item=>item.group===editingGroup))editingGroup=null;if(editingObjectId&&!objects.some(item=>item.id===editingObjectId))editingObjectId=null;objectIds=new Set(editingObjectId?[editingObjectId]:[]);objectMulti=false;objectEditorKey=null;customNaming=false;}
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
  if(editingObjectId&&!objects.some(item=>item.id===editingObjectId))editingObjectId=null;
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
  if(cachedKey!==key){
   const detected=GridGeometry.detectWithDoors(segments),layout=RoomGeometry.layout(detected.rooms,segments),wallOutlines=layout.wallGroups.map(boxes=>RoomGeometry.union(boxes));
   const wallOutline={area:RoomGeometry.union([...layout.outer,...layout.inner]).area,edges:wallOutlines.flatMap(outline=>outline.edges)};
   cached={...detected,layout,junctions:GridGeometry.junctions(segments),wallOutline,measureEdges:RoomGeometry.wallDimensionEdges(layout,wallOutline.edges)};cachedKey=key;
  }
  return cached;
 }
 const point=(x,y)=>({x:(x-ox)/scale,y:(y-oy)/scale});
 const screen=p=>({x:ox+p.x*scale,y:oy+p.y*scale});
 // Camera rotation is separate from plan geometry and object rotations.
 function displayPoint(p,inverse=false){
  const c=[1,0,-1,0][viewportTurns],s=[0,1,0,-1][viewportTurns]*(inverse?-1:1),x=p.x-w/2,y=p.y-h/2;
  return {x:w/2+x*c-y*s,y:h/2+x*s+y*c};
 }
 function viewBounds(){
  const vw=viewportTurns%2?h:w,vh=viewportTurns%2?w:h;
  return {left:(w-vw)/2,right:(w+vw)/2,top:(h-vh)/2,bottom:(h+vh)/2,width:vw,height:vh};
 }
 function viewportBounds(bounds){
  const a=displayPoint({x:bounds.left,y:bounds.top},true),b=displayPoint({x:bounds.right,y:bounds.bottom},true);
  return {left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
 }
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
  if(mode!=='draw')return;const bounds=viewBounds(),axes=guideAxes(),target=first?(preview||first):cursor?snap(cursor.x,cursor.y):null;
  g.save();g.setLineDash([4,5]);
  for(const axis of ['x','y']){let previous=-Infinity;for(const value of axes[axis]){
   const pixel=(axis==='x'?ox:oy)+value*scale,limit=axis==='x'?bounds.right:bounds.bottom,minimum=axis==='x'?bounds.left:bounds.top,active=target&&Math.abs(target[axis]-value)<.001;
   if(pixel<minimum||pixel>limit||(!active&&pixel-previous<5))continue;previous=pixel;
   g.globalAlpha=active?0.85:0.4;g.strokeStyle=active?'#2563eb':'#93b4d5';g.lineWidth=active?1.25:.75;g.beginPath();
   if(axis==='x'){g.moveTo(pixel,bounds.top);g.lineTo(pixel,bounds.bottom);}else{g.moveTo(bounds.left,pixel);g.lineTo(bounds.right,pixel);}g.stroke();
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
  $('selectMode').classList.toggle('active',mode==='edit');$('selectMode').setAttribute('aria-pressed',String(mode==='edit'));
  const editingWall=mode==='edit'&&!!selectedWall;
  $('wallActions').hidden=!editingWall;
  const editingObjects=mode==='edit'&&(objectIds.size>0||objectMulti||editingGroup);
  $('editorFooter').hidden=!editingWall&&!editingObjects;
  $('modeTools').hidden=!!(editingWall||editingObjects);
  $('objectActions').hidden=!editingObjects;syncObjectEditor();
  $('mainTools').hidden=false;
  syncDimensionEditor();$('undo').disabled=!past.length&&!first;$('redo').disabled=!future.length;
 }
 function commit(before,keepWall=false){
  eraseHover=null;eraseObjectIds=[];
  const state=Array.isArray(before)?{segments:before,objects:copy(objects)}:before;
  if(JSON.stringify(state)===JSON.stringify(snapshot())){status();draw();return;}
  recordChange(state);selected=null;if(!keepWall)selectedWall=null;wallSession=null;save();resetClear();status();draw();
 }
 function add(end){
  if(!first)return;
  if(first.x===end.x&&first.y===end.y){status('Odaberi drugu točku linije');return;}
  const before=copy(segments),stroke={x1:first.x,y1:first.y,x2:end.x,y2:end.y};
  segments=GridGeometry.normalize([...segments,stroke]);
  first=mode==='draw'&&continuousDrawing?{...end}:null;preview=first;if(!continuousDrawing)mode='edit';commit(before);
 }
 function undo(){
  liveEdit=null;
  if((gesture?.type==='object-move'||gesture?.type==='object-resize')||gesture?.type==='wall-move'||gesture?.type==='wall-resize'){cancelInteraction();return;}
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
 let objectControlFrame=null;
 function controlFrameKey(){return JSON.stringify(objects.filter(item=>objectIds.has(item.id)));}
 function objectControlBounds(){
  const key=controlFrameKey();
  if(!objectControlFrame||objectControlFrame.key!==key)objectControlFrame={key,box:CadObjects.selectionBounds(objects.filter(item=>objectIds.has(item.id)))};
  return objectControlFrame.box;
 }
 function objectHandles(){
  const item=objects.find(item=>item.id===editingObjectId);if(!item||objectIds.size!==1||!objectIds.has(item.id))return [];
  const box=objectControlBounds(),offset=14*handleScale()+8,angle=item.rotation*Math.PI/180,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle));
  const corners=[{x:box.left,y:box.top},{x:box.right,y:box.bottom}].map(p=>displayPoint(screen(p)));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  return [{x:right+offset,y:(top+bottom)/2,nx:1,ny:0},{x:(left+right)/2,y:bottom+offset,nx:0,ny:1}].map(handle=>{
   const p=displayPoint(handle,true),origin=displayPoint({x:0,y:0},true),normal=displayPoint({x:handle.nx,y:handle.ny},true),nx=Math.round(normal.x-origin.x),ny=Math.round(normal.y-origin.y);
   const widthDirection=nx*c+ny*s,axis=widthDirection?'width':'depth',side=widthDirection||(-nx*s+ny*c);
   return {...handle,nx,ny,axis,side,item,x:p.x,y:p.y};
  });
 }
 const CONTROL_COLOR='#4b5563';
 function drawControlCircle(fill=false,pressed=false){
  g.strokeStyle=CONTROL_COLOR;g.lineWidth=1.2;g.beginPath();g.arc(0,0,12,0,Math.PI*2);
  if(fill){g.fillStyle=pressed?'#f3f4f6':'rgba(255,255,255,0.96)';g.fill();}g.stroke();
 }
 function drawControlGlyph(kind){
  g.strokeStyle=CONTROL_COLOR;g.lineWidth=1.5;g.lineCap='round';g.lineJoin='round';g.setLineDash([]);
  if(kind==='resize'){
   g.beginPath();g.moveTo(-3.5,-3.5);g.lineTo(-7,0);g.lineTo(-3.5,3.5);g.moveTo(3.5,-3.5);g.lineTo(7,0);g.lineTo(3.5,3.5);g.stroke();
  }else if(kind==='delete'){
   g.beginPath();g.moveTo(-4,-4);g.lineTo(4,4);g.moveTo(4,-4);g.lineTo(-4,4);g.stroke();
  }else if(kind==='duplicate'){
   g.strokeRect(-3,-3,9,9);g.beginPath();g.moveTo(-6,3);g.lineTo(-6,-6);g.lineTo(3,-6);g.stroke();
  }else if(kind==='mirror'){
   g.setLineDash([1.5,2]);g.beginPath();g.moveTo(0,-6);g.lineTo(0,6);g.stroke();g.setLineDash([]);
   g.beginPath();g.moveTo(-3,-4.5);g.lineTo(-7,4.5);g.lineTo(-3,4.5);g.closePath();g.moveTo(3,-4.5);g.lineTo(7,4.5);g.lineTo(3,4.5);g.closePath();g.stroke();
  }else{
   g.beginPath();g.arc(0,0,6,Math.PI*.14,Math.PI*1.75);g.lineTo(6,-2.5);g.stroke();g.beginPath();g.moveTo(6,-6.5);g.lineTo(6,-2.5);g.lineTo(2,-2.5);g.stroke();
  }
 }
 function drawObjectHandles(){
  for(const handle of objectHandles()){
   if(gesture?.type==='object-resize'&&gesture.axis===handle.axis)continue;
   g.save();g.translate(handle.x,handle.y);g.rotate(Math.atan2(handle.ny,handle.nx));g.scale(handleScale(),handleScale());drawControlCircle(true);drawControlGlyph('resize');g.restore();
  }
 }
 function objectViewportActions(){
  const box=objectControlBounds();if(!box||mode!=='edit')return [];
  const corners=[{x:box.left,y:box.top},{x:box.right,y:box.top},{x:box.left,y:box.bottom},{x:box.right,y:box.bottom}].map(p=>displayPoint(screen(p)));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y)),offset=10*handleScale()+2;
  const spacing=30*handleScale(),center=(left+right)/2;
  return ['delete','rotate','mirror','duplicate'].map((action,index)=>({action,screenX:center+(index-1.5)*spacing,screenY:top-20*handleScale()-8})).map(action=>({...action,...displayPoint({x:action.screenX,y:action.screenY},true)}));
 }
 function drawObjectViewportActions(){
  const actions=objectViewportActions(),grouped=actions;
  if(grouped.length){
   const padding=17*handleScale(),left=grouped[0].screenX-padding,top=grouped[0].screenY-padding,width=grouped[grouped.length-1].screenX-grouped[0].screenX+2*padding;
   g.save();g.globalAlpha=1;g.setTransform(dpr,0,0,dpr,0,0);
   g.fillStyle='#ffffff';g.strokeStyle='#cbd5e1';g.lineWidth=1;
   g.beginPath();g.roundRect(left,top,width,2*padding,9*handleScale());g.fill();g.stroke();g.restore();
  }
  for(const action of actions){
   g.save();g.globalAlpha=1;g.setTransform(dpr,0,0,dpr,0,0);g.translate(action.screenX,action.screenY);g.scale(handleScale(),handleScale());
   drawControlCircle(true,gesture?.type==='object-action'&&gesture.action===action.action);drawControlGlyph(action.action);g.restore();
  }
 }
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
  let followed;try{followed=CadObjects.followWallOpenings(drag.beforeObjects,drag.before,resized.segments,{from:drag.wall,to:resized.wall});}catch(_){return;}
  objects=followed;segments=resized.segments;selectedWall=resized.wall;drag.currentWall=resized.wall;schedule();
 }
 function updateWall(p,drag){
  const horizontal=drag.wall.y1===drag.wall.y2;
  const raw=(horizontal?p.y-drag.start.y:p.x-drag.start.x)/scale;
  const old=horizontal?drag.wall.y1:drag.wall.x1;
  const target=snapWallCoordinate(old+raw,horizontal?'y':'x',drag.before,drag.wall);
  const base=horizontal?drag.baseWall.y1:drag.baseWall.x1;
  const moved=GridGeometry.moveWall(drag.baseSegments,drag.baseWall,target-base,MIN,WIDTH,height);
  let followed;try{followed=CadObjects.followWallOpenings(drag.baseObjects,drag.baseSegments,moved.segments,{from:drag.baseWall,to:moved.wall});}catch(_){return;}
  objects=followed;segments=moved.segments;selectedWall=moved.wall;drag.currentWall=moved.wall;drag.currentOffset=moved.delta;schedule();
 }
 function cancelInteraction(){
  if((gesture?.type==='object-move'||gesture?.type==='object-resize'))restoreSnapshot(gesture.before);
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'){segments=gesture.before;objects=copy(gesture.beforeObjects);selectedWall=gesture.wall;wallSession=gesture.beforeSession;}
  gesture=null;pointers.clear();first=null;preview=null;status();draw();
 }
 function limitPan(){
  const bounds=viewBounds(),availableX=bounds.width-WIDTH*scale,availableY=bounds.height-height*scale;
  ox=availableX>0?bounds.left+availableX/2:clamp(ox,bounds.right-WIDTH*scale,bounds.left);
  oy=availableY>0?bounds.top+availableY/2:clamp(oy,bounds.bottom-height*scale,bounds.top);
 }
 function minimumScale(){const bounds=viewBounds();return Math.min(bounds.width/WIDTH,bounds.height/height);}
 function zoomAt(factor,x=w/2,y=h/2){
  const anchor=point(x,y);scale=clamp(scale*factor,minimumScale(),w/WIDTH*25);ox=x-anchor.x*scale;oy=y-anchor.y*scale;limitPan();status();draw();
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
 function tag(x,y,text,color='#24557e',vertical=false,priority=1,dimension=null){if(!showMeasures&&!(mode==='edit'&&selectedWall))return;pendingTags.push({x,y,text,color,vertical,priority,dimension});}
 function paintTags(){
  const occupied=[];dimensionHits=[];
  for(const {x:rawX,y:rawY,text,color,vertical:sourceVertical,priority,dimension} of pendingTags.sort((a,b)=>b.priority-a.priority)){
  let {x,y}=displayPoint({x:rawX,y:rawY});const vertical=sourceVertical!==!!(viewportTurns%2);
  const base=priority===3?7:priority===1?8:12;
  const size=clamp(base+Math.log2(Math.max(1,scale/(w/WIDTH))),base,base+2),boxHeight=size+(priority===3?4:6);
  g.save();g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=editingGroup?0.25:(mode==='edit'&&(selectedWall||objectIds.size)&&priority<5)?0.9:1;g.font='600 '+size+'px system-ui';
  const width=g.measureText(text).width+(priority===3?6:10),halfX=(vertical?boxHeight:width)/2,halfY=(vertical?width:boxHeight)/2;
  x=clamp(x,halfX+3,w-halfX-3);
  y=clamp(y,halfY+3,h-halfY-3);
  const bounds={left:x-halfX-3,right:x+halfX+3,top:y-halfY-2,bottom:y+halfY+2};
  if(occupied.some(r=>r.left<bounds.right&&r.right>bounds.left&&r.top<bounds.bottom&&r.bottom>bounds.top)){g.restore();continue;}
  occupied.push(bounds);if(dimension)dimensionHits.push({...viewportBounds(bounds),dimension});g.translate(x,y);if(vertical)g.rotate(-Math.PI/2);
  g.beginPath();g.roundRect(-width/2,-boxHeight/2,width,boxHeight,Math.min(5,boxHeight/2));
  g.fillStyle='#f1f3f5';g.fill();g.strokeStyle='#cbd0d6';g.lineWidth=.8;g.stroke();
  g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(text,0,0);g.restore();
  }
 }
 function visibleWallCenter(s,padding=24){
  const a=screen({x:s.x1,y:s.y1}),b=screen({x:s.x2,y:s.y2}),horizontal=s.y1===s.y2,bounds=viewBounds();
  if(horizontal){
   if(a.y<bounds.top-padding||a.y>bounds.bottom+padding||Math.max(a.x,b.x)<bounds.left||Math.min(a.x,b.x)>bounds.right)return null;
   return {x:(Math.max(bounds.left,Math.min(a.x,b.x))+Math.min(bounds.right,Math.max(a.x,b.x)))/2,y:a.y};
  }
  if(a.x<bounds.left-padding||a.x>bounds.right+padding||Math.max(a.y,b.y)<bounds.top||Math.min(a.y,b.y)>bounds.bottom)return null;
  return {x:a.x,y:(Math.max(bounds.top,Math.min(a.y,b.y))+Math.min(bounds.bottom,Math.max(a.y,b.y)))/2};
 }
 function draw(){
  if(!w||!h)return;
  const current=model();pendingTags=[];g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.clearRect(0,0,w,h);g.fillStyle='#e9eef3';g.fillRect(0,0,w,h);
  g.translate(w/2,h/2);g.rotate(viewportTurns*Math.PI/2);g.translate(-w/2,-h/2);const bounds=viewBounds();
  g.fillStyle='#fff';g.fillRect(ox,oy,WIDTH*scale,height*scale);
  g.globalAlpha=editingGroup?0.2:(mode==='edit'&&(selectedWall||objectIds.size))?0.7:1;
  // Blaga pastelna ispuna samo zatvorenih prostora; mreža i zidovi crtaju se iznad.
  g.fillStyle='#edf6ef';
  for(const face of current.faces){
   g.beginPath();for(const r of face.rects)g.rect(ox+r.x*scale,oy+r.y*scale,r.width*scale,r.height*scale);g.fill();
  }
  const unit=gridUnit();
  g.lineWidth=1;
  // Mreža prekriva cijeli prikaz, uključujući rubove izvan smanjene radne plohe.
  if(showGrid)for(let i=Math.ceil((bounds.left-ox)/scale/unit);i<=Math.floor((bounds.right-ox)/scale/unit);i++){const x=ox+i*unit*scale;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(x,bounds.top);g.lineTo(x,bounds.bottom);g.stroke();}
  if(showGrid)for(let i=Math.ceil((bounds.top-oy)/scale/unit);i<=Math.floor((bounds.bottom-oy)/scale/unit);i++){const y=oy+i*unit*scale;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(bounds.left,y);g.lineTo(bounds.right,y);g.stroke();}
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
   }g.stroke();
   if(current.layout.unjoinedCaps.length){g.beginPath();for(const cap of current.layout.unjoinedCaps){g.moveTo(ox+cap.x1*scale,oy+cap.y1*scale);g.lineTo(ox+cap.x2*scale,oy+cap.y2*scale);}g.strokeStyle='#fff';g.lineWidth=4;g.stroke();g.strokeStyle='#1e2329';g.lineWidth=1.5;g.stroke();}
  }
  if(!wallsVisible){g.strokeStyle='#1675d1';g.lineWidth=2;g.beginPath();
   for(const s of segments){g.moveTo(ox+s.x1*scale,oy+s.y1*scale);g.lineTo(ox+s.x2*scale,oy+s.y2*scale);}g.stroke();
  }
  // Measure the remaining wall faces on each side of attached openings.
  const openingCuts=[];
  for(const item of objects){
   if(!['door','double-door','window'].includes(item.kind))continue;
   const attached=CadObjects.attach(item,segments);
   if(Math.abs(attached.x-item.x)>=.01||Math.abs(attached.y-item.y)>=.01||attached.rotation%180!==item.rotation%180)continue;
   const wall=hitWallForObject(item);if(!wall)continue;
   const horizontal=wall.y1===wall.y2,start=(horizontal?item.x:item.y)-item.width/2,end=start+item.width;
   for(const box of RoomGeometry.wallSelection(current.rooms,segments,wall,current.layout))openingCuts.push({axis:horizontal?'h':'v',start:Math.max(start,horizontal?box.x:box.y),end:Math.min(end,horizontal?box.x+box.width:box.y+box.height),low:horizontal?box.y:box.x,high:horizontal?box.y+box.height:box.x+box.width});
  }
  for(const e of RoomGeometry.cutWallDimensions(current.measureEdges,openingCuts.filter(cut=>cut.end>cut.start))){
   const wall=e.axis==='h'?{x1:e.span[0],y1:e.line,x2:e.span[1],y2:e.line}:{x1:e.line,y1:e.span[0],x2:e.line,y2:e.span[1]};
   const center=visibleWallCenter(wall);if(!center)continue;
   const visibleLength=e.axis==='h'?Math.min(bounds.right,ox+wall.x2*scale)-Math.max(bounds.left,ox+wall.x1*scale):Math.min(bounds.bottom,oy+wall.y2*scale)-Math.max(bounds.top,oy+wall.y1*scale);
   if(visibleLength<(e.cut?14:36))continue;
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
    g.save();g.translate(p.x,p.y);g.rotate(horizontal?0:Math.PI/2);g.scale(gripScale,gripScale);drawControlCircle();drawControlGlyph('resize');g.restore();
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
   const active=objectIds.has(item.id);g.globalAlpha=editingGroup?(item.group===editingGroup?1:0.2):((selectedWall||objectIds.size)&&!active)?0.7:1;
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
  drawJoinedNodes();drawObjectHandles();paintTags();g.restore();drawObjectViewportActions();g.globalAlpha=1;
 }
 const xy=e=>{const r=board.getBoundingClientRect();return displayPoint({x:e.clientX-r.left,y:e.clientY-r.top},true);};
 function pinch(){
  const [a,b]=[...pointers.values()];if(!b)return;
  if(gesture?.type==='wall-move'||gesture?.type==='wall-resize'){segments=gesture.before;objects=copy(gesture.beforeObjects);selectedWall=gesture.wall;wallSession=gesture.beforeSession;}
  if((gesture?.type==='object-move'||gesture?.type==='object-resize')){const ids=gesture.ids;restoreSnapshot(gesture.before);objectIds=new Set(ids);}
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
   const action=objectViewportActions().find(action=>Math.hypot(p.x-action.x,p.y-action.y)<=13*handleScale());
   if(action){gesture={type:'object-action',id:e.pointerId,start:p,action:action.action,moved:false};draw();return;}
   const handle=objectHandles().find(handle=>Math.hypot(p.x-handle.x,p.y-handle.y)<=14*handleScale());
   if(handle){gesture={type:'object-resize',id:e.pointerId,start:p,axis:handle.axis,side:handle.side,nx:handle.nx,ny:handle.ny,item:{...handle.item},before:snapshot(),ids:[handle.item.id],moved:false};draw();return;}
   const raw=point(p.x,p.y),item=CadObjects.hit(editingGroup?objects.filter(item=>item.group===editingGroup):objects,raw.x,raw.y);
   if(item){
    const ids=editingGroup?[item.id]:CadObjects.expandedSelection(objects,[item.id]);
    if(!objectIds.has(item.id)||objectMulti||e.shiftKey){gesture={type:'pick-pan',id:e.pointerId,start:p,ox,oy,moved:false,pick:{kind:'object',ids,toggle:objectMulti||e.shiftKey}};return;}
    gesture={type:'object-move',id:e.pointerId,start:p,before:snapshot(),ids:[...objectIds]};
    selectedWall=null;wallSession=null;objectEditorKey=null;status();draw();return;
   }
  }
  if(mode==='edit'&&editingGroup){gesture={type:'pan',id:e.pointerId,start:p,ox,oy,moved:false,deselectOnTap:true};status();draw();return;}
  const endpoint=mode==='edit'?hitHandle(p.x,p.y):null;
  if(endpoint){gesture={type:'wall-resize',id:e.pointerId,start:p,wall:selectedWall,endpoint,before:copy(segments),beforeObjects:copy(objects),currentWall:selectedWall,beforeSession:wallSession};status();draw();return;}
  if(mode==='edit'&&dimensionHits.some(r=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom)){gesture={type:'pan',id:e.pointerId,start:p,ox,oy,moved:false};return;}
  if(mode==='edit'){
   const wall=hitWall(p.x,p.y);
   if(wall&&(!selectedWall||!['x1','y1','x2','y2'].every(k=>wall[k]===selectedWall[k]))){gesture={type:'pick-pan',id:e.pointerId,start:p,ox,oy,moved:false,pick:{kind:'wall',wall}};return;}
   if(wall){
    const session=wallSession&&['x1','y1','x2','y2'].every(k=>wallSession.current[k]===wall[k])?wallSession:null;
    gesture={type:'wall-move',id:e.pointerId,start:p,wall,before:copy(segments),beforeObjects:copy(objects),currentWall:wall,beforeSession:wallSession,
     baseObjects:session?session.baseObjects:copy(objects),baseSegments:session?session.baseSegments:copy(segments),baseWall:session?session.baseWall:wall,currentOffset:session?session.offset:0};status();draw();return;
   }
   gesture={type:'pan',id:e.pointerId,start:p,ox,oy,moved:false,deselectOnTap:true};status();draw();return;
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
   scale=clamp(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,minimumScale(),w/WIDTH*25);ox=mid.x-gesture.anchor.x*scale;oy=mid.y-gesture.anchor.y*scale;limitPan();schedule();return;
  }
  if(!gesture||gesture.id!==e.pointerId)return;
  if(gesture.type==='erase-span'){if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>9){gesture.moved=true;if(!gesture.target){ox=gesture.ox+p.x-gesture.start.x;oy=gesture.oy+p.y-gesture.start.y;schedule();}}}
  else if(gesture.type==='object-action'){if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>9)gesture.moved=true;}
  else if(gesture.type==='object-move'){
   if(!gesture.moved&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<3)return;
   gesture.moved=true;
   let moved=CadObjects.moveOnGrid(gesture.before.objects,gesture.ids,(p.x-gesture.start.x)/scale,(p.y-gesture.start.y)/scale,gridUnit());
   moved=CadObjects.snapToWalls(moved,gesture.ids,segments,model().rooms,Math.min(30,14/scale));
   objects=moved;schedule();
  }
  else if(gesture.type==='object-resize'){
   if(!gesture.moved&&Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<3)return;
   gesture.moved=true;const angle=gesture.item.rotation*Math.PI/180,dx=(p.x-gesture.start.x)/scale,dy=(p.y-gesture.start.y)/scale;
   const delta=dx*gesture.nx+dy*gesture.ny;
   objects=CadObjects.resizeFromHandle(gesture.before.objects,gesture.item.id,gesture.axis,delta,5,gesture.side);schedule();
  }
  else if(gesture.type==='preview'){preview=adjust(p,gesture);schedule();}
  else if(gesture.type==='wall-move'){updateWall(p,gesture);}
  else if(gesture.type==='wall-resize'){updateWallLength(p,gesture);}
  else if(gesture.type==='single'||gesture.type==='pan'||gesture.type==='pick-pan'){
   const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(Math.hypot(dx,dy)>9)gesture.moved=true;
   if(gesture.moved){ox=gesture.ox+dx;oy=gesture.oy+dy;schedule();}
  }
 });
 function handleGroupDoubleTap(e,p,last,cancelled){
  if(mode!=='edit'||cancelled||objectMulti||e.shiftKey||!Number.isFinite(e.timeStamp)||!last||last.moved||!['pick-pan','pan','object-move'].includes(last.type)||Math.hypot(p.x-last.start.x,p.y-last.start.y)>9){lastGroupTap=null;return false;}
  if(editingGroup){lastGroupTap=null;return false;}
  const raw=point(p.x,p.y),group=CadObjects.hit(objects,raw.x,raw.y)?.group;
  if(!group){lastGroupTap=null;return false;}
  const key='open:'+group,previous=lastGroupTap;lastGroupTap={key,time:e.timeStamp,x:p.x,y:p.y};
  if(!previous||previous.key!==key||e.timeStamp-previous.time<0||e.timeStamp-previous.time>380||Math.hypot(p.x-previous.x,p.y-previous.y)>22)return false;
  lastGroupTap=null;openGroupEditor(group);return true;
 }
 function release(e,cancelled){
  if(!pointers.has(e.pointerId))return;
  const p=xy(e),last=gesture,wasMulti=last?.type==='pinch'||pointers.size>1;pointers.delete(e.pointerId);
  if(pointers.size){gesture={type:'remaining'};return;}gesture=null;
  if(wasMulti||last?.type==='remaining'){lastGroupTap=null;status();draw();return;}
  if(mode==='edit'&&editingGroup&&last?.type==='pan'&&!cancelled&&!last.moved&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9){
   const raw=point(p.x,p.y),box=CadObjects.selectionBounds(objects.filter(item=>item.group===editingGroup));
   if(box&&(raw.x<box.left||raw.x>box.right||raw.y<box.top||raw.y>box.bottom)){closeGroupEditor();return;}
  }
  if(handleGroupDoubleTap(e,p,last,cancelled))return;
  if(last?.type==='object-action'){if(!cancelled&&!last.moved&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9){if(last.action==='mirror')mirrorSelectedObjects();else if(last.action==='duplicate')duplicateSelectedObjects();else if(last.action==='delete')deleteSelectedObjects();else rotateSelectedObjects();}else{status();draw();}return;}
  if(last?.type==='erase-span'){if(!cancelled&&!last.moved&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9)deleteEraseTarget(last.target);else{eraseHover=null;eraseObjectIds=[];draw();}return;}
  if(last?.type==='pick-pan'){
   if(!cancelled&&!last.moved&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9){
    const pick=last.pick;
    if(pick.kind==='object'){
     if(pick.toggle){const remove=pick.ids.every(id=>objectIds.has(id));for(const id of pick.ids)if(remove)objectIds.delete(id);else objectIds.add(id);}
     else objectIds=new Set(pick.ids);
     if(!objectIds.has(editingObjectId)||objectIds.size!==1)editingObjectId=null;
     selectedWall=null;wallSession=null;objectEditorKey=null;
    }else{objectIds.clear();objectMulti=false;objectEditorKey=null;selectedWall=pick.wall;wallSession=null;}
   }
   status();draw();return;
  }
  if(last?.type==='pan'){
   if(last.deselectOnTap&&!cancelled&&!last.moved&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9){editingObjectId=null;objectIds.clear();objectMulti=false;objectEditorKey=null;selectedWall=null;wallSession=null;selected=null;customNaming=false;}
   status();draw();return;
  }
  if(last?.type==='object-move'||last?.type==='object-resize'){
   if(cancelled){restoreSnapshot(last.before);objectIds=new Set(last.ids);status();draw();}
   else commitObjects(last.before,last.ids);
   return;
  }
  if(last?.type==='wall-resize'){
   if(cancelled){segments=last.before;objects=copy(last.beforeObjects);selectedWall=last.wall;wallSession=last.beforeSession;status();draw();}
   else{const wall=last.currentWall;commit({segments:last.before,objects:last.beforeObjects});selectedWall=wall;wallSession=null;status();draw();}
  }else if(last?.type==='wall-move'){
   if(cancelled){segments=last.before;objects=copy(last.beforeObjects);selectedWall=last.wall;wallSession=last.beforeSession;status();draw();}
   else{const wall=last.currentWall;commit({segments:last.before,objects:last.beforeObjects});selectedWall=wall;
    wallSession={baseObjects:last.baseObjects,baseSegments:last.baseSegments,baseWall:last.baseWall,offset:last.currentOffset,current:wall};status();draw();}
  }
  else if(last?.type==='preview'&&first){
   if(cancelled){preview=first;status();draw();}
   else{
    const q=snap(p.x,p.y),raw=point(p.x,p.y),tap=!last.dragMode&&Math.hypot(p.x-last.start.x,p.y-last.start.y)<=9;
    const onAxis=Math.min(Math.abs(raw.x-first.x),Math.abs(raw.y-first.y))*scale<=12;
    // Repeating the endpoint or tapping away from both orthogonal axes ends the chain.
    if(mode==='draw'&&tap&&((q.x===first.x&&q.y===first.y)||!onAxis))changeMode('edit');
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
  if(e.target!==board)lastGroupTap=null;
  if(liveEdit&&e.target!==liveEdit.input){const input=liveEdit.input;finishMeasureInput();input.blur?.();}
  if(!e.target?.closest?.('#topMenu'))$('topMenu').open=false;if(!e.target?.closest?.('#objectMenu'))$('objectMenu').open=false;
 },true);
 function changeMode(next){liveEdit=null;closeMenu();cancelInteraction();mode=next;editingGroup=null;editingObjectId=null;lastGroupTap=null;eraseHover=null;eraseObjectIds=[];cursor=null;selectedWall=null;wallSession=null;objectIds.clear();objectMulti=false;objectEditorKey=null;customNaming=false;resetClear();status();draw();}
 function saveViewSettings(){
  try{localStorage.setItem(VIEW_KEY,JSON.stringify({grid:showGrid,measures:showMeasures,rotation:viewportTurns,autoFullscreen,continuousDrawing}));}catch(_){}
 }
 function restoreViewSettings(){
  try{const saved=JSON.parse(localStorage.getItem(VIEW_KEY)||'{}');showGrid=saved.grid!==false;showMeasures=saved.measures!==false;autoFullscreen=saved.autoFullscreen!==false;continuousDrawing=saved.continuousDrawing!==false;viewportTurns=Number.isInteger(saved.rotation)&&saved.rotation>=0&&saved.rotation<4?saved.rotation:0;}catch(_){}
  fullscreenPending=autoFullscreen;$('showGrid').checked=showGrid;$('showMeasures').checked=showMeasures;$('autoFullscreen').checked=autoFullscreen;$('continuousDrawing').checked=continuousDrawing;
 }
 async function enterAutoFullscreen(){
  if(!autoFullscreen||!fullscreenPending)return;
  fullscreenPending=false;const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(document.fullscreenElement||document.webkitFullscreenElement||!request)return;
  try{await request.call(root);}catch(_){}
 }
 document.addEventListener('pointerup',()=>{void enterAutoFullscreen();},true);
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')void enterAutoFullscreen();},true);
 for(const id of ['showGrid','showMeasures','continuousDrawing'])$(id).addEventListener('change',()=>{
  showGrid=$('showGrid').checked;showMeasures=$('showMeasures').checked;continuousDrawing=$('continuousDrawing').checked;saveViewSettings();draw();
 });
 $('autoFullscreen').addEventListener('change',async()=>{
  autoFullscreen=$('autoFullscreen').checked;fullscreenPending=autoFullscreen;saveViewSettings();
  if(autoFullscreen)await enterAutoFullscreen();
  else if(document.fullscreenElement||document.webkitFullscreenElement){try{await (document.exitFullscreen||document.webkitExitFullscreen)?.call(document);}catch(_){}}
 });
 $('viewportRotate').addEventListener('click',()=>{finishMeasureInput();closeMenu();if(gesture)cancelInteraction();viewportTurns=(viewportTurns+1)%4;saveViewSettings();lastGroupTap=null;status();draw();});
 $('drawMode').addEventListener('click',()=>changeMode('draw'));
 $('eraseMode').addEventListener('click',()=>changeMode('erase'));
 $('selectMode').addEventListener('click',()=>changeMode('edit'));
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
 function deselectWall(){editingObjectId=null;editingGroup=null;customNaming=false;objectIds.clear();objectMulti=false;objectEditorKey=null;selectedWall=null;wallSession=null;status();draw();}
 function selectedDimension(){if(!selectedWall)return null;const current=model();return RoomGeometry.visibleWallDimension(current.rooms,segments,selectedWall,current.layout);}
 $('wallDelete').addEventListener('click',()=>eraseSpan(selectedWall));
 $('clearAll').addEventListener('click',()=>{
  if(!segments.length&&!objects.length)return;
  if(!clearArmed){clearArmed=true;$('clearAll').textContent='Potvrdi';$('clearAll').classList.add('armed');status('Ponovno dodirni za brisanje tlocrta');return;}
  const before=snapshot();segments=[];objects=[];editingObjectId=null;editingGroup=null;objectIds.clear();first=null;preview=null;commit(before);
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
   const before=snapshot(),axis=h?'x':'y',followed=CadObjects.followWallOpenings(objects,segments,updated,{from:wall,to:selection,shift:{axis,cut:wall[axis+'2'],delta:selection[axis+'2']-wall[axis+'2']}});segments=updated;objects=followed;selectedWall=selection;commit(before,true);status();draw();
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
   cancelInteraction();const before=snapshot();segments=imported;objects=importedObjects;editingObjectId=null;editingGroup=null;objectIds.clear();
   wallsVisible=true;selected=null;selectedWall=null;wallSession=null;
   commit(before);save();resetClear();draw();status('Tlocrt je uvezen · Poništi vraća prethodni crtež');
  }catch(error){status('Uvoz nije uspio: '+(error instanceof SyntaxError?'Datoteka nije valjan JSON.':error.message));}
  finally{input.value='';}
 });
 $('plus').addEventListener('click',()=>zoomAt(1.16));$('minus').addEventListener('click',()=>zoomAt(1/1.16));$('fit').addEventListener('click',fit);
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
  editingObjectId=count===1&&(!items[0].group||items[0].group===editingGroup)?items[0].id:null;
  $('objectMulti').setAttribute('aria-pressed',String(objectMulti));$('objectMulti').classList.toggle('active',objectMulti);
  $('objectGroup').disabled=!!editingGroup||count<2;$('objectUngroup').disabled=!!editingGroup||!items.some(item=>item.group);$('objectCopy').disabled=!count;
  const group=items[0]?.group,canEditGroup=!!group&&items.every(item=>item.group===group);
  const selectedGroup=canEditGroup&&!editingGroup,hasGroups=items.some(item=>item.group)&&!editingGroup;
  const showDimensions=count===1&&!objectMulti&&!selectedGroup;
  $('objectForm').hidden=!showDimensions;
  $('objectGroupMenu').hidden=!objectMulti&&!selectedGroup&&!editingGroup;
  $('objectGroup').hidden=!objectMulti||hasGroups;
  $('objectUngroup').hidden=!hasGroups;
  $('objectActions').classList.toggle('group-controls',!showDimensions);

  $('objectEditGroup').hidden=!editingGroup;$('objectEditGroup').textContent=editingGroup?'Zatvori grupu':'Uredi grupu';$('objectEditGroup').setAttribute('aria-pressed',String(!!editingGroup));
  $('objectTitle').textContent=(editingGroup?'Uređivanje grupe · ':'')+(count===1?CadObjects.definition(items[0].kind).name:count?count+' odabranih elemenata':(editingGroup?'Dodirni element unutar grupe':'Dodirni elemente za višestruki odabir'));
  $('saveCustom').disabled=!count;if(!count)customNaming=false;$('customSaveForm').hidden=!customNaming;
  $('objectWidth').disabled=!showDimensions;$('objectDepth').disabled=!showDimensions;
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
  for(const template of customLibrary){const b=CadObjects.selectionBounds(template.items);html+='<div class="custom-entry"><button type="button" data-custom="'+escapeText(template.id)+'">'+customLibraryIcon(template)+'<span>'+escapeText(template.name)+'</span><small>'+Math.round(b.width)+' × '+Math.round(b.depth)+' cm</small></button><button class="custom-delete" type="button" data-delete-custom="'+escapeText(template.id)+'" aria-label="Izbriši iz biblioteke: '+escapeText(template.name)+'" title="Izbriši iz biblioteke"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v8m4-8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';}
  if(!customLibrary.length)html+='<small>Odaberi grupu i spremi je u biblioteku.</small>';
  return html+'</div></details>';
 }
 $('topMenu').addEventListener('toggle',()=>{if($('topMenu').open)$('objectMenu').open=false;});
 $('objectMenu').addEventListener('toggle',()=>{if($('objectMenu').open)$('topMenu').open=false;});
 $('objectLibrary').addEventListener('toggle',e=>{
  const target=e.target;if(!target.open||target.tagName!=='DETAILS'||!target.parentElement)return;
  for(const sibling of target.parentElement.children)if(sibling!==target&&sibling.tagName==='DETAILS')sibling.open=false;
 },true);
 function deleteCustomObject(id){
  if(!customLibrary.some(template=>template.id===id))return;
  try{const library=customLibrary.filter(template=>template.id!==id);persistCustomLibrary(library);customLibrary=library;renderObjectLibrary();const category=$('objectLibrary').querySelector?.('.custom-category');if(category)category.open=true;}
  catch(error){status(error.message);}
 }
 $('objectMenu').addEventListener('click',e=>{const button=e.target?.closest?.('[data-object],[data-custom],[data-delete-custom]');if(button){if(button.dataset.deleteCustom)deleteCustomObject(button.dataset.deleteCustom);else if(button.dataset.object)addObject(button.dataset.object);else addCustomObject(button.dataset.custom);}});
 $('saveCustom').addEventListener('click',()=>{if(!objectIds.size)return;customNaming=!customNaming;$('customSaveForm').hidden=!customNaming;$('customMessage').textContent='';if(customNaming){$('customName').focus();$('customName').select();}});
 $('customSaveForm').addEventListener('submit',e=>{
  e.preventDefault();try{
   const template=CadObjects.createTemplate(objects,[...objectIds],$('customName').value);
   if(customLibrary.some(item=>item.name.toLocaleLowerCase()===template.name.toLocaleLowerCase()))throw new Error('Taj naziv već postoji. Upiši drugi naziv.');
   const library=CadObjects.validateTemplates([...customLibrary,template]);persistCustomLibrary(library);customLibrary=library;renderObjectLibrary();
   $('customName').value='';customNaming=false;$('customSaveForm').hidden=true;$('customMessage').textContent='Spremljeno u Custom: '+template.name;
  }catch(error){$('customMessage').textContent=error.message;}
 });
 function openGroupEditor(group){
  if(!group||!objects.some(item=>item.group===group))return;
  lastGroupTap=null;editingObjectId=null;editingGroup=group;objectIds.clear();objectMulti=false;objectEditorKey=null;customNaming=false;selectedWall=null;wallSession=null;status();draw();
 }
 function closeGroupEditor(){
  lastGroupTap=null;editingObjectId=null;const group=editingGroup;editingGroup=null;objectIds=new Set(objects.filter(item=>item.group===group).map(item=>item.id));objectMulti=false;objectEditorKey=null;status();draw();
 }
 $('objectEditGroup').addEventListener('click',()=>{
  finishMeasureInput();
  if(editingGroup){closeGroupEditor();return;}
  const items=objects.filter(item=>objectIds.has(item.id)),group=items[0]?.group;
  if(!group||!items.every(item=>item.group===group))return;
  openGroupEditor(group);
 });
 $('objectMulti').addEventListener('click',()=>{objectMulti=!objectMulti;status();draw();});
 function mirrorSelectedObjects(){if(!objectIds.size)return;const before=snapshot();objectControlBounds();objects=CadObjects.mirror(objects,[...objectIds]);objectControlFrame.key=controlFrameKey();commitObjects(before,[...objectIds]);}
 function rotateSelectedObjects(){if(!objectIds.size)return;const before=snapshot();try{objectControlBounds();objects=CadObjects.rotate(objects,[...objectIds]);objectControlFrame.key=controlFrameKey();commitObjects(before,[...objectIds]);}catch(error){$('objectError').textContent=error.message;}}
 function duplicateSelectedObjects(){if(!objectIds.size)return;const before=snapshot();try{const result=CadObjects.duplicate(objects,[...objectIds]);objects=result.items.map(item=>editingGroup&&result.ids.includes(item.id)?{...item,group:editingGroup}:item);commitObjects(before,result.ids);}catch(error){$('objectError').textContent=error.message;}}
 $('objectCopy').addEventListener('click',duplicateSelectedObjects);
 $('objectGroup').addEventListener('click',()=>{if(editingGroup||objectIds.size<2)return;const before=snapshot();objects=CadObjects.group(objects,[...objectIds]);objectMulti=false;commitObjects(before,[...objectIds]);});
 $('objectUngroup').addEventListener('click',()=>{if(editingGroup)return;const before=snapshot();objects=CadObjects.ungroup(objects,[...objectIds]);commitObjects(before,[...objectIds]);});
 function deleteSelectedObjects(){
  if(!objectIds.size)return;
  const before=snapshot();objects=objects.filter(item=>!objectIds.has(item.id));objectMulti=false;commitObjects(before);
 }
 function applyObjectInputs(e){
  e.preventDefault();if(objectIds.size!==1||objectMulti||$('objectForm').hidden)return;const parse=id=>Number($(id).value.trim().replace(',','.'));
  try{const before=snapshot();objects=CadObjects.resize(objects,[...objectIds],parse('objectWidth'),parse('objectDepth'),objects.find(item=>objectIds.has(item.id))?.rotation??0);commitObjects(before,[...objectIds]);}
  catch(error){$('objectError').textContent=error.message;}
 }
 bindLiveEditor('objectForm',applyObjectInputs);
 restoreViewSettings();restore();status();new ResizeObserver(resize).observe(board);resize();
})();
