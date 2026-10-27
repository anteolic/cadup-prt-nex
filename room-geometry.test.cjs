const assert=require('node:assert/strict');
require('./room-geometry.js');
const {shell,connected}=globalThis.RoomGeometry;
const a={id:1,x:100,y:100,width:400,height:200};
const b={id:2,x:100,y:300,width:200,height:200};
const area=boxes=>boxes.reduce((sum,r)=>sum+r.width*r.height,0);
assert.equal(area(shell([a],30)),(400+60)*(200+60)-400*200);
assert.equal(area(shell([a,b],30)),51600);
assert.equal(connected([a,b,{id:3,x:900,y:900,width:50,height:50}],1).length,2);
assert.equal(area(shell([a,a],30)),area(shell([a],30)));
for(const rooms of [[a],[a,b],[a,{...b,y:250}]]){
 const boxes=shell(rooms,30);
 for(const box of boxes)for(const room of rooms){
  const overlapX=Math.min(box.x+box.width,room.x+room.width)-Math.max(box.x,room.x);
  const overlapY=Math.min(box.y+box.height,room.y+room.height)-Math.max(box.y,room.y);
  assert.ok(overlapX<=0||overlapY<=0,'Zid ne smije zauzeti unutarnji prostor');
 }
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const p=boxes[i],q=boxes[j];
  assert.ok(Math.min(p.x+p.width,q.x+q.width)<=Math.max(p.x,q.x)||Math.min(p.y+p.height,q.y+q.height)<=Math.max(p.y,q.y));
 }
}
assert.throws(()=>shell([a],0));
const lShape=RoomGeometry.union([a,b]);
assert.equal(lShape.area,120000);
assert.equal(lShape.edges.length,6);
assert.equal(RoomGeometry.union([a,a]).area,80000);
const rectangle=RoomGeometry.union([a,{...a,id:2,x:500}]);
assert.equal(rectangle.area,160000);
assert.equal(rectangle.edges.length,4,'Zajednički brid i kolinearni kutovi se uklanjaju');
assert.equal(RoomGeometry.union([a,{...a,id:2,x:300}]).area,120000);
assert.equal(RoomGeometry.union([]).area,0);
const cut={x:200,y:150,width:100,height:100};
const cutResult=RoomGeometry.subtract([a],cut);
assert.equal(RoomGeometry.union(cutResult).area,70000);
assert.equal(RoomGeometry.union(cutResult).edges.length,8,'Unutarnji izrez ima vlastiti obris');
assert.equal(RoomGeometry.subtract([a],{x:0,y:0,width:1000,height:1000}).length,0);
assert.equal(RoomGeometry.union(RoomGeometry.subtract([a],{x:500,y:100,width:100,height:100})).area,80000);
assert.equal(RoomGeometry.union(RoomGeometry.subtract([a,a],cut)).area,70000,'Brisanje djeluje na sve preklopljene dijelove');
assert.equal(RoomGeometry.connected(RoomGeometry.subtract([a],{x:250,y:0,width:50,height:1000}).map((r,id)=>({...r,id})),0).length,1,'Rez može razdvojiti prostor');
const plan=RoomGeometry.layout([a,{...a,id:2,x:500}]);
assert.equal(plan.inner.length,1);
assert.equal(plan.inner[0].width,10);
assert.equal(plan.inner[0].x,495);
assert.equal(plan.net[0].width,395);
assert.equal(plan.net[0].area,395*200);
assert.equal(plan.area,790*200);
assert.equal(Math.min(...plan.outer.map(r=>r.x)),70,'Vanjski zid 30 cm');
const movedPlan=RoomGeometry.layout([a,{...a,id:2,x:600}]);
assert.equal(movedPlan.inner.length,0,'Unutarnji zidovi automatski prate raspored');
const halves=RoomGeometry.split([a],a.id,'v',300);
assert.equal(RoomGeometry.union(halves.low).area,40000);
assert.equal(RoomGeometry.union(halves.high).area,40000);
assert.equal(RoomGeometry.split([a],a.id,'h',100),null,'Rez na vanjskom rubu ne stvara prostoriju');
const cutRooms=[...halves.low.map((r,i)=>({...r,id:10+i,roomKey:1})),...halves.high.map((r,i)=>({...r,id:20+i,roomKey:2}))];
assert.equal(RoomGeometry.layout(cutRooms).inner.length,1);
const joined=cutRooms.map(r=>({...r,roomKey:1}));
assert.equal(RoomGeometry.groups(joined).length,1);
assert.equal(RoomGeometry.layout(joined).inner.length,0,'Brisanjem pregrade nestaje unutarnji zid');
assert.equal(RoomGeometry.layout(joined).area,80000,'Vraćena površina nakon uklanjanja pregrade');
assert.equal(RoomGeometry.union(joined).edges.length,4);
assert.ok(RoomGeometry.split(joined,1,'h',200),'Ponovni rez spojene prostorije');
console.log('PASS: pravokutnik, L prostor, povezivanje, preklapanje, zidovi isključivo izvana.');

// L spojevi svih usmjerenja moraju popuniti cijeli kvadrat na kutu.
for(const dx of [-100,100])for(const dy of [-100,100]){
 const walls=[{x1:Math.min(200,200+dx),y1:200,x2:Math.max(200,200+dx),y2:200},
  {x1:200,y1:Math.min(200,200+dy),x2:200,y2:Math.max(200,200+dy)}];
 const layout=RoomGeometry.layout([],walls);
 for(const x of [196,204])for(const y of [196,204])assert.ok(layout.inner.some(r=>x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height),'Spoj nema praznu četvrtinu');
 assert.equal(RoomGeometry.union(layout.inner).area,2000,'Kut čini jednu spojenu masu zida');
}
const doorWalls=[{x1:100,y1:100,x2:200,y2:100},{x1:200,y1:120,x2:200,y2:200}];
const doorLayout=RoomGeometry.layout([],doorWalls);
assert.ok(!doorLayout.inner.some(r=>200>r.x&&200<r.x+r.width&&110>r.y&&110<r.y+r.height),'Blizina kuta ne zatvara otvor za vrata');

const outlineWalls=[{x1:100,y1:100,x2:500,y2:100,thickness:50},{x1:500,y1:100,x2:500,y2:300},{x1:100,y1:300,x2:500,y2:300},{x1:100,y1:100,x2:100,y2:300}];
const variableOuter=RoomGeometry.layout([a],outlineWalls);
assert.equal(Math.min(...variableOuter.outer.map(r=>r.y)),75,'Odabrani vanjski zid ima debljinu 50 cm');
assert.equal(Math.max(...variableOuter.outer.map(r=>r.y+r.height)),315,'Suprotni zid ostaje 30 cm');
assert.ok(variableOuter.outer.some(r=>r.y===75&&r.height===50),'Osnovna linija y=100 je u sredini zida');
const thickCorner=RoomGeometry.layout([],[{x1:100,y1:200,x2:200,y2:200,thickness:20},{x1:200,y1:200,x2:200,y2:300,thickness:40}]);
assert.ok(thickCorner.inner.some(r=>r.x===180&&r.y===190&&r.width===40&&r.height===20),'Kut spaja različite debljine bez rupe');

// Odabir gumicom ispunjava stvarnu debljinu i vanjski pomak zida.
const selectionPlan=RoomGeometry.layout([a],outlineWalls);
const topSelection=RoomGeometry.wallSelection([a],outlineWalls,outlineWalls[0],selectionPlan);
assert.equal(Math.min(...topSelection.map(r=>r.y)),75);
assert.equal(Math.max(...topSelection.map(r=>r.y+r.height)),125);
assert.equal(Math.min(...topSelection.map(r=>r.x)),85,'Odabir uključuje i vanjski kut');
const standalone=[{x1:100,y1:200,x2:400,y2:200,thickness:24}];
const standaloneLayout=RoomGeometry.layout([],standalone);
assert.deepEqual(RoomGeometry.wallSelection([],standalone,standalone[0],standaloneLayout),[{x:100,y:188,width:300,height:24}]);
const adjacent=[{x1:100,y1:200,x2:200,y2:200,thickness:20},{x1:200,y1:200,x2:400,y2:200,thickness:30}];
const selectedFirst=RoomGeometry.wallSelection([],adjacent,adjacent[0],RoomGeometry.layout([],adjacent));
assert.ok(selectedFirst.every(r=>r.x+r.width<=200),'Odabir ne boji susjedni kolinearni segment');
// Kutovi se dopunjuju samo na točnom dodiru osnovnih linija, ne prema debljini ili blizini.
const axisHorizontal={x1:100,y1:100,x2:200,y2:100,thickness:20},axisVertical={x1:200,y1:100,x2:200,y2:200,thickness:20};
const exactCorner=RoomGeometry.layout([],[axisHorizontal,axisVertical]);assert.equal(exactCorner.physicalJoints.length,1);
assert.ok([...exactCorner.outer,...exactCorner.inner].some(r=>205>r.x&&205<r.x+r.width&&95>r.y&&95<r.y+r.height));
const nearCorner=RoomGeometry.layout([],[axisHorizontal,{...axisVertical,x1:201,x2:201}]);assert.equal(nearCorner.physicalJoints.length,0);
assert.ok(![...nearCorner.outer,...nearCorner.inner].some(r=>206>r.x&&206<r.x+r.width&&95>r.y&&95<r.y+r.height),'Nema umjetnog dopunjavanja preko 1 cm razmaka');
const shortOfAxis=RoomGeometry.layout([],[axisHorizontal,{...axisVertical,y1:101}]);assert.equal(shortOfAxis.physicalJoints.length,0);
const parallelGap=RoomGeometry.layout([],[axisHorizontal,{x1:201,y1:100,x2:300,y2:100,thickness:20}]);
assert.ok(!parallelGap.inner.some(r=>r.x<200.5&&r.x+r.width>200.5),'Razmak između kolinearnih osnovnih linija ostaje otvoren');
assert.equal(RoomGeometry.layout([],[axisHorizontal]).inner[0].y,90);assert.equal(RoomGeometry.layout([],[axisHorizontal]).inner[0].height,20);

assert.equal(exactCorner.wallGroups.length,1,'Dodirnute osnovne linije daju jednu povezanu cjelinu');
assert.equal(nearCorner.wallGroups.length,2,'Preklop debljina ne spaja odvojene osnovne linije');assert.equal(nearCorner.disconnectedOverlap,true);
assert.equal(shortOfAxis.wallGroups.length,2);assert.equal(parallelGap.wallGroups.length,2);

const almostClosed=[axisHorizontal,{x1:205,y1:100,x2:205,y2:200,thickness:20},{x1:100,y1:200,x2:205,y2:200,thickness:20},{x1:100,y1:100,x2:100,y2:200,thickness:20}];
const unjoinedLoop=RoomGeometry.layout([],almostClosed);assert.equal(unjoinedLoop.wallGroups.length,1,'Zidovi su povezani preko druge strane tlocrta');assert.ok(unjoinedLoop.unjoinedCaps.some(cap=>cap.x1===200&&cap.x2===200),'Lokalni prekid ostaje odvojen i kad postoji druga veza oko tlocrta');
