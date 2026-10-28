'use strict';

globalThis.ObjectSketch=(()=>{
 const EPS=1e-6,MAX_LINES=2000,faceCache=new WeakMap();
 const clone=lines=>lines.map(line=>({...line}));
 const opening=item=>CadObjects.isSwingOpening(item.kind);
 const extent=item=>({left:-50,right:50,top:opening(item)?-100:-50,bottom:opening(item)?0:50});
 function validate(lines,item){
  const box=extent(item);
  if(!Array.isArray(lines)||lines.length>MAX_LINES)throw new Error('Crtez objekta ima previse linija.');
  return lines.map(line=>{
   if(line?.type==='circle'){
    if(!['cx','cy','rx','ry'].every(key=>Number.isFinite(line[key]))||line.rx<=EPS||line.ry<=EPS||line.cx-line.rx<box.left-EPS||line.cx+line.rx>box.right+EPS||line.cy-line.ry<box.top-EPS||line.cy+line.ry>box.bottom+EPS)throw new Error('Neispravna kruznica objekta.');
    return {type:'circle',cx:line.cx,cy:line.cy,rx:line.rx,ry:line.ry};
   }
   if(!line||!['x1','y1','x2','y2'].every(key=>Number.isFinite(line[key]))||
    [1,2].some(n=>line['x'+n]<box.left-EPS||line['x'+n]>box.right+EPS||line['y'+n]<box.top-EPS||line['y'+n]>box.bottom+EPS)||
    Math.hypot(line.x2-line.x1,line.y2-line.y1)<EPS)throw new Error('Neispravna linija objekta.');
   return {x1:line.x1,y1:line.y1,x2:line.x2,y2:line.y2};
  });
 }
 // Split intersections and walk directed edges to find bounded planar faces.
 function faces(lines){
  if(faceCache.has(lines))return faceCache.get(lines);
  const original=lines;lines=lines.filter(line=>line.type!=='circle');
  const cuts=lines.map(()=>[0,1]),cross=(x,y,a,b)=>x*b-y*a;
  const parameter=(line,x,y)=>Math.abs(line.x2-line.x1)>Math.abs(line.y2-line.y1)?(x-line.x1)/(line.x2-line.x1):(y-line.y1)/(line.y2-line.y1);
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
   const a=lines[i],b=lines[j],ax=a.x2-a.x1,ay=a.y2-a.y1,bx=b.x2-b.x1,by=b.y2-b.y1,dx=b.x1-a.x1,dy=b.y1-a.y1,den=cross(ax,ay,bx,by);
   if(Math.abs(den)>EPS){const t=cross(dx,dy,bx,by)/den,u=cross(dx,dy,ax,ay)/den;if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS){cuts[i].push(Math.max(0,Math.min(1,t)));cuts[j].push(Math.max(0,Math.min(1,u)));}}
   else if(Math.abs(cross(dx,dy,ax,ay))<EPS){
    for(const n of [1,2]){const t=parameter(a,b['x'+n],b['y'+n]),u=parameter(b,a['x'+n],a['y'+n]);if(t>0&&t<1)cuts[i].push(t);if(u>0&&u<1)cuts[j].push(u);}
   }
  }
  const nodes=new Map(),edges=new Set(),key=(x,y)=>Math.round(x/EPS)+','+Math.round(y/EPS);
  const node=(x,y)=>{const id=key(x,y);if(!nodes.has(id))nodes.set(id,{id,x,y,neighbors:new Set()});return nodes.get(id);};
  lines.forEach((line,i)=>{
   const values=[...new Set(cuts[i])].sort((a,b)=>a-b);
   for(let k=1;k<values.length;k++){
    const at=t=>node(line.x1+(line.x2-line.x1)*t,line.y1+(line.y2-line.y1)*t),a=at(values[k-1]),b=at(values[k]);if(a.id===b.id)continue;
    a.neighbors.add(b);b.neighbors.add(a);
   }
  });
  for(const n of nodes.values())n.sorted=[...n.neighbors].sort((a,b)=>Math.atan2(a.y-n.y,a.x-n.x)-Math.atan2(b.y-n.y,b.x-n.x));
  const result=[];
  for(const start of nodes.values())for(const next of start.sorted){
   let a=start,b=next,polygon=[],closed=false;
   for(let count=0;count<nodes.size*4+4;count++){
    const edge=a.id+'>'+b.id;if(edges.has(edge))break;edges.add(edge);polygon.push({x:a.x,y:a.y});
    const index=b.sorted.indexOf(a),c=b.sorted[(index-1+b.sorted.length)%b.sorted.length];a=b;b=c;
    if(a===start&&b===next){closed=true;break;}
   }
   const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
   if(closed&&polygon.length>=3&&area>EPS)result.push(polygon);
  }
  faceCache.set(original,result);return result;
 }
 function paint(g,lines,fill='#f1f3f5'){
  g.save();g.fillStyle=fill;
  for(const polygon of faces(lines)){g.beginPath();polygon.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill();}
  for(const circle of lines.filter(line=>line.type==='circle')){g.beginPath();g.ellipse(circle.cx,circle.cy,circle.rx,circle.ry,0,0,Math.PI*2);g.fill();}
  g.beginPath();for(const line of lines){if(line.type==='circle'){g.moveTo(line.cx+line.rx,line.cy);g.ellipse(line.cx,line.cy,line.rx,line.ry,0,0,Math.PI*2);}else{g.moveTo(line.x1,line.y1);g.lineTo(line.x2,line.y2);}}g.stroke();g.restore();
 }
 // Flatten the existing catalog symbol, so editing starts with its actual drawing.
 function extract(item){
  if(item.sketch)return clone(item.sketch.lines);
  const lines=[],box=extent(item);let path=[],current=null,start=null;
  const point=(x,y)=>({x,y}),moveTo=(x,y)=>{current=point(x,y);start=current;};
  const lineTo=(x,y)=>{if(current)path.push({x1:current.x,y1:current.y,x2:x,y2:y});current=point(x,y);};
  const ellipse=(x,y,rx,ry,rotation=0,from=0,to=Math.PI*2,ccw=false)=>{
   let sweep=to-from;if(Math.abs(sweep)>=Math.PI*2)sweep=(ccw?-1:1)*Math.PI*2;else if(ccw&&sweep>0)sweep-=Math.PI*2;else if(!ccw&&sweep<0)sweep+=Math.PI*2;
   const count=Math.max(4,Math.ceil(Math.abs(sweep)*10));
   for(let i=0;i<=count;i++){const a=from+sweep*i/count,px=x+rx*Math.cos(a)*Math.cos(rotation)-ry*Math.sin(a)*Math.sin(rotation),py=y+rx*Math.cos(a)*Math.sin(rotation)+ry*Math.sin(a)*Math.cos(rotation);if(i===0)moveTo(px,py);else lineTo(px,py);}
  };
  const recorder={beginPath(){path=[];current=null;start=null;},moveTo,lineTo,closePath(){if(start)lineTo(start.x,start.y);},
   rect(x,y,w,h){moveTo(x,y);lineTo(x+w,y);lineTo(x+w,y+h);lineTo(x,y+h);lineTo(x,y);},
   roundRect(x,y,w,h,r){r=Math.min(typeof r==='number'?r:0,w/2,h/2);moveTo(x+r,y);lineTo(x+w-r,y);const arc=(cx,cy,from)=>{for(let i=1;i<=6;i++)lineTo(cx+r*Math.cos(from+i*Math.PI/12),cy+r*Math.sin(from+i*Math.PI/12));};arc(x+w-r,y+r,-Math.PI/2);lineTo(x+w,y+h-r);arc(x+w-r,y+h-r,0);lineTo(x+r,y+h);arc(x+r,y+h-r,Math.PI/2);lineTo(x,y+r);arc(x+r,y+r,Math.PI);},
   ellipse,arc(x,y,r,from,to,ccw){ellipse(x,y,r,r,0,from,to,ccw);},
   stroke(){lines.push(...path);},fill(){},fillRect(){},save(){},restore(){},translate(){},rotate(){},scale(){},clip(){},setLineDash(){}};
  CadObjects.draw(recorder,{...item,sketch:undefined,rotation:0,mirrored:false},1,0,0);
  // Clip strokes to the declared object footprint, including catalog curves.
  const clipped=[];
  for(const line of lines){
   const dx=line.x2-line.x1,dy=line.y2-line.y1;let lo=0,hi=1,valid=true;
   for(const [p,q] of [[-dx,line.x1-box.left],[dx,box.right-line.x1],[-dy,line.y1-box.top],[dy,box.bottom-line.y1]]){
    if(Math.abs(p)<EPS){if(q<0)valid=false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}
   }
   if(valid&&hi>lo&&Math.hypot(dx,dy)*(hi-lo)>EPS)clipped.push({x1:line.x1+dx*lo,y1:line.y1+dy*lo,x2:line.x1+dx*hi,y2:line.y1+dy*hi});
  }
  return validate(clipped,item);
 }
 let editor=null;
 function open(item,onSave,options={}){
  if(editor)editor.close();
  const $=id=>document.getElementById(id),root=$('sketchEditor'),canvas=$('sketchBoard'),g=canvas.getContext('2d'),box=extent(item),previousFocus=document.activeElement;
  const background=['appHeader','board','modeTools','editorFooter','viewportRotate'].map($);for(const element of background)element.inert=true;
  let lines=extract(item),past=[],future=[],tool='select',selected=-1,anchor=null,preview=null,gesture=null,w=0,h=0,zoom=1,ox=0,oy=0,pointers=new Map(),closed=false;
  const sx=()=>item.width*zoom/100,sy=()=>item.depth*zoom/100;
  const screen=p=>({x:ox+p.x*sx(),y:oy+p.y*sy()});
  const raw=p=>({x:(p.x-ox)/sx(),y:(p.y-oy)/sy()});
  const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const snap=p=>{
   const q=raw(p),step=GridGeometry.drawingStep(zoom),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
   const result={x:clamp(box.left+Math.round((q.x-box.left)*item.width/100/step)*step*100/item.width,box.left,box.right),y:clamp(box.bottom+Math.round((q.y-box.bottom)*item.depth/100/step)*step*100/item.depth,box.top,box.bottom)};
   let distance=10;for(const line of lines)for(const n of [1,2]){const point=line.type==='circle'?{x:line.cx+(n===1?line.rx:-line.rx),y:line.cy}:{x:line['x'+n],y:line['y'+n]},s=screen(point),d=Math.hypot(s.x-p.x,s.y-p.y);if(d<distance){distance=d;result.x=point.x;result.y=point.y;}}
   return result;
  };
  const metric=p=>({x:p.x*item.width/100,y:p.y*item.depth/100});
  const second=(start,p)=>snap(p);
  const circleFrom=(center,end)=>{const a=metric(center),b=metric(end),radius=Math.min(Math.hypot(b.x-a.x,b.y-a.y),(center.x-box.left)*item.width/100,(box.right-center.x)*item.width/100,(center.y-box.top)*item.depth/100,(box.bottom-center.y)*item.depth/100);return {type:'circle',cx:center.x,cy:center.y,rx:radius*100/item.width,ry:radius*100/item.depth};};

  const outside=p=>{const q=raw(p);return q.x<box.left||q.x>box.right||q.y<box.top||q.y>box.bottom;};
  const hit=p=>{
   let best=-1,distance=12;
   lines.forEach((line,i)=>{if(line.type==='circle'){const c=screen({x:line.cx,y:line.cy}),rx=line.rx*sx(),ry=line.ry*sy(),angle=Math.atan2((p.y-c.y)/ry,(p.x-c.x)/rx),d=Math.hypot(p.x-c.x-rx*Math.cos(angle),p.y-c.y-ry*Math.sin(angle));if(d<=distance){distance=d;best=i;}return;}const a=screen({x:line.x1,y:line.y1}),b=screen({x:line.x2,y:line.y2}),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);if(d<=distance){distance=d;best=i;}});return best;
  };
  function draw(){
   if(closed||!w||!h)return;const dpr=Math.min(window.devicePixelRatio||1,3);g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.fillStyle='#e9eef3';g.fillRect(0,0,w,h);
   const a=screen({x:box.left,y:box.top}),b=screen({x:box.right,y:box.bottom});g.fillStyle='#f8fafc';g.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
   g.lineWidth=1;const unit=GridGeometry.drawingStep(zoom),gridX=ox+box.left*sx(),gridY=oy+box.bottom*sy();
   for(let i=Math.ceil(-gridX/zoom/unit);i<=(w-gridX)/zoom/unit;i++){const x=gridX+i*unit*zoom;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
   for(let i=Math.ceil(-gridY/zoom/unit);i<=(h-gridY)/zoom/unit;i++){const y=gridY+i*unit*zoom;g.strokeStyle=i%5===0?'#c1ccda':'#e4e9f0';g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
   g.save();g.translate(ox,oy);g.scale(sx(),sy());g.strokeStyle='#111111';g.lineWidth=1.4/Math.max(.01,Math.min(sx(),sy()));paint(g,lines,'rgba(203,213,225,0.3)');g.restore();
   const stroke=(line,color,width)=>{const a=screen({x:line.x1,y:line.y1}),b=screen({x:line.x2,y:line.y2});g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();};
   if(selected>=0&&lines[selected]?.type==='circle'){const circle=lines[selected],c=screen({x:circle.cx,y:circle.cy});g.strokeStyle='#2563eb';g.lineWidth=2;g.beginPath();g.ellipse(c.x,c.y,circle.rx*sx(),circle.ry*sy(),0,0,Math.PI*2);g.stroke();g.beginPath();g.arc(c.x+circle.rx*sx(),c.y,6,0,Math.PI*2);g.fillStyle='#fff';g.fill();g.stroke();}
   if(selected>=0&&lines[selected]&&lines[selected].type!=='circle'){const line=lines[selected];stroke(line,'#2563eb',3);for(const n of [1,2]){const p=screen({x:line['x'+n],y:line['y'+n]});g.beginPath();g.arc(p.x,p.y,6,0,Math.PI*2);g.fillStyle='#fff';g.fill();g.stroke();}}
   if(anchor){const p=screen(anchor);g.save();g.strokeStyle='#94a3b8';g.lineWidth=1;g.setLineDash([3,5]);g.beginPath();g.moveTo(0,p.y);g.lineTo(w,p.y);g.moveTo(p.x,0);g.lineTo(p.x,h);g.stroke();g.restore();}
   if(anchor&&tool==='circle'){const circle=circleFrom(anchor,preview||anchor),c=screen(anchor);g.strokeStyle='#1675d1';g.lineWidth=2;g.setLineDash([5,4]);g.beginPath();g.ellipse(c.x,c.y,Math.max(0,circle.rx*sx()),Math.max(0,circle.ry*sy()),0,0,Math.PI*2);g.stroke();g.setLineDash([]);}
   if(anchor&&tool!=='circle'){const end=preview||anchor;g.setLineDash([7,5]);stroke({x1:anchor.x,y1:anchor.y,x2:end.x,y2:end.y},'#1675d1',2.5);g.setLineDash([]);for(const point of [anchor,end]){const p=screen(point);g.beginPath();g.arc(p.x,p.y,5,0,Math.PI*2);g.fillStyle='#fff';g.fill();g.stroke();}const a=screen(anchor),b=screen(end),length=Math.hypot((end.x-anchor.x)*item.width/100,(end.y-anchor.y)*item.depth/100);if(length){g.font='600 12px system-ui';g.fillStyle='#24557e';g.fillText(length.toLocaleString('hr-HR',{maximumFractionDigits:1})+' cm',(a.x+b.x)/2,(a.y+b.y)/2-12);}}
   $('sketchUndo').disabled=!past.length;$('sketchRedo').disabled=!future.length;
   for(const name of ['select','draw','circle','erase']){$('sketch'+name).setAttribute('aria-pressed',String(tool===name));$('sketch'+name).classList.toggle('active',tool===name);}
   $('sketchDelete').hidden=selected<0;
  }
  function resize(){w=canvas.clientWidth;h=canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(window.devicePixelRatio||1,3);canvas.width=w*dpr;canvas.height=h*dpr;fit();}
  function fit(){zoom=Math.max(.01,Math.min((w-80)/item.width,(h-80)/item.depth));ox=w/2;oy=h/2-(box.top+box.bottom)/2*sy();draw();}
  function commit(next){try{next=validate(next,item);if(JSON.stringify(next)===JSON.stringify(lines))return;past.push(clone(lines));if(past.length>80)past.shift();future=[];lines=next;$('sketchHint').textContent='';}catch(error){$('sketchHint').textContent=error.message;}draw();}
  function mode(next){tool=next;anchor=null;preview=null;selected=-1;draw();}
  function undo(){if(!past.length)return;future.push(clone(lines));lines=past.pop();selected=-1;anchor=null;preview=null;draw();}
  function redo(){if(!future.length)return;past.push(clone(lines));lines=future.pop();selected=-1;draw();}
  function finish(){if(closed)return;onSave({lines:clone(lines)});close();}
  function close(){closed=true;root.hidden=true;observer.disconnect();document.removeEventListener('keydown',keyboard,true);for(const element of background)element.inert=false;previousFocus?.focus?.({preventScroll:true});editor=null;canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=canvas.onwheel=null;}
  function cancelGesture(){if(gesture?.before)lines=gesture.before;gesture=null;pointers.clear();preview=null;draw();}
  canvas.onpointerdown=e=>{
   e.preventDefault();if(e.button!==undefined&&e.button!==0)return;canvas.setPointerCapture(e.pointerId);const p=local(e);pointers.set(e.pointerId,p);
   if(pointers.size>1){if(gesture?.before)lines=gesture.before;const [a,b]=[...pointers.values()];gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,anchor:raw({x:(a.x+b.x)/2,y:(a.y+b.y)/2})};return;}
   const index=hit(p);let endpoint=null;
   if(outside(p)&&index<0){gesture={type:'pan',id:e.pointerId,start:p,ox,oy};return;}
   if(tool==='select'&&selected>=0&&lines[selected]?.type==='circle'){const circle=lines[selected],q=screen({x:circle.cx+circle.rx,y:circle.cy});if(Math.hypot(p.x-q.x,p.y-q.y)<12)endpoint='radius';}
   if(tool==='select'&&selected>=0&&lines[selected]?.type!=='circle')for(const n of [1,2]){const line=lines[selected],q=screen({x:line['x'+n],y:line['y'+n]});if(Math.hypot(p.x-q.x,p.y-q.y)<12)endpoint=n;}
   if(endpoint!==null)gesture={type:'move',id:e.pointerId,start:p,before:clone(lines),index:selected,endpoint};
   else if(tool==='select'){selected=index;gesture=index<0?{type:'pan',id:e.pointerId,start:p,ox,oy}:{type:'move',id:e.pointerId,start:p,before:clone(lines),index,endpoint:null};}
   else if(tool==='draw'||tool==='circle')gesture={type:tool,id:e.pointerId,start:p,from:anchor||snap(p),chained:!!anchor};
   else gesture={type:'erase',id:e.pointerId,start:p,index};draw();
  };
  canvas.onpointermove=e=>{
   const p=local(e);if(!pointers.has(e.pointerId)){if(anchor){preview=second(anchor,p);draw();}return;}e.preventDefault();pointers.set(e.pointerId,p);if(!gesture)return;
   if(gesture.type==='pinch'){if(pointers.size<2)return;const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};zoom=Math.max(.05,Math.min(100,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));ox=mid.x-gesture.anchor.x*sx();oy=mid.y-gesture.anchor.y*sy();draw();return;}
   if(gesture.id!==e.pointerId)return;const moved=Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>3;
   if(!gesture.moved&&!moved)return;gesture.moved=true;
   if(gesture.type==='pan'){ox=gesture.ox+p.x-gesture.start.x;oy=gesture.oy+p.y-gesture.start.y;}
   else if(gesture.type==='draw'||gesture.type==='circle'){anchor=gesture.from;preview=second(anchor,p);}
   else if(gesture.type==='move'){
    const base=gesture.before[gesture.index],next={...base};
    if(base.type==='circle'){
     if(gesture.endpoint==='radius')Object.assign(next,circleFrom({x:base.cx,y:base.cy},snap(p)));
     else{const a=raw(gesture.start),b=raw(p),unit=GridGeometry.drawingStep(zoom),dx=Math.round((b.x-a.x)*item.width/100/unit)*unit*100/item.width,dy=Math.round((b.y-a.y)*item.depth/100/unit)*unit*100/item.depth;next.cx=Math.max(box.left+base.rx,Math.min(box.right-base.rx,base.cx+dx));next.cy=Math.max(box.top+base.ry,Math.min(box.bottom-base.ry,base.cy+dy));}
    }
    else if(gesture.endpoint){const q=snap(p);next['x'+gesture.endpoint]=q.x;next['y'+gesture.endpoint]=q.y;}
    else{const a=raw(gesture.start),b=raw(p),unit=GridGeometry.drawingStep(zoom),shiftX=(box.left+Math.round((base.x1-box.left+b.x-a.x)*item.width/100/unit)*unit*100/item.width)-base.x1,shiftY=(box.bottom+Math.round((base.y1-box.bottom+b.y-a.y)*item.depth/100/unit)*unit*100/item.depth)-base.y1,dx=Math.max(box.left-Math.min(base.x1,base.x2),Math.min(box.right-Math.max(base.x1,base.x2),shiftX)),dy=Math.max(box.top-Math.min(base.y1,base.y2),Math.min(box.bottom-Math.max(base.y1,base.y2),shiftY));next.x1+=dx;next.x2+=dx;next.y1+=dy;next.y2+=dy;}
    lines=clone(gesture.before);lines[gesture.index]=next;
   }draw();
  };
  function release(e,cancelled){
   if(!pointers.has(e.pointerId))return;const p=local(e),last=gesture;pointers.delete(e.pointerId);if(!last)return;
   if(last.type==='pinch'){if(!pointers.size)gesture=null;return;}
   gesture=null;if(cancelled){if(last.before)lines=last.before;anchor=null;preview=null;draw();return;}
   if(last.type==='move'&&last.moved){const next=lines;lines=last.before;commit(next);}
   else if(last.type==='erase'&&!last.moved&&last.index>=0){selected=-1;commit(lines.filter((_,i)=>i!==last.index));}
   else if(last.type==='circle'){
    if(last.chained||last.moved){const circle=circleFrom(last.from,snap(p));if(circle.rx>EPS&&circle.ry>EPS)commit([...lines,circle]);anchor=null;preview=null;}else{anchor=last.from;preview=anchor;}
   }
   else if(last.type==='draw'){
    const end=second(last.from,p),start=last.from;
    if(last.chained||last.moved){
     if(Math.hypot(start.x-end.x,start.y-end.y)<EPS){mode('select');return;}
     commit([...lines,{x1:start.x,y1:start.y,x2:end.x,y2:end.y}]);
     anchor=options.continuousDrawing===false?null:end;if(options.continuousDrawing===false)tool='select';
    }else anchor=start;preview=anchor;
   }draw();
  }
  canvas.onpointerup=e=>{e.preventDefault();release(e,false);};canvas.onpointercancel=e=>release(e,true);canvas.onlostpointercapture=e=>release(e,true);
  canvas.oncontextmenu=e=>e.preventDefault();
  canvas.onwheel=e=>{e.preventDefault();const p=local(e),q=raw(p);zoom=Math.max(.05,Math.min(100,zoom*(e.deltaY<0?1.1:1/1.1)));ox=p.x-q.x*sx();oy=p.y-q.y*sy();draw();};
  function keyboard(e){if(closed)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();if(anchor){anchor=null;preview=null;draw();}else close();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}else if((e.key==='Delete'||e.key==='Backspace')&&selected>=0){e.preventDefault();commit(lines.filter((_,i)=>i!==selected));selected=-1;draw();}}
  for(const name of ['select','draw','circle','erase'])$('sketch'+name).onclick=()=>{cancelGesture();mode(name);};
  $('sketchClose').onclick=close;$('sketchDone').onclick=finish;$('sketchUndo').onclick=undo;$('sketchRedo').onclick=redo;$('sketchFit').onclick=fit;
  $('sketchDelete').onclick=()=>{if(selected>=0){const index=selected;selected=-1;commit(lines.filter((_,i)=>i!==index));}};
  $('sketchTitle').textContent=CadObjects.definition(item.kind).name;$('sketchHint').textContent='Crtaj kao u tlocrtu. Spremi zadrzava izmjene, Close izlazi bez spremanja.';
  root.hidden=false;const observer=new ResizeObserver(resize);observer.observe(canvas);document.addEventListener('keydown',keyboard,true);resize();root.focus({preventScroll:true});
  editor={close};return {get lines(){return clone(lines);},get selected(){return selected;},screen,mode,undo,redo,finish,close};
 }
 return {validate,faces,paint,extract,open};
})();
