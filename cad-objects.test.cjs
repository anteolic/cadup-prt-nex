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
 assert.equal(mirrored[0].x,2*box.x-a.x);assert.equal(mirrored[0].rotation,((360-angle)%360));assert.equal(mirrored[0].mirrored,true);
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
