'use strict';
globalThis.CadObjects=(()=>{
 const catalog=[
  ['sofa','Namještaj','Dnevni boravak','Kauč',220,90],['armchair','Namještaj','Dnevni boravak','Fotelja',90,90],['coffee','Namještaj','Dnevni boravak','Klub stol',110,60],
  ['sofa-seat','Namještaj','Moduli kauča','Ravni modul',90,90],['sofa-corner','Namještaj','Moduli kauča','Kutni modul',90,90],['sofa-chaise','Namještaj','Moduli kauča','Ležaj s naslonom',80,160],['sofa-ottoman','Namještaj','Moduli kauča','Puf / sjedalo',80,60],['sofa-arm','Namještaj','Moduli kauča','Rukonaslon',20,90],['sofa-back','Namještaj','Moduli kauča','Naslon',80,20],
  ['shape-rectangle','Geometrija','Osnovni oblici','Pravokutnik',100,60],['shape-square','Geometrija','Osnovni oblici','Kvadrat',100,100],['shape-ellipse','Geometrija','Osnovni oblici','Elipsa',100,60],['shape-circle','Geometrija','Osnovni oblici','Krug',100,100],['shape-triangle','Geometrija','Osnovni oblici','Trokut',100,100],['shape-l','Geometrija','Osnovni oblici','L-oblik',100,100],
  ['bed','Namještaj','Spavaća soba','Bračni krevet',180,210],['single-bed','Namještaj','Spavaća soba','Jednostruki krevet',100,210],['wardrobe-single','Namještaj','Spavaća soba','Jednostruki ormar',90,60],['wardrobe','Namještaj','Spavaća soba','Dvostruki ormar',180,60],['wardrobe-triple','Namještaj','Spavaća soba','Trostruki ormar',270,60],
  ['table','Namještaj','Blagovaonica','Pravokutni stol',180,90],['round-table','Namještaj','Blagovaonica','Okrugli stol',110,110],['chair','Namještaj','Blagovaonica','Stolica',50,50],['dining-set','Namještaj','Blagovaonica','Stol 180 + 6 stolica',270,180],['round-dining-set','Namještaj','Blagovaonica','Okrugli stol + 4 stolice',210,210],
  ['desk','Namještaj','Radna soba','Radni stol',140,70],['shelf','Namještaj','Radna soba','Polica',120,35],
  ['base-cabinet','Kuhinja','Donji elementi','Donji element',60,60],['drawer-cabinet','Kuhinja','Donji elementi','Ladičar',60,60],['corner-cabinet','Kuhinja','Donji elementi','Kutni element',90,90],['sink-cabinet','Kuhinja','Donji elementi','Element sa sudoperom',80,60],['island','Kuhinja','Donji elementi','Kuhinjski otok',160,90],['wall-cabinet','Kuhinja','Gornji elementi','Gornji element',60,35],['tall-cabinet','Kuhinja','Visoki elementi','Visoki ormar',60,60],['oven','Kuhinja','Uređaji','Pećnica',60,60],['dishwasher','Kuhinja','Uređaji','Perilica posuđa',60,60],['kitchen','Kuhinja','Elementi','Kuhinjski niz',240,60],['fridge','Kuhinja','Uređaji','Hladnjak',60,65],['cooker','Kuhinja','Uređaji','Štednjak',60,60],
  ['countertop','Kuhinja','Radne ploče','Radna ploča',120,60],['double-sink-cabinet','Kuhinja','Donji elementi','Dvostruki sudoper',120,60],
  ['bath','Kupaonica','Sanitarije','Kada',170,75],['shower','Kupaonica','Sanitarije','Tuš',90,90],['toilet','Kupaonica','Sanitarije','WC',40,70],['sink','Kupaonica','Sanitarije','Umivaonik',60,50],['washer','Kupaonica','Uređaji','Perilica',60,60],
  ['door','Otvori','Vrata','Jednokrilna vrata',90,90],['double-door','Otvori','Vrata','Dvokrilna vrata',160,80],['window','Otvori','Prozori','Fiksni prozor',120,20],['window-casement','Otvori','Prozori','Jednokrilni prozor',90,90],['window-double','Otvori','Prozori','Dvokrilni prozor',120,60],['window-tilt','Otvori','Prozori','Prozor na kip',90,20],['window-sliding','Otvori','Prozori','Klizni prozor',160,20],['window-sliding-three','Otvori','Prozori','Trokrilni klizni prozor',240,20],['stairs','Konstrukcija','Stepenice','Ravne stepenice',100,300]
 ].map(([kind,category,subcategory,name,width,depth])=>({kind,category,subcategory,name,width,depth,hidden:['kitchen','sofa-chaise','sofa-ottoman','sofa-arm','sofa-back'].includes(kind)}));
 const definition=kind=>catalog.find(item=>item.kind===kind);
 const isWindow=kind=>typeof kind==='string'&&(kind==='window'||kind.startsWith('window-'));
 const isOpening=kind=>kind==='door'||kind==='double-door'||isWindow(kind);
 const isSwingOpening=kind=>['door','double-door','window-casement','window-double'].includes(kind);
 let serial=0;const id=()=> 'o-'+Date.now().toString(36)+'-'+(++serial).toString(36);
 const clone=items=>items.map(item=>({...item}));
 const rotation=angle=>((angle%360)+360)%360;
 function bounds(item){
  const angle=rotation(item.rotation)*Math.PI/180,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle)),opening=isSwingOpening(item.kind);
  const corners=[[-item.width/2,opening?-item.depth:-item.depth/2],[item.width/2,opening?-item.depth:-item.depth/2],[-item.width/2,opening?0:item.depth/2],[item.width/2,opening?0:item.depth/2]].map(([x,y])=>({x:item.x+x*c-y*s,y:item.y+x*s+y*c}));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  return {left,right,top,bottom,width:right-left,depth:bottom-top};
 }
 function selectionBounds(items){
  if(!items.length)return null;const boxes=items.map(bounds),left=Math.min(...boxes.map(b=>b.left)),right=Math.max(...boxes.map(b=>b.right)),top=Math.min(...boxes.map(b=>b.top)),bottom=Math.max(...boxes.map(b=>b.bottom));
  return {left,right,top,bottom,width:right-left,depth:bottom-top,x:(left+right)/2,y:(top+bottom)/2};
 }
 function constrain(items,width=2000,height=2000){
  const b=selectionBounds(items);if(!b)return items;if(b.width>width||b.depth>height)throw new Error('Elementi prelaze veličinu tlocrta.');
  const dx=b.left<0?-b.left:b.right>width?width-b.right:0,dy=b.top<0?-b.top:b.bottom>height?height-b.bottom:0;
  return items.map(item=>({...item,x:item.x+dx,y:item.y+dy}));
 }
 function create(kind,x,y){const item=definition(kind);if(!item)throw new Error('Nepoznat element.');return constrain([{id:id(),kind,x,y,width:item.width,depth:item.depth,rotation:0,group:null}])[0];}
 function validate(input){
  if(!Array.isArray(input)||input.length>2000)throw new Error('Neispravan popis elemenata.');const seen=new Set(),parents=new Map();
  return input.map(item=>{
   if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||seen.has(item.id)||!definition(item.kind)||
    !['x','y','width','depth','rotation'].every(k=>Number.isFinite(item[k]))||item.width<5||item.depth<5||item.width>2000||item.depth>2000||item.rotation%90!==0||
    (item.mirrored!==undefined&&typeof item.mirrored!=='boolean')||
    (item.group!=null&&(typeof item.group!=='string'||item.group.length>100)))throw new Error('Neispravan element u JSON-u.');
   seen.add(item.id);const result={id:item.id,kind:item.kind,x:item.x,y:item.y,width:item.width,depth:item.depth,rotation:rotation(item.rotation),group:item.group??null};
   if(item.subgroups!==undefined){if(!item.group||!Array.isArray(item.subgroups)||item.subgroups.length>32||item.subgroups.some(key=>typeof key!=='string'||!key||key.length>100)||new Set([item.group,...item.subgroups]).size!==item.subgroups.length+1)throw new Error('Neispravna hijerarhija grupa.');if(item.subgroups.length)result.subgroups=[...item.subgroups];}
   const path=groupPath(result);path.forEach((key,index)=>{const parent=index?path[index-1]:null;if(parents.has(key)&&parents.get(key)!==parent)throw new Error('Grupa ne moze imati vise roditelja.');parents.set(key,parent);});
   if(item.sketch!==undefined){if(!item.sketch||typeof item.sketch!=='object')throw new Error('Neispravan crtez objekta.');result.sketch={lines:ObjectSketch.validate(item.sketch.lines,item)};}
   if(item.mirrored)result.mirrored=true;
   const b=bounds(result);if(b.left<-.001||b.top<-.001||b.right>2000.001||b.bottom>2000.001)throw new Error('Element je izvan tlocrta.');return result;
  });
 }
 function hit(items,x,y){return [...items].reverse().find(item=>{const b=bounds(item);return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;})||null;}
 // Paths run from the outermost group to the innermost subgroup.
 function groupPath(item){return item.group?[item.group,...(item.subgroups||[])]:[];}
 function inGroup(item,key){return groupPath(item).includes(key);}
 function groupAt(item,scope=null){const path=groupPath(item),index=scope===null?0:path.indexOf(scope)+1;return scope!==null&&index===0?null:path[index]||null;}
 function withGroupPath(item,path){const next={...item,group:path[0]||null};if(path.length>1)next.subgroups=path.slice(1);else delete next.subgroups;return next;}
 function expandedSelection(items,ids,scope=null){
  const selected=new Set(ids),groups=new Set(items.filter(item=>selected.has(item.id)).map(item=>groupAt(item,scope)).filter(Boolean));
  return items.filter(item=>(scope===null||inGroup(item,scope))&&(selected.has(item.id)||groups.has(groupAt(item,scope)))).map(item=>item.id);
 }
 function move(items,ids,dx,dy){
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id)),b=selectionBounds(group);if(!b)return clone(items);
  dx=Math.max(-b.left,Math.min(2000-b.right,dx));dy=Math.max(-b.top,Math.min(2000-b.bottom,dy));
  return items.map(item=>selected.has(item.id)?{...item,x:item.x+dx,y:item.y+dy}:{...item});
 }
 function moveOnGrid(items,ids,dx,dy,unit=5){
  const selected=new Set(ids),box=selectionBounds(items.filter(item=>selected.has(item.id)));
  if(!box)return clone(items);
  // Anchor the actual lower-left corner, not the original object centre.
  return move(items,ids,Math.round((box.left+dx)/unit)*unit-box.left,Math.round((box.bottom+dy)/unit)*unit-box.bottom);
 }
 function resizeFromHandle(items,id,axis,delta,unit=5,side=null){
  const item=items.find(item=>item.id===id);if(!item||!['width','depth'].includes(axis)||!Number.isFinite(delta))return clone(items);
  const opening=isSwingOpening(item.kind),direction=side===null&&axis==='depth'&&opening?-1:1;
  const size=Math.max(5,Math.min(2000,Math.round((item[axis]+delta*direction)/unit)*unit)),change=size-item[axis];
  const dx=axis==='width'?change/2*(side??(item.mirrored?-1:1)):0,dy=axis==='depth'?(opening?(side===1?change:0):change/2*(side??1)):0,angle=item.rotation*Math.PI/180;
  const next={...item,[axis]:size,x:item.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:item.y+dx*Math.sin(angle)+dy*Math.cos(angle)},box=bounds(next);
  if(box.left<0||box.top<0||box.right>2000||box.bottom>2000)return clone(items);
  return items.map(other=>other.id===id?next:{...other});
 }
 function resize(items,ids,width,depth,angle){
  if(![width,depth].every(n=>Number.isFinite(n)&&n>=5&&n<=2000)||!Number.isFinite(angle)||angle%90!==0)throw new Error('Mjere moraju biti od 5 do 2000 cm, a kut višekratnik 90°.');
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id));if(!group.length)return clone(items);let resized;
  if(group.length===1)resized=[{...group[0],width,depth,rotation:rotation(angle)}];
  else{const b=selectionBounds(group),sx=width/b.width,sy=depth/b.depth;resized=group.map(item=>{const swap=item.rotation%180!==0;return {...item,x:b.x+(item.x-b.x)*sx,y:b.y+(item.y-b.y)*sy,width:item.width*(swap?sy:sx),depth:item.depth*(swap?sx:sy)};});}
  if(resized.some(item=>item.width<5||item.depth<5))throw new Error('Pojedini element postaje manji od 5 cm.');
  const fitted=constrain(resized),map=new Map(fitted.map(item=>[item.id,item]));return items.map(item=>map.get(item.id)||{...item});
 }
 function rotate(items,ids){
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id));if(!group.length)return clone(items);
  const center=group.length===1?group[0]:selectionBounds(group);
  const turned=constrain(group.map(item=>({...item,x:center.x-(item.y-center.y),y:center.y+(item.x-center.x),rotation:rotation(item.rotation+90)})));
  const map=new Map(turned.map(item=>[item.id,item]));return items.map(item=>map.get(item.id)||{...item});
 }
 // Mirror in the local width direction; the selected object/group frame rotates with it.
 function mirror(items,ids){
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id));if(!group.length)return clone(items);
  const center=group.length===1?group[0]:selectionBounds(group),angle=group[0].rotation,c=Math.round(Math.cos(angle*Math.PI/180)),s=Math.round(Math.sin(angle*Math.PI/180));
  return items.map(item=>{
   if(!selected.has(item.id))return {...item};
   const distance=(item.x-center.x)*c+(item.y-center.y)*s;
   const reflected={...item,x:item.x-2*distance*c,y:item.y-2*distance*s,rotation:rotation(2*angle-item.rotation)};
   if(item.mirrored)delete reflected.mirrored;else reflected.mirrored=true;
   return reflected;
  });
 }
 function duplicate(items,ids,scope=null){
  const selected=new Set(ids),groups=new Map(),copies=items.filter(item=>selected.has(item.id)).map(item=>{
   const path=groupPath(item),start=scope===null?0:path.indexOf(scope)+1;
   const copied=path.map((key,index)=>{if(index<start)return key;if(!groups.has(key))groups.set(key,id());return groups.get(key);});
   return withGroupPath({...item,id:id(),x:item.x+40,y:item.y+40},copied);
  });const fitted=constrain(copies);return {items:[...clone(items),...fitted],ids:fitted.map(item=>item.id)};
 }
 function group(items,ids,scope=null){
  const selected=new Set(expandedSelection(items,ids,scope)),chosen=items.filter(item=>selected.has(item.id));
  const units=new Set(chosen.map(item=>groupAt(item,scope)||item.id));if(units.size<2)return clone(items);
  if(chosen.some(item=>groupPath(item).length>=33))throw new Error('Najvise 33 razine grupa.');
  const key=id();return items.map(item=>{if(!selected.has(item.id))return {...item};const path=groupPath(item),index=scope===null?0:path.indexOf(scope)+1;return withGroupPath(item,[...path.slice(0,index),key,...path.slice(index)]);});
 }
 function ungroup(items,ids,scope=null){
  const groups=new Set(items.filter(item=>ids.includes(item.id)).map(item=>groupAt(item,scope)).filter(Boolean));
  return items.map(item=>{const key=groupAt(item,scope);return key&&groups.has(key)?withGroupPath(item,groupPath(item).filter(value=>value!==key)):{...item};});
 }
 function attach(item,walls){
  if(!isOpening(item.kind))return item;
  let best=null,distance=35;
  for(const wall of walls){const h=wall.y1===wall.y2,start=h?wall.x1:wall.y1,end=h?wall.x2:wall.y2;if(end-start<item.width)continue;
   const along=h?item.x:item.y,normal=h?item.y:item.x,line=h?wall.y1:wall.x1;if(along<start-20||along>end+20)continue;
   const d=Math.abs(normal-line);if(d<distance){distance=d;best={h,start,end,line};}
  }
  if(!best)return item;const along=Math.max(best.start+item.width/2,Math.min(best.end-item.width/2,best.h?item.x:item.y));
  let angle=best.h?(item.rotation%180===0?item.rotation:0):(item.rotation%180!==0?item.rotation:90);
  let attached={...item,x:best.h?along:best.line,y:best.h?best.line:along,rotation:angle},b=bounds(attached);
  if(b.left<0||b.top<0||b.right>2000||b.bottom>2000){angle=rotation(angle+180);attached={...attached,rotation:angle};b=bounds(attached);}
  return b.left<0||b.top<0||b.right>2000||b.bottom>2000?item:attached;
 }
 function createTemplate(items,ids,name){
  name=String(name??'').trim();if(!name||name.length>60)throw new Error('Upiši naziv do 60 znakova.');
  const chosen=items.filter(item=>ids.includes(item.id));if(!chosen.length)throw new Error('Prvo odaberi elemente.');
  const b=selectionBounds(chosen),centered=move(chosen,chosen.map(item=>item.id),1000-b.x,1000-b.y);
  return {id:id(),name,items:validate(centered)};
 }
 function validateTemplates(input){
  if(!Array.isArray(input)||input.length>100)throw new Error('Neispravna Custom biblioteka.');const seen=new Set();let count=0;
  return input.map(template=>{
   if(!template||typeof template.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(template.id)||seen.has(template.id)||typeof template.name!=='string'||!template.name.trim()||template.name.trim().length>60||!Array.isArray(template.items)||!template.items.length)throw new Error('Neispravan Custom objekt.');
   seen.add(template.id);const items=validate(template.items);count+=items.length;if(count>2000)throw new Error('Custom biblioteka ima previše elemenata.');return {id:template.id,name:template.name.trim(),items};
  });
 }
 function instantiate(template,x,y){
  const valid=validateTemplates([template])[0],copies=duplicate(valid.items,valid.items.map(item=>item.id)),items=copies.items.filter(item=>copies.ids.includes(item.id)),b=selectionBounds(items);
  const moved=move(items,copies.ids,x-b.x,y-b.y);return {items:group(moved,copies.ids),ids:copies.ids};
 }
 function followWallOpenings(items,before,after,options={}){
  const horizontal=wall=>wall.y1===wall.y2,range=wall=>horizontal(wall)?[wall.x1,wall.x2]:[wall.y1,wall.y2],normal=wall=>horizontal(wall)?wall.y1:wall.x1;
  const matches=(wall,h,line)=>horizontal(wall)===h&&Math.abs(normal(wall)-line)<.01;
  const same=(a,b)=>['x1','y1','x2','y2'].every(k=>Math.abs(a[k]-b[k])<.01);
  return items.map(item=>{
   if(!isOpening(item.kind))return {...item};
   const h=item.rotation%180===0,along=h?item.x:item.y,line=h?item.y:item.x;
   const support=before.find(wall=>matches(wall,h,line)&&along-item.width/2>=range(wall)[0]-.01&&along+item.width/2<=range(wall)[1]+.01);
   if(!support)return {...item};
   let target=null,nextAlong=along,nextLine=line;
   const from=options.from,to=options.to;
   if(from&&to&&matches(from,h,line)&&along>=range(from)[0]&&along<=range(from)[1]){
    target=to;nextLine=normal(to);
    const a=range(from),b=range(to);if(Math.abs((b[0]-a[0])-(b[1]-a[1]))<.01)nextAlong+=b[0]-a[0];
   }else{
    const unchanged=after.find(wall=>same(wall,support));
    if(unchanged)target=unchanged;
    else{
     const shift=options.shift;
     if(shift&&shift.delta){
      const p={x:item.x,y:item.y};if(p[shift.axis]>=shift.cut-.001)p[shift.axis]+=shift.delta;
      nextAlong=h?p.x:p.y;nextLine=h?p.y:p.x;
     }
     const candidates=after.filter(wall=>matches(wall,h,nextLine));
     candidates.sort((a,b)=>Math.max(range(a)[0]-nextAlong,0,nextAlong-range(a)[1])-Math.max(range(b)[0]-nextAlong,0,nextAlong-range(b)[1]));
     target=candidates[0];
    }
   }
   if(!target)return {...item};
   const [start,end]=range(target);if(end-start<item.width-.001)throw new Error('Zid je prekratak za vrata ili prozor.');
   nextAlong=Math.max(start+item.width/2,Math.min(end-item.width/2,nextAlong));nextLine=normal(target);
   const next=attach({...item,x:h?nextAlong:nextLine,y:h?nextLine:nextAlong},[target]),box=bounds(next);
   if(box.left<-.001||box.top<-.001||box.right>2000.001||box.bottom>2000.001)throw new Error('Otvor prelazi rub tlocrta.');
   return next;
  });
 }
 function snapToWalls(items,ids,walls,rooms=[],tolerance=20){
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id));if(!group.length)return clone(items);
  if(group.length===1&&isOpening(group[0].kind))return items.map(item=>selected.has(item.id)?attach(item,walls):{...item});
  const box=selectionBounds(group),covered=(x,y)=>rooms.some(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);
  let dx=0,dy=0,distanceX=tolerance+.001,distanceY=tolerance+.001;
  for(const wall of walls){
   const h=wall.y1===wall.y2,line=h?wall.y1:wall.x1,start=h?wall.x1:wall.y1,end=h?wall.x2:wall.y2,mid=(start+end)/2;
   if((h?box.right:box.bottom)<=start||(h?box.left:box.top)>=end)continue;
   const negative=covered(h?mid:line-.001,h?line-.001:mid),positive=covered(h?mid:line+.001,h?line+.001:mid),outer=negative!==positive,t=wall.thickness??(outer?30:10);
   const low=line-t/2,high=line+t/2;
   const center=h?box.y:box.x,offset=center<=line?low-(h?box.bottom:box.right):high-(h?box.top:box.left);
   if(h&&Math.abs(offset)<distanceY){distanceY=Math.abs(offset);dy=offset;}
   if(!h&&Math.abs(offset)<distanceX){distanceX=Math.abs(offset);dx=offset;}
  }
  return move(items,ids,dx,dy);
 }
 // Wall faces expressed in the door's unmirrored local coordinates (centimetres).
 function doorWallProfile(item,boxes){
  const angle=item.rotation*Math.PI/180,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle)),values=[];
  for(const box of boxes)for(const x of [box.x,box.x+box.width])for(const y of [box.y,box.y+box.height])values.push(-(x-item.x)*s+(y-item.y)*c);
  return values.length?{min:Math.min(...values)||0,max:Math.max(...values)||0}:null;
 }
 function doorGeometry(item,profile=null){
  const source=definition(item.kind),jamb=Math.min(8,300/source.width),leaf=Math.min(7,400/source.width),near=profile?profile.min*100/item.depth:-15,far=profile?profile.max*100/item.depth:0;
  const left=-50+jamb,right=50-jamb,double=['double-door','window-double'].includes(item.kind),radiusX=(right-left)/(double?2:1),radiusY=Math.min(93,radiusX*source.width/source.depth);
  return {jamb,leaf,near,far,left,right,radiusX,radiusY,top:near-radiusY,double};
 }
 function draw(g,item,scale,ox,oy,selected=false,wallThickness=0,erase=false,groupSelected=!!item.group,wallProfile=null){
  const fx=item.width*scale/100,fy=item.depth*scale/100;
  g.save();g.translate(ox+item.x*scale,oy+item.y*scale);g.rotate(item.rotation*Math.PI/180);g.scale(item.mirrored?-fx:fx,fy);
  g.lineWidth=1.2/Math.max(.1,Math.min(fx,fy));g.lineJoin='round';g.lineCap='round';g.strokeStyle=erase?'#dc2626':selected?(groupSelected?'#9333ea':'#2563eb'):'#111111';g.fillStyle=erase?'#fee2e2':selected?(groupSelected?'#f3e8ff':'#dbeafe'):'#f1f3f5';
  const rect=(x,y,w,h)=>{g.beginPath();g.rect(x,y,w,h);if(!isWindow(item.kind))g.fill();g.stroke();},line=(x,y,a,b)=>{g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.stroke();},ellipse=(x,y,rx,ry)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.stroke();};
  const opening=isOpening(item.kind);
  const door=isSwingOpening(item.kind)?doorGeometry(item,wallProfile):null;
  // Keep hardware at both wall faces and preserve the full swing beyond the near face.
  const clipTop=door&&!item.sketch?Math.min(-100,door.top-.6):door?-100:-50,clipBottom=door&&!item.sketch?Math.max(0,door.far+.6):door?0:50;
  g.beginPath();g.rect(-50,clipTop,100,clipBottom-clipTop);g.clip();
  if(item.sketch){ObjectSketch.paint(g,item.sketch.lines,isWindow(item.kind)?'rgba(0,0,0,0)':'#f1f3f5');g.restore();return;}
  if(opening){if(wallThickness){g.fillStyle='#fff';g.fillRect(-50,-wallThickness/item.depth*50,100,wallThickness/item.depth*100);g.fillStyle=erase?'#fee2e2':selected?(groupSelected?'#f3e8ff':'#dbeafe'):'#f8fafc';}}

  const inset=0,edge=50;
  const polygon=points=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke();};
  // Elementary fixed CAD symbols: one fill, black contours and no adaptive detail.
  const rounded=(x,y,w,h,r=3)=>{g.beginPath();g.roundRect(x,y,w,h,r);g.fill();g.stroke();};
  const housing=()=>rect(-edge,-edge,2*edge,2*edge);
  const wardrobe=(parts=1)=>{
   g.beginPath();g.rect(-edge,-edge,2*edge,2*edge);g.fill();
   const stroke=()=>{g.save();g.scale(1/fx,1/fy);g.lineWidth=1.1;g.stroke();g.restore();};stroke();
   g.beginPath();for(let i=0;i<parts;i++){const left=-edge+i*2*edge/parts,right=-edge+(i+1)*2*edge/parts;if(i){g.moveTo(left,-edge);g.lineTo(left,edge);}g.moveTo(left,-edge);g.lineTo(right,edge);g.moveTo(left,edge);g.lineTo(right,-edge);}stroke();
  };
  const chair=(x,y,w,h,back='top')=>{rect(x-w/2,y-h/2,w,h);if(back==='left'||back==='right'){const bx=x+(back==='left'?-1:1)*w*.25;line(bx,y-h/2,bx,y+h/2);}else{const by=y+(back==='top'?-1:1)*h*.25;line(x-w/2,by,x+w/2,by);}};

  switch(item.kind){
   case 'shape-rectangle':case 'shape-square':rect(-edge,-edge,2*edge,2*edge);break;
   case 'shape-circle':case 'shape-ellipse':g.beginPath();g.ellipse(0,0,edge,edge,0,0,Math.PI*2);g.fill();g.stroke();break;
   case 'shape-triangle':polygon([[0,-edge],[edge,edge],[-edge,edge]]);break;
   case 'shape-l':polygon([[-edge,-edge],[0,-edge],[0,0],[edge,0],[edge,edge],[-edge,edge]]);break;
   case 'sofa-seat':case 'sofa-chaise':housing();line(-edge,-28,edge,-28);break;
   case 'sofa-corner':housing();line(-edge,-28,edge,-28);line(-28,-28,-28,edge);break;
   case 'sofa-ottoman':housing();break;
   case 'sofa-arm':case 'sofa-back':housing();break;
   case 'sofa':case 'armchair':{
    housing();line(-edge,-28,edge,-28);line(-35,-28,-35,edge);line(35,-28,35,edge);
    if(item.kind==='sofa'){line(-12,-28,-12,edge);line(12,-28,12,edge);}break;
   }
   case 'bed':case 'single-bed':
    housing();if(item.kind==='bed'){rect(-40,-38,36,21);rect(4,-38,36,21);}else rect(-36,-38,72,21);
    line(-edge,-9,edge,-9);break;
   case 'wardrobe-single':case 'tall-cabinet':wardrobe();break;
   case 'wardrobe':wardrobe(2);break;
   case 'wardrobe-triple':wardrobe(3);break;
   case 'shelf':housing();line(-25,-edge,-25,edge);line(0,-edge,0,edge);line(25,-edge,25,edge);break;
   case 'table':housing();break;
   case 'round-table':g.beginPath();g.ellipse(0,0,50,50,0,0,Math.PI*2);g.fill();g.stroke();break;
   case 'dining-set':{
    // Actual default dimensions: 180 x 90 table, six 50 x 50 chairs, 270 x 180 overall.
    const x=100/270,y=100/180;
    for(const cx of [-50,50]){chair(cx*x,-65*y,50*x,50*y);chair(cx*x,65*y,50*x,50*y,'bottom');}
    chair(-110*x,0,50*x,50*y,'left');chair(110*x,0,50*x,50*y,'right');
    rect(-90*x,-45*y,180*x,90*y);break;
   }
   case 'round-dining-set':{
    // A 110 cm tabletop and four 50 cm chairs, with a 210 cm total footprint.
    const k=100/210;chair(0,-80*k,50*k,50*k);chair(0,80*k,50*k,50*k,'bottom');chair(-80*k,0,50*k,50*k,'left');chair(80*k,0,50*k,50*k,'right');
    g.beginPath();g.ellipse(0,0,55*k,55*k,0,0,Math.PI*2);g.fill();g.stroke();break;
   }
   case 'chair':chair(0,0,2*edge,2*edge);break;
   case 'desk':housing();rect(-42,-36,24,70);break;
   case 'coffee':housing();break;
   case 'kitchen':housing();for(const x of [-25,0,25])line(x,-edge,x,edge);rect(-20,-28,35,56);break;
   case 'base-cabinet':case 'wall-cabinet':housing();line(0,-edge,0,edge);line(-edge,38,edge,38);break;
   case 'drawer-cabinet':housing();line(-edge,38,edge,38);line(-15,44,15,44);break;
   case 'corner-cabinet':polygon([[-edge,-edge],[edge,-edge],[edge,0],[0,edge],[-edge,edge]]);line(36,-4,-4,36);break;
   case 'sink-cabinet':case 'double-sink-cabinet':
    housing();if(item.kind==='double-sink-cabinet'){rounded(-40,-30,36,57,5);rounded(4,-30,36,57,5);}else rounded(-37,-30,74,57,6);
    line(0,-edge,0,-27);break;
   case 'countertop':housing();break;
   case 'island':housing();line(-edge,34,edge,34);break;
   case 'oven':housing();rect(-37,-35,74,63);line(-edge,38,edge,38);break;
   case 'dishwasher':housing();line(-edge,38,edge,38);line(-14,44,14,44);break;
   case 'fridge':housing();line(-edge,-16,edge,-16);line(38,2,38,26);break;
   case 'cooker':housing();for(const x of [-23,23])for(const y of [-23,23])ellipse(x,y,14,14);break;
   case 'bath':rounded(-edge,-edge,2*edge,2*edge,10);rounded(-38,-38,76,76,20);break;
   case 'shower':housing();line(-edge,-edge,edge,edge);line(-edge,edge,edge,-edge);ellipse(0,0,4,4);break;
   case 'toilet':rect(-35,-edge,70,24);g.beginPath();g.ellipse(0,10,31,37,0,0,Math.PI*2);g.fill();g.stroke();ellipse(0,11,22,27);break;
   case 'sink':rounded(-edge,-edge,2*edge,2*edge,5);ellipse(0,6,35,28);line(0,-edge,0,-20);break;
   case 'washer':housing();line(-edge,-30,edge,-30);ellipse(0,9,30,30);break;
   case 'stairs':
    housing();for(let i=0;i<=10;i++)line(-edge,-45+i*9,edge,-45+i*9);line(0,36,0,-32);line(0,-32,-8,-20);line(0,-32,8,-20);break;
   case 'window':case 'window-tilt':case 'window-sliding':case 'window-sliding-three':{
    // Elementary plan symbols: frame, glazing and only the opening-direction mark.
    rect(-edge,-20,2*edge,40);
    if(item.kind==='window')line(-edge,0,edge,0);
    else if(item.kind==='window-tilt'){line(-edge,16,0,-16);line(0,-16,edge,16);}
    else{
     const n=item.kind==='window-sliding-three'?3:2,w=92/n;
     for(let i=0;i<n;i++){const x=-46+i*w,y=i%2?-6:6;line(x,y,x+w,y);if(i)line(x,-20,x,20);}
     line(-12,33,12,33);line(12,33,7,29);line(12,33,7,37);
    }break;
   }
   case 'door':case 'double-door':case 'window-casement':case 'window-double':{
    const {jamb,leaf,near,far,left,right,radiusX,radiusY,top,double}=door;
    // Jambs span the real wall thickness; hinges sit exactly on the opening-side face.
    rect(-edge,near,Math.max(.2,jamb-inset),far-near);rect(right,near,Math.max(.2,jamb-inset),far-near);
    for(const [hinge,side] of double?[[left,1],[right,-1]]:[[left,1]]){
     // Classic plan symbol: one open sash/leaf and a quarter-circle swing.
     line(hinge,near,hinge,top);
     g.save();g.lineWidth*=.75;g.beginPath();g.ellipse(hinge,near,radiusX,radiusY,0,side===1?-Math.PI/2:Math.PI,side===1?0:Math.PI*1.5);g.stroke();g.restore();
    }
    break;
   }
  }
  g.restore();
 }
 return {catalog,definition,isWindow,isOpening,isSwingOpening,create,validate,bounds,selectionBounds,hit,groupPath,inGroup,groupAt,expandedSelection,move,moveOnGrid,resizeFromHandle,resize,rotate,mirror,duplicate,group,ungroup,attach,createTemplate,validateTemplates,instantiate,followWallOpenings,snapToWalls,doorWallProfile,doorGeometry,draw};
})();
