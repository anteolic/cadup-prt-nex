require('./object-sketch.js');
const assert=require('node:assert/strict');require('./cad-objects.js');
const C=CadObjects;
assert.ok(C.catalog.length>=20);for(const kind of ['door','window','stairs','sofa','bed'])assert.ok(C.definition(kind));
const sofa=C.create('sofa',500,500),chair=C.create('chair',800,500);
assert.equal(sofa.width,220);assert.equal(C.hit([sofa],500,500).id,sofa.id);
assert.equal(C.hit([sofa],0,0),null);
assert.deepEqual(C.validate([sofa,chair]),[sofa,chair]);
assert.throws(()=>C.validate([sofa,{...chair,id:sofa.id}]));assert.throws(()=>C.validate([{...sofa,width:-1}]));assert.throws(()=>C.validate([{...sofa,rotation:45}]));
const resized=C.resize([sofa],[sofa.id],300,100,90)[0];assert.equal(resized.width,300);assert.equal(C.bounds(resized).width,100);assert.equal(C.bounds(resized).depth,300);
assert.throws(()=>C.resize([sofa],[sofa.id],0,100,0));
const nearEdge=C.move([sofa,chair],[sofa.id,chair.id],-5000,5000),edgeBox=C.selectionBounds(nearEdge);assert.equal(edgeBox.left,0);assert.equal(edgeBox.bottom,2000);assert.equal(nearEdge[1].x-nearEdge[0].x,chair.x-sofa.x);
const grouped=C.group([sofa,chair],[sofa.id,chair.id]);assert.ok(grouped[0].group);assert.equal(grouped[0].group,grouped[1].group);
assert.deepEqual(C.expandedSelection(grouped,[chair.id]),grouped.map(o=>o.id));
const copies=C.duplicate(grouped,grouped.map(o=>o.id));assert.equal(copies.items.length,4);assert.notEqual(copies.items[2].id,sofa.id);assert.notEqual(copies.items[2].group,grouped[0].group);assert.equal(copies.items[2].group,copies.items[3].group);
assert.ok(C.ungroup(grouped,grouped.map(o=>o.id)).every(o=>o.group===null));
const groupBox=C.selectionBounds(grouped),scaled=C.resize(grouped,grouped.map(o=>o.id),groupBox.width*1.5,groupBox.depth*2,0),scaledBox=C.selectionBounds(scaled);
assert.equal(scaledBox.width,groupBox.width*1.5);assert.equal(scaledBox.depth,groupBox.depth*2);
const door=C.create('door',500,510),attached=C.attach(door,[{x1:100,y1:500,x2:1000,y2:500}]);assert.equal(attached.y,500);assert.equal(attached.rotation,0);assert.equal(C.bounds(attached).top,410);
const window=C.attach(C.create('window',510,500),[{x1:500,y1:100,x2:500,y2:1000}]);assert.equal(window.x,500);assert.equal(window.rotation,90);
assert.deepEqual(C.validate(JSON.parse(JSON.stringify(copies.items))),copies.items,'JSON čuva grupe, dimenzije i rotacije');
console.log('PASS: katalog, dimenzije, rotacija, kopiranje, grupe, pomicanje, otvori i JSON.');
for(const item of C.catalog)for(const [x,y] of [[0,0],[2000,0],[0,2000],[2000,2000]])assert.equal(C.validate([C.create(item.kind,x,y)]).length,1,'Umetanje uz rub daje valjan element');
assert.equal(C.attach({...door,rotation:180},[{x1:100,y1:500,x2:1000,y2:500}]).rotation,180,'Smjer otvaranja vrata ostaje odabran');

const rotated=C.rotate([sofa],[sofa.id]);assert.equal(rotated[0].rotation,90);assert.equal(C.rotate(rotated,[sofa.id])[0].rotation,180);
const groupRotation=C.rotate(grouped,grouped.map(item=>item.id));assert.ok(groupRotation.every(item=>item.rotation===90));
assert.equal(C.selectionBounds(groupRotation).width,C.selectionBounds(grouped).depth);assert.equal(C.selectionBounds(groupRotation).depth,C.selectionBounds(grouped).width);
let fullTurn=[sofa];for(let i=0;i<4;i++)fullTurn=C.rotate(fullTurn,[sofa.id]);assert.deepEqual(fullTurn,[sofa],'Četiri klika vraćaju početni položaj');
for(const kind of ['base-cabinet','drawer-cabinet','corner-cabinet','sink-cabinet','wall-cabinet','tall-cabinet','oven','dishwasher'])assert.ok(C.definition(kind)&&!C.definition(kind).hidden);
assert.equal(C.definition('kitchen').hidden,true,'Stari kuhinjski niz ostaje kompatibilan, ali nije u novoj biblioteci');

const snapRoom=[{x:100,y:100,width:500,height:500}],topWall={x1:100,y1:100,x2:600,y2:100};
const snapSofa={id:'snap-sofa',kind:'sofa',x:300,y:160,width:200,depth:100,rotation:0,group:null};
assert.equal(C.bounds(C.snapToWalls([snapSofa],[snapSofa.id],[topWall],snapRoom)[0]).top,115,'Namještaj se hvata za unutarnju plohu vanjskog zida');
const innerWall={x1:400,y1:100,x2:400,y2:600,thickness:24},leftFurniture={...snapSofa,x:280,y:300};
assert.equal(C.bounds(C.snapToWalls([leftFurniture],[leftFurniture.id],[innerWall],snapRoom)[0]).right,388,'Snap poštuje stvarnu debljinu unutarnjeg zida');
const farFurniture={...snapSofa,y:300};assert.equal(C.snapToWalls([farFurniture],[farFurniture.id],[topWall],snapRoom)[0].y,300,'Udaljeni elementi ne skaču na zid');
const snapGroup=[{...snapSofa,id:'g1',width:100,x:250,y:160,group:'g'},{...snapSofa,id:'g2',width:100,x:400,y:160,group:'g'}];
const snappedGroup=C.snapToWalls(snapGroup,['g1','g2'],[topWall],snapRoom);assert.equal(C.selectionBounds(snappedGroup).top,115);assert.equal(snappedGroup[1].x-snappedGroup[0].x,150);
const template=C.createTemplate(grouped,grouped.map(item=>item.id),'Kutak za čitanje');
assert.equal(template.name,'Kutak za čitanje');assert.equal(template.items.length,2);assert.equal(C.selectionBounds(template.items).width,C.selectionBounds(grouped).width);
assert.deepEqual(C.validateTemplates(JSON.parse(JSON.stringify([template]))),[template]);
const instance=C.instantiate(template,700,700);assert.equal(instance.items.length,2);assert.ok(instance.items[0].group);assert.equal(instance.items[0].group,instance.items[1].group);assert.notEqual(instance.items[0].id,template.items[0].id);
const instance2=C.instantiate(template,20,20);assert.notEqual(instance2.items[0].group,instance.items[0].group);assert.equal(C.validate(instance2.items).length,2);
assert.throws(()=>C.createTemplate(grouped,grouped.map(item=>item.id),' '));assert.throws(()=>C.validateTemplates([{...template,id:'" onclick="alert(1)'}]));

// Mirror reflects positions and asymmetric symbols, persists and reverses exactly.
for(const angle of [0,90,180,270]){
 const a={...C.create('door',500,500),rotation:angle},b={...C.create('desk',800,650),rotation:90};
 const input=[a,b],ids=input.map(o=>o.id),mirrored=C.mirror(input,ids),box=C.selectionBounds(input);
 const nx=Math.round(Math.cos(angle*Math.PI/180)),ny=Math.round(Math.sin(angle*Math.PI/180)),distance=(a.x-box.x)*nx+(a.y-box.y)*ny;assert.equal(mirrored[0].x,a.x-2*distance*nx);assert.equal(mirrored[0].y,a.y-2*distance*ny);assert.equal(mirrored[0].rotation,angle);assert.equal(mirrored[1].rotation,((2*angle-b.rotation+360)%360));assert.equal(mirrored[0].mirrored,true);
 assert.deepEqual(C.selectionBounds(mirrored),box);assert.deepEqual(C.mirror(mirrored,ids),input);
 assert.deepEqual(C.validate(JSON.parse(JSON.stringify(mirrored))),mirrored);
 assert.equal(C.duplicate(mirrored,ids).items[2].mirrored,true);
 assert.equal(C.instantiate(C.createTemplate(mirrored,ids,'Mirror test'),1000,1000).items[0].mirrored,true);
}

// Absolute lower-left anchoring removes half-width and insertion offsets.
for(const rotation of [0,90,180,270])for(const unit of [5,20,50,100]){
 const drawer={...C.create('drawer-cabinet',502.5,501.25),width:65,depth:60,rotation};
 const out=C.moveOnGrid([drawer],[drawer.id],37,43,unit),b=C.bounds(out[0]);
 assert.equal(b.left%unit,0);assert.equal(b.bottom%unit,0);assert.equal(out[0].width,65);assert.equal(out[0].depth,60);
 const originalBox=C.bounds(drawer);assert.equal(b.left,Math.round((originalBox.left+37)/unit)*unit);
 const second={...C.create('chair',700,600),group:'grid-group'},first={...drawer,group:'grid-group'};
 const moved=C.moveOnGrid([first,second],[first.id,second.id],37,43,unit),groupBox=C.selectionBounds(moved);
 assert.equal(groupBox.left%unit,0);assert.equal(groupBox.bottom%unit,0);assert.equal(moved[1].x-moved[0].x,second.x-first.x);assert.equal(moved[1].y-moved[0].y,second.y-first.y);
}

// Width/depth handles keep the opposite edge fixed, also after rotate/mirror.
for(const rotation of [0,90,180,270])for(const mirrored of [false,true])for(const axis of ['width','depth']){
 const item={...C.create('drawer-cabinet',500,500),width:60,depth:80,rotation,mirrored,group:'handle-group'},other=C.create('chair',900,900);
 const result=C.resizeFromHandle([item,other],item.id,axis,20),resized=result[0],angle=rotation*Math.PI/180;
 assert.equal(resized[axis],item[axis]+20);assert.equal(resized.group,item.group);assert.deepEqual(result[1],other);
 const sign=axis==='width'&&mirrored?-1:1,nx=axis==='width'?Math.cos(angle)*sign:-Math.sin(angle),ny=axis==='width'?Math.sin(angle)*sign:Math.cos(angle);
 assert.ok(Math.abs((resized.x*nx+resized.y*ny-resized[axis]/2)-(item.x*nx+item.y*ny-item[axis]/2))<1e-7);
}
const handleDoor=C.create('door',500,500),deepDoor=C.resizeFromHandle([handleDoor],handleDoor.id,'depth',-20)[0];assert.equal(deepDoor.depth,handleDoor.depth+20);assert.equal(deepDoor.x,handleDoor.x);assert.equal(deepDoor.y,handleDoor.y);

// Attached openings follow their supporting wall; furniture and unrelated openings stay put.
{
 const top={x1:100,y1:100,x2:700,y2:100},right={x1:700,y1:100,x2:700,y2:700},bottom={x1:100,y1:700,x2:700,y2:700},left={x1:100,y1:100,x2:100,y2:700},separate={x1:1000,y1:1000,x2:1000,y2:1500};
 const door={...C.create('door',300,100)},window={...C.create('window',700,400),rotation:90},remote={...C.create('window',1000,1200),rotation:90},furniture=C.create('drawer-cabinet',400,400),free={...door,id:'free-opening',y:110};
 const items=[door,window,remote,furniture,free],before=[top,right,bottom,left,separate],movedTop={...top,y1:200,y2:200},movedWalls=[movedTop,{...right,y1:200},bottom,{...left,y1:200},separate];
 const moved=C.followWallOpenings(items,before,movedWalls,{from:top,to:movedTop});assert.equal(moved[0].y,200);assert.equal(moved[0].x,door.x);assert.deepEqual(moved.slice(1),items.slice(1));
 const longerTop={...top,x2:900},longer=[longerTop,{...right,x1:900,x2:900},{...bottom,x2:900},left,separate];
 const lengthened=C.followWallOpenings(items,before,longer,{from:top,to:longerTop,shift:{axis:'x',cut:700,delta:200}});assert.equal(lengthened[1].x,900);assert.equal(lengthened[1].y,window.y);assert.deepEqual(lengthened[2],remote);assert.deepEqual(lengthened[3],furniture);
 const nearEnd={...door,x:600},shortTop={...top,x2:500},short=C.followWallOpenings([nearEnd],before,[shortTop,right,bottom,left,separate],{from:top,to:shortTop});assert.equal(short[0].x,455);assert.equal(short[0].width,90);
 assert.throws(()=>C.followWallOpenings([door],before,[{...top,x2:150}],{from:top,to:{...top,x2:150}}),/prekratak/);
}

// Following a wall at the canvas edge keeps openings valid for save/reload.
{
 const oldWall={x1:100,y1:100,x2:700,y2:100},edgeWall={...oldWall,y1:0,y2:0},door=C.create('door',300,100);
 const followed=C.followWallOpenings([door],[oldWall],[edgeWall],{from:oldWall,to:edgeWall});assert.equal(followed[0].y,0);assert.equal(followed[0].rotation,180);assert.equal(C.validate(followed).length,1);
}

// Mirroring a single item always flips its own width without changing angle or position.
for(const angle of [0,90,180,270]){
 const item={...C.create('desk',700,800),rotation:angle},other=C.create('chair',1000,1000),mirrored=C.mirror([item,other],[item.id]);
 assert.equal(mirrored[0].rotation,angle);assert.equal(mirrored[0].x,item.x);assert.equal(mirrored[0].y,item.y);assert.equal(mirrored[0].width,item.width);assert.equal(mirrored[0].depth,item.depth);assert.equal(mirrored[0].mirrored,true);assert.deepEqual(mirrored[1],other);assert.deepEqual(C.mirror(mirrored,[item.id]),[item,other]);
}

// Nested groups preserve inner membership through grouping, copying and one-level ungrouping.
{
 const original=[C.create('desk',300,400),C.create('chair',500,400),C.create('desk',900,400),C.create('chair',1100,400),C.create('shelf',700,800)],ids=original.map(item=>item.id);
 let scene=C.group(original,ids.slice(0,2)),firstGroup=scene[0].group;
 scene=C.group(scene,ids.slice(2,4));const secondGroup=scene[2].group;
 scene=C.group(scene,ids);const outer=scene[0].group;
 assert.ok(scene.every(item=>item.group===outer));
 assert.deepEqual(scene[0].subgroups,[firstGroup]);assert.deepEqual(scene[2].subgroups,[secondGroup]);assert.equal(scene[4].subgroups,undefined);
 assert.deepEqual(C.expandedSelection(scene,[ids[0]]),ids);
 assert.deepEqual(C.expandedSelection(scene,[ids[0]],outer),ids.slice(0,2));
 assert.deepEqual(C.expandedSelection(scene,[ids[0]],firstGroup),[ids[0]]);
 assert.deepEqual(C.validate(JSON.parse(JSON.stringify(scene))),scene);
 const duplicate=C.duplicate(scene,ids),copies=duplicate.items.slice(5);
 assert.notEqual(copies[0].group,outer);assert.notEqual(copies[0].subgroups[0],firstGroup);assert.equal(copies[0].subgroups[0],copies[1].subgroups[0]);
 assert.deepEqual(C.validate(duplicate.items),duplicate.items);
 const innerCopy=C.duplicate(scene,ids.slice(0,2),outer).items.slice(5);
 assert.equal(innerCopy[0].group,outer);assert.notEqual(innerCopy[0].subgroups[0],firstGroup);
 const restored=C.ungroup(scene,ids);
 assert.equal(restored[0].group,firstGroup);assert.equal(restored[2].group,secondGroup);assert.equal(restored[4].group,null);
 assert.equal(restored[0].subgroups,undefined);
 const opened=C.ungroup(scene,ids.slice(0,2),outer);
 assert.equal(opened[0].group,outer);assert.equal(opened[0].subgroups,undefined);assert.deepEqual(opened[2].subgroups,[secondGroup]);
 const resized=C.resize(scene,ids,1000,700,0);assert.deepEqual(resized[0].subgroups,[firstGroup]);
 const transformed=C.mirror(C.rotate(scene,ids),ids);assert.deepEqual(transformed[2].subgroups,[secondGroup]);
 const template=C.createTemplate(scene,ids,'Nested');const placed=C.instantiate(template,1000,1000).items;
 assert.ok(placed[0].subgroups);assert.equal(placed[0].subgroups[0],placed[1].subgroups[0]);
 assert.throws(()=>C.validate([{...scene[0],subgroups:[outer]}]));
 assert.throws(()=>C.validate([{...scene[0],subgroups:['shared']},{...scene[2],group:'other-root',subgroups:['shared']}]));
}

// Door hardware follows actual wall faces, including asymmetric exterior walls.
for(const angle of [0,90,180,270])for(const mirrored of [false,true])for(const kind of ['door','double-door']){
 const item={...C.create(kind,600,700),rotation:angle,mirrored},r=angle*Math.PI/180,c=Math.round(Math.cos(r)),sn=Math.round(Math.sin(r));
 for(const [near,far] of [[-5,5],[-30,0],[0,30],[-22,8]]){
  const corners=[[-item.width/2,near],[item.width/2,near],[-item.width/2,far],[item.width/2,far]].map(([x,y])=>({x:item.x+x*c-y*sn,y:item.y+x*sn+y*c}));
  const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
  const profile=C.doorWallProfile(item,[{x:left,y:top,width:right-left,height:bottom-top}]);assert.deepEqual(profile,{min:near,max:far});
  const geometry=C.doorGeometry(item,profile);assert.ok(Math.abs(geometry.near*item.depth/100-near)<1e-8);assert.ok(Math.abs((geometry.far-geometry.near)*item.depth/100-(far-near))<1e-8);
  const rects=[],ellipses=[],scales=[];
  const g=new Proxy({rect(...args){rects.push(args);},ellipse(...args){ellipses.push(args);},scale(...args){scales.push(args);}},{get:(obj,key)=>key in obj?obj[key]:(()=>{})});
  C.draw(g,item,1,0,0,false,0,false,false,profile);
  const jambs=rects.slice(1,3);assert.ok(jambs.every(rect=>rect[1]===geometry.near&&rect[3]===geometry.far-geometry.near));
  const arcs=ellipses.filter(args=>args[2]===geometry.radiusX);
  assert.equal(arcs.length,kind==='double-door'?2:1);assert.ok(arcs.every(arc=>arc[1]===geometry.near));
  assert.equal(scales[0][0]<0,mirrored);
 }
}

// Library symbols have a fixed normalized drawing, independent of zoom and resize.
{
 const geometry=(item,scale)=>{
  const commands=[],g=new Proxy({}, {get:(obj,key)=>{if(key in obj)return obj[key];if(['rect','roundRect','ellipse','arc','moveTo','lineTo','closePath'].includes(key))return (...args)=>commands.push([key,...args]);return ()=>{};},set:(obj,key,value)=>{obj[key]=value;return true;}});
  C.draw(g,item,scale,0,0);return commands;
 };
 for(const definition of C.catalog){
  const item=C.create(definition.kind,1000,1000),original=geometry(item,1);
  assert.deepEqual(geometry(item,.15),original,definition.kind+' zoom out');
  assert.deepEqual(geometry(item,5),original,definition.kind+' zoom in');
  assert.deepEqual(geometry({...item,width:item.width*1.4,depth:item.depth*.6},1),original,definition.kind+' resize');
 }
}

// Every window type attaches and follows its supporting wall like existing openings.
for(const kind of ['window','window-casement','window-double','window-tilt','window-sliding','window-sliding-three']){
 assert.ok(C.definition(kind));assert.equal(C.isWindow(kind),true);
 const wall={x1:100,y1:500,x2:1400,y2:500},item=C.create(kind,600,510),attached=C.snapToWalls([item],[item.id],[wall])[0];
 assert.equal(attached.y,500);assert.equal(attached.rotation,0);
 const movedWall={...wall,y1:550,y2:550},moved=C.followWallOpenings([attached],[wall],[movedWall],{from:wall,to:movedWall})[0];
 assert.equal(moved.y,550);assert.equal(moved.kind,kind);assert.deepEqual(C.validate([moved]),[moved]);
}

// Independent tables have no chairs; arrangements declare their complete footprint.
assert.equal(C.definition('table').width,180);assert.equal(C.definition('table').depth,90);
{
 const capture=kind=>{const rects=[],ellipses=[],g=new Proxy({rect(...args){rects.push(args);},ellipse(...args){ellipses.push(args);}},{get:(obj,key)=>obj[key]||(()=>{})});const item=C.create(kind,1000,1000);C.draw(g,item,1,0,0);return {item,rects,ellipses};};
 assert.equal(capture('table').rects.length,2);assert.equal(capture('round-table').ellipses.length,1);
 const set=capture('dining-set'),top=set.rects.at(-1);
 assert.ok(Math.abs(top[2]*set.item.width/100-180)<1e-8);assert.ok(Math.abs(top[3]*set.item.depth/100-90)<1e-8);
 assert.equal(set.rects.length,8);
 const round=capture('round-dining-set');assert.equal(round.rects.length,5);assert.ok(Math.abs(round.ellipses[0][2]*2*round.item.width/100-110)<1e-8);
}
