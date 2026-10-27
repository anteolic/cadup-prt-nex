'use strict';
globalThis.CadObjects=(()=>{
 const catalog=[
  ['sofa','Namještaj','Dnevni boravak','Kauč',220,90],['armchair','Namještaj','Dnevni boravak','Fotelja',90,90],['coffee','Namještaj','Dnevni boravak','Klub stol',110,60],
  ['bed','Namještaj','Spavaća soba','Bračni krevet',180,210],['single-bed','Namještaj','Spavaća soba','Jednostruki krevet',100,210],['wardrobe','Namještaj','Spavaća soba','Ormar',180,60],
  ['table','Namještaj','Blagovaonica','Blagovaonski stol',180,100],['round-table','Namještaj','Blagovaonica','Okrugli stol',110,110],['chair','Namještaj','Blagovaonica','Stolica',50,50],
  ['desk','Namještaj','Radna soba','Radni stol',140,70],['shelf','Namještaj','Radna soba','Polica',120,35],
  ['kitchen','Kuhinja','Elementi','Kuhinjski niz',240,60],['fridge','Kuhinja','Uređaji','Hladnjak',60,65],['cooker','Kuhinja','Uređaji','Štednjak',60,60],
  ['bath','Kupaonica','Sanitarije','Kada',170,75],['shower','Kupaonica','Sanitarije','Tuš',90,90],['toilet','Kupaonica','Sanitarije','WC',40,70],['sink','Kupaonica','Sanitarije','Umivaonik',60,50],['washer','Kupaonica','Uređaji','Perilica',60,60],
  ['door','Otvori','Vrata','Jednokrilna vrata',90,90],['double-door','Otvori','Vrata','Dvokrilna vrata',160,80],['window','Otvori','Prozori','Prozor',120,20],['stairs','Konstrukcija','Stepenice','Ravne stepenice',100,300]
 ].map(([kind,category,subcategory,name,width,depth])=>({kind,category,subcategory,name,width,depth}));
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
    (item.group!=null&&(typeof item.group!=='string'||item.group.length>100)))throw new Error('Neispravan element u JSON-u.');
   seen.add(item.id);const result={id:item.id,kind:item.kind,x:item.x,y:item.y,width:item.width,depth:item.depth,rotation:rotation(item.rotation),group:item.group??null};
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
 function resize(items,ids,width,depth,angle){
  if(![width,depth].every(n=>Number.isFinite(n)&&n>=5&&n<=2000)||!Number.isFinite(angle)||angle%90!==0)throw new Error('Mjere moraju biti od 5 do 2000 cm, a kut višekratnik 90°.');
  const selected=new Set(ids),group=items.filter(item=>selected.has(item.id));if(!group.length)return clone(items);let resized;
  if(group.length===1)resized=[{...group[0],width,depth,rotation:rotation(angle)}];
  else{const b=selectionBounds(group),sx=width/b.width,sy=depth/b.depth;resized=group.map(item=>{const swap=item.rotation%180!==0;return {...item,x:b.x+(item.x-b.x)*sx,y:b.y+(item.y-b.y)*sy,width:item.width*(swap?sy:sx),depth:item.depth*(swap?sx:sy)};});}
  if(resized.some(item=>item.width<5||item.depth<5))throw new Error('Pojedini element postaje manji od 5 cm.');
  const fitted=constrain(resized),map=new Map(fitted.map(item=>[item.id,item]));return items.map(item=>map.get(item.id)||{...item});
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
 function draw(g,item,scale,ox,oy,selected=false,wallThickness=0){
  const fx=item.width*scale/100,fy=item.depth*scale/100;
  g.save();g.translate(ox+item.x*scale,oy+item.y*scale);g.rotate(item.rotation*Math.PI/180);g.scale(fx,fy);
  g.lineWidth=1.2/Math.max(.1,Math.min(fx,fy));g.strokeStyle=selected?'#2563eb':'#475569';g.fillStyle=selected?'#dbeafe':'#f8fafc';
  const rect=(x,y,w,h)=>{g.beginPath();g.rect(x,y,w,h);g.fill();g.stroke();},line=(x,y,a,b)=>{g.beginPath();g.moveTo(x,y);g.lineTo(a,b);g.stroke();},ellipse=(x,y,rx,ry)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.stroke();};
  const opening=['door','double-door','window'].includes(item.kind);
  if(opening){if(wallThickness){g.fillStyle='#fff';g.fillRect(-50,-wallThickness/item.depth*50,100,wallThickness/item.depth*100);g.fillStyle=selected?'#dbeafe':'#f8fafc';}}
  else rect(-50,-50,100,100);
  switch(item.kind){
   case 'sofa':case 'armchair':rect(-49,-48,14,96);rect(35,-48,14,96);rect(-35,-48,70,20);for(let i=0,n=item.kind==='sofa'?3:1;i<n;i++)rect(-35+i*70/n,-25,70/n,72);break;
   case 'bed':case 'single-bed':rect(-48,-48,96,15);rect(-45,-27,90,74);rect(-42,-25,item.kind==='bed'?39:84,20);if(item.kind==='bed')rect(3,-25,39,20);break;
   case 'wardrobe':case 'shelf':for(let i=1;i<4;i++)line(-50+i*25,-50,-50+i*25,50);if(item.kind==='wardrobe'){line(-48,48,48,-48);line(-48,-48,48,48);}break;
   case 'table':rect(-35,-30,70,60);for(const x of [-22,7]){rect(x,-48,15,15);rect(x,33,15,15);}rect(-49,-12,12,24);rect(37,-12,12,24);break;
   case 'round-table':ellipse(0,0,40,40);break;
   case 'chair':rect(-42,-42,84,17);rect(-35,-20,70,65);break;
   case 'desk':line(-50,-20,50,-20);rect(-45,-15,25,60);break;
   case 'coffee':rect(-42,-40,84,80);break;
   case 'kitchen':for(let i=1;i<4;i++)line(-50+i*25,-50,-50+i*25,50);ellipse(-12,0,9,27);break;
   case 'fridge':line(-50,-12,50,-12);line(30,0,30,30);break;
   case 'cooker':for(const x of [-24,24])for(const y of [-24,24])ellipse(x,y,16,16);break;
   case 'bath':g.beginPath();g.roundRect(-42,-42,84,84,22);g.stroke();ellipse(0,-25,4,4);break;
   case 'shower':line(-45,-45,45,45);line(-45,45,45,-45);ellipse(0,0,5,5);break;
   case 'toilet':rect(-40,-48,80,24);ellipse(0,10,32,35);ellipse(0,10,22,25);break;
   case 'sink':ellipse(0,3,39,30);ellipse(0,-30,5,5);break;
   case 'washer':ellipse(0,7,34,34);line(-50,-32,50,-32);break;
   case 'stairs':for(let i=0;i<=10;i++)line(-48,-48+i*9.6,48,-48+i*9.6);line(0,40,0,-35);line(0,-35,-10,-20);line(0,-35,10,-20);break;
   case 'window':rect(-50,-25,100,50);line(-50,0,50,0);break;
   case 'door':line(-50,0,-50,-95);g.beginPath();g.arc(-50,0,95,-Math.PI/2,0);g.stroke();break;
   case 'double-door':line(-50,0,-50,-90);line(50,0,50,-90);g.beginPath();g.ellipse(-50,0,50,90,0,-Math.PI/2,0);g.stroke();g.beginPath();g.ellipse(50,0,50,90,0,Math.PI,Math.PI*1.5);g.stroke();break;
  }
  if(selected){g.setLineDash([5/Math.max(fx,fy),3/Math.max(fx,fy)]);g.strokeRect(-50,['door','double-door'].includes(item.kind)?-100:-50,100,100);}
  g.restore();
 }
 return {catalog,definition,create,validate,bounds,selectionBounds,hit,expandedSelection,move,resize,duplicate,group,ungroup,attach,draw};
})();
