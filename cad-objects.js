'use strict';
globalThis.CadObjects=(()=>{
 const catalog=[
  ['sofa','Namještaj','Dnevni boravak','Kauč',220,90],['armchair','Namještaj','Dnevni boravak','Fotelja',90,90],['coffee','Namještaj','Dnevni boravak','Klub stol',110,60],
  ['sofa-seat','Namještaj','Moduli kauča','Sjedalo s naslonom',80,90],['sofa-corner','Namještaj','Moduli kauča','Kutni modul',90,90],['sofa-chaise','Namještaj','Moduli kauča','Ležaj s naslonom',80,160],['sofa-ottoman','Namještaj','Moduli kauča','Puf / sjedalo',80,60],['sofa-arm','Namještaj','Moduli kauča','Rukonaslon',20,90],['sofa-back','Namještaj','Moduli kauča','Naslon',80,20],
  ['shape-rectangle','Geometrija','Osnovni oblici','Pravokutnik',100,60],['shape-square','Geometrija','Osnovni oblici','Kvadrat',100,100],['shape-ellipse','Geometrija','Osnovni oblici','Elipsa',100,60],['shape-circle','Geometrija','Osnovni oblici','Krug',100,100],['shape-triangle','Geometrija','Osnovni oblici','Trokut',100,100],['shape-l','Geometrija','Osnovni oblici','L-oblik',100,100],
  ['bed','Namještaj','Spavaća soba','Bračni krevet',180,210],['single-bed','Namještaj','Spavaća soba','Jednostruki krevet',100,210],['wardrobe','Namještaj','Spavaća soba','Ormar',180,60],
  ['table','Namještaj','Blagovaonica','Blagovaonski stol',180,100],['round-table','Namještaj','Blagovaonica','Okrugli stol',110,110],['chair','Namještaj','Blagovaonica','Stolica',50,50],
  ['desk','Namještaj','Radna soba','Radni stol',140,70],['shelf','Namještaj','Radna soba','Polica',120,35],
  ['base-cabinet','Kuhinja','Donji elementi','Donji element',60,60],['drawer-cabinet','Kuhinja','Donji elementi','Ladičar',60,60],['corner-cabinet','Kuhinja','Donji elementi','Kutni element',90,90],['sink-cabinet','Kuhinja','Donji elementi','Element sa sudoperom',80,60],['island','Kuhinja','Donji elementi','Kuhinjski otok',160,90],['wall-cabinet','Kuhinja','Gornji elementi','Gornji element',60,35],['tall-cabinet','Kuhinja','Visoki elementi','Visoki ormar',60,60],['oven','Kuhinja','Uređaji','Pećnica',60,60],['dishwasher','Kuhinja','Uređaji','Perilica posuđa',60,60],['kitchen','Kuhinja','Elementi','Kuhinjski niz',240,60],['fridge','Kuhinja','Uređaji','Hladnjak',60,65],['cooker','Kuhinja','Uređaji','Štednjak',60,60],
  ['countertop','Kuhinja','Radne ploče','Radna ploča',120,60],['double-sink-cabinet','Kuhinja','Donji elementi','Dvostruki sudoper',120,60],
  ['bath','Kupaonica','Sanitarije','Kada',170,75],['shower','Kupaonica','Sanitarije','Tuš',90,90],['toilet','Kupaonica','Sanitarije','WC',40,70],['sink','Kupaonica','Sanitarije','Umivaonik',60,50],['washer','Kupaonica','Uređaji','Perilica',60,60],
  ['door','Otvori','Vrata','Jednokrilna vrata',90,90],['double-door','Otvori','Vrata','Dvokrilna vrata',160,80],['window','Otvori','Prozori','Prozor',120,20],['stairs','Konstrukcija','Stepenice','Ravne stepenice',100,300]
 ].map(([kind,category,subcategory,name,width,depth])=>({kind,category,subcategory,name,width,depth,hidden:kind==='kitchen'}));
 const definition=kind=>catalog.find(item=>item.kind===kind);
 let serial=0;const id=()=> 'o-'+Date.now().toString(36)+'-'+(++serial).toString(36);
 const clone=items=>items.map(item=>({...item}));
 const rotation=angle=>((angle%360)+360)%360;
 function bounds(item){
  const angle=rotation(item.rotation)*Math.PI/180,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle)),opening=['door','double-door'].includes(item.kind);
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
  if(!Array.isArray(input)||input.length>2000)throw new Error('Neispravan popis elemenata.');const seen=new Set();
  return input.map(item=>{
   if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||seen.has(item.id)||!definition(item.kind)||
    !['x','y','width','depth','rotation'].every(k=>Number.isFinite(item[k]))||item.width<5||item.depth<5||item.width>2000||item.depth>2000||item.rotation%90!==0||
    (item.mirrored!==undefined&&typeof item.mirrored!=='boolean')||
    (item.group!=null&&(typeof item.group!=='string'||item.group.length>100)))throw new Error('Neispravan element u JSON-u.');
   seen.add(item.id);const result={id:item.id,kind:item.kind,x:item.x,y:item.y,width:item.width,depth:item.depth,rotation:rotation(item.rotation),group:item.group??null};
   if(item.mirrored)result.mirrored=true;
   const b=bounds(result);if(b.left<-.001||b.top<-.001||b.right>2000.001||b.bottom>2000.001)throw new Error('Element je izvan tlocrta.');return result;
  });
 }
 function hit(items,x,y){return [...items].reverse().find(item=>{const b=bounds(item);return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;})||null;}
 function expandedSelection(items,ids){const selected=new Set(ids),groups=new Set(items.filter(item=>selected.has(item.id)&&item.group).map(item=>item.group));return items.filter(item=>selected.has(item.id)||groups.has(item.group)).map(item=>item.id);}
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
 function resizeFromHandle(items,id,axis,delta,unit=5){
  const item=items.find(item=>item.id===id);if(!item||!['width','depth'].includes(axis)||!Number.isFinite(delta))return clone(items);
  const opening=['door','double-door'].includes(item.kind),direction=axis==='depth'&&opening?-1:1;
  const size=Math.max(5,Math.min(2000,Math.round((item[axis]+delta*direction)/unit)*unit)),change=size-item[axis];
  const dx=axis==='width'?change/2*(item.mirrored?-1:1):0,dy=axis==='depth'&&!opening?change/2:0,angle=item.rotation*Math.PI/180;
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
 // Reflect across the horizontal axis of the selection, including each CAD symbol.
 function mirror(items,ids){
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id));if(!group.length)return clone(items);
  const center=group.length===1?group[0]:selectionBounds(group);
  return items.map(item=>{
   if(!selected.has(item.id))return {...item};
   const reflected={...item,y:2*center.y-item.y,rotation:rotation(180-item.rotation)};
   if(item.mirrored)delete reflected.mirrored;else reflected.mirrored=true;
   return reflected;
  });
 }
 function duplicate(items,ids){
  const selected=new Set(ids),groups=new Map(),copies=items.filter(item=>selected.has(item.id)).map(item=>{
   if(item.group&&!groups.has(item.group))groups.set(item.group,id());return {...item,id:id(),x:item.x+40,y:item.y+40,group:item.group?groups.get(item.group):null};
  });const fitted=constrain(copies);return {items:[...clone(items),...fitted],ids:fitted.map(item=>item.id)};
 }
 function group(items,ids){const selected=new Set(ids),key=id();return items.map(item=>selected.has(item.id)?{...item,group:key}:{...item});}
 function ungroup(items,ids){const groups=new Set(items.filter(item=>ids.includes(item.id)).map(item=>item.group));return items.map(item=>groups.has(item.group)&&item.group?{...item,group:null}:{...item});}
 function attach(item,walls){
  if(!['door','double-door','window'].includes(item.kind))return item;
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
   if(!['door','double-door','window'].includes(item.kind))return {...item};
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
  if(group.length===1&&['door','double-door','window'].includes(group[0].kind))return items.map(item=>selected.has(item.id)?attach(item,walls):{...item});
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
 function draw(g,item,scale,ox,oy,selected=false,wallThickness=0,erase=false){
  const fx=item.width*scale/100,fy=item.depth*scale/100;
  g.save();g.translate(ox+item.x*scale,oy+item.y*scale);g.rotate(item.rotation*Math.PI/180);g.scale(item.mirrored?-fx:fx,fy);
  g.lineWidth=1.2/Math.max(.1,Math.min(fx,fy));g.strokeStyle=erase?'#dc2626':selected?'#2563eb':'#475569';g.fillStyle=erase?'#fee2e2':selected?'#dbeafe':'#f8fafc';
  const rect=(x,y,w,h)=>{g.beginPath();g.rect(x,y,w,h);g.fill();g.stroke();},line=(x,y,a,b)=>{g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.stroke();},ellipse=(x,y,rx,ry)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.stroke();};
  const opening=['door','double-door','window'].includes(item.kind);
  // Include the entire ink stroke in the declared footprint, at every zoom.
  g.beginPath();g.rect(-50,['door','double-door'].includes(item.kind)?-100:-50,100,100);g.clip();
  if(opening){if(wallThickness){g.fillStyle='#fff';g.fillRect(-50,-wallThickness/item.depth*50,100,wallThickness/item.depth*100);g.fillStyle=erase?'#fee2e2':selected?'#dbeafe':'#f8fafc';}}
  else if(!item.kind.startsWith('shape-')&&item.kind!=='corner-cabinet'){const inset=Math.min(49,g.lineWidth/2);rect(-50+inset,-50+inset,100-2*inset,100-2*inset);}
  const inset=Math.min(49,g.lineWidth/2),edge=50-inset;
  const polygon=points=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke();};
  switch(item.kind){
   case 'shape-rectangle':case 'shape-square':rect(-edge,-edge,2*edge,2*edge);break;
   case 'shape-circle':case 'shape-ellipse':g.beginPath();g.ellipse(0,0,edge,edge,0,0,Math.PI*2);g.fill();g.stroke();break;
   case 'shape-triangle':polygon([[0,-edge],[edge,edge],[-edge,edge]]);break;
   case 'shape-l':polygon([[-edge,-edge],[0,-edge],[0,0],[edge,0],[edge,edge],[-edge,edge]]);break;
   case 'sofa-seat':case 'sofa-chaise':rect(-45,-46,90,19);rect(-44,-22,88,67);break;
   case 'sofa-corner':rect(-46,-46,92,19);rect(-46,-27,19,73);rect(-22,-22,67,67);break;
   case 'sofa-ottoman':rect(-43,-40,86,80);break;
   case 'sofa-arm':case 'sofa-back':rect(-40,-40,80,80);break;
   case 'sofa':case 'armchair':rect(-49,-48,14,96);rect(35,-48,14,96);rect(-35,-48,70,20);for(let i=0,n=item.kind==='sofa'?3:1;i<n;i++)rect(-35+i*70/n,-25,70/n,72);break;
   case 'bed':case 'single-bed':rect(-48,-48,96,15);rect(-45,-27,90,74);rect(-42,-25,item.kind==='bed'?39:84,20);if(item.kind==='bed')rect(3,-25,39,20);break;
   case 'wardrobe':case 'shelf':for(let i=1;i<4;i++)line(-50+i*25,-50,-50+i*25,50);if(item.kind==='wardrobe'){line(-48,48,48,-48);line(-48,-48,48,48);}break;
   case 'table':rect(-35,-30,70,60);for(const x of [-22,7]){rect(x,-48,15,15);rect(x,33,15,15);}rect(-49,-12,12,24);rect(37,-12,12,24);break;
   case 'round-table':ellipse(0,0,40,40);break;
   case 'chair':rect(-42,-42,84,17);rect(-35,-20,70,65);break;
   case 'desk':line(-50,-20,50,-20);rect(-45,-15,25,60);break;
   case 'coffee':rect(-42,-40,84,80);break;
   case 'kitchen':for(let i=1;i<4;i++)line(-50+i*25,-50,-50+i*25,50);ellipse(-12,0,9,27);break;
   // Plan symbols: worktops, front edges, basins and appliance footprints.
   case 'base-cabinet':line(-edge,40,edge,40);line(0,40,0,edge);line(-27,44,-9,44);line(9,44,27,44);break;
   case 'drawer-cabinet':line(-edge,39,edge,39);line(-22,44,22,44);break;
   case 'wall-cabinet':g.setLineDash([7,5]);line(-42,-42,42,42);line(-42,42,42,-42);g.setLineDash([]);line(-edge,40,edge,40);break;
   case 'tall-cabinet':line(-42,-42,42,42);line(-42,42,42,-42);line(-edge,40,edge,40);break;
   case 'corner-cabinet':polygon([[-edge,-edge],[edge,-edge],[edge,0],[0,edge],[-edge,edge]]);line(36,-4,-4,36);line(22,14,14,22);break;
   case 'sink-cabinet':case 'double-sink-cabinet':
    rect(-44,-35,88,69);g.beginPath();g.roundRect(-40,-29,item.kind==='sink-cabinet'?47:37,56,8);g.stroke();ellipse(-17,0,3,4);
    if(item.kind==='double-sink-cabinet'){g.beginPath();g.roundRect(3,-29,37,56,8);g.stroke();ellipse(22,0,3,4);}
    else for(const x of [15,21,27,33,39])line(x,-25,x,23);
    line(-5,-35,-5,-44);line(-5,-44,5,-44);line(5,-44,5,-32);line(-edge,40,edge,40);break;
   case 'countertop':rect(-44,-43,88,86);break;
   case 'island':rect(-44,-43,88,86);line(-edge,35,edge,35);line(-edge,-35,edge,-35);break;
   case 'oven':g.setLineDash([6,4]);rect(-40,-38,80,70);g.setLineDash([]);line(-edge,39,edge,39);line(-24,44,24,44);break;
   case 'dishwasher':g.setLineDash([6,4]);rect(-40,-38,80,70);g.setLineDash([]);ellipse(0,-4,25,25);line(-edge,39,edge,39);line(-16,44,16,44);break;
   case 'fridge':rect(-41,-40,82,76);line(-41,-14,41,-14);line(-edge,41,edge,41);line(27,43,39,43);break;
   case 'cooker':rect(-43,-43,86,80);for(const x of [-22,22])for(const y of [-23,17]){ellipse(x,y,14,14);ellipse(x,y,6,6);}for(const x of [-18,-6,6,18])ellipse(x,43,2,2);break;
   case 'bath':g.beginPath();g.roundRect(-42,-42,84,84,22);g.stroke();ellipse(0,-25,4,4);break;
   case 'shower':line(-45,-45,45,45);line(-45,45,45,-45);ellipse(0,0,5,5);break;
   case 'toilet':rect(-40,-48,80,24);ellipse(0,10,32,35);ellipse(0,10,22,25);break;
   case 'sink':ellipse(0,3,39,30);ellipse(0,-30,5,5);break;
   case 'washer':ellipse(0,7,34,34);line(-50,-32,50,-32);break;
   case 'stairs':for(let i=0;i<=10;i++)line(-48,-48+i*9.6,48,-48+i*9.6);line(0,40,0,-35);line(0,-35,-10,-20);line(0,-35,10,-20);break;
   case 'window':rect(-50,-25,100,50);line(-50,0,50,0);break;
   case 'door':case 'double-door':{
    const jamb=Math.min(8,300/item.width),leaf=Math.min(7,400/item.width),base=-3;
    const left=-50+jamb+leaf/2,right=50-jamb-leaf/2,double=item.kind==='double-door',height=Math.min(93,(right-left)/(double?2:1)*item.width/item.depth),top=base-height,leverY=base-height*.68;
    // Rebated jambs, an open leaf with thickness, hinges, lever handles and swing arcs.
    rect(-edge,-14,jamb,14-inset);rect(edge-jamb,-14,jamb,14-inset);
    line(-50+jamb,-14,-50+jamb+3,-14);line(50-jamb-3,-14,50-jamb,-14);
    g.save();g.lineWidth*=.6;g.setLineDash([4,3]);line(left,base,right,base);g.restore();
    for(const [hinge,side] of double?[[left,1],[right,-1]]:[[left,1]]){
     rect(hinge-leaf/2,top,leaf,height);ellipse(hinge,base,1.6,1.6);
     line(hinge+side*leaf/2,leverY,hinge+side*(leaf/2+7),leverY);line(hinge+side*(leaf/2+7),leverY,hinge+side*(leaf/2+7),leverY+4);
     g.save();g.lineWidth*=.65;g.beginPath();g.ellipse(hinge,base,(right-left)/(double?2:1),height,0,side===1?-Math.PI/2:Math.PI,side===1?0:Math.PI*1.5);g.stroke();g.restore();
    }
    break;
   }
  }
  g.restore();
 }
 return {catalog,definition,create,validate,bounds,selectionBounds,hit,expandedSelection,move,moveOnGrid,resizeFromHandle,resize,rotate,mirror,duplicate,group,ungroup,attach,createTemplate,validateTemplates,instantiate,followWallOpenings,snapToWalls,draw};
})();
