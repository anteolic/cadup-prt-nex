const assert=require('node:assert/strict');
require('./object-sketch.js');require('./cad-objects.js');
const S=ObjectSketch,C=CadObjects;
const line=(x1,y1,x2,y2)=>({x1,y1,x2,y2});
const square=[line(-40,-40,40,-40),line(40,-40,40,40),line(40,40,-40,40),line(-40,40,-40,-40)];
const area=polygon=>Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.y-q.x*p.y;},0)/2);
assert.equal(S.faces(square).length,1);assert.equal(area(S.faces(square)[0]),6400);
assert.equal(S.faces(square.slice(0,3)).length,0,'Open strokes remain unfilled');
const split=S.faces([...square,line(-40,-40,40,40)]);
assert.equal(split.length,2);assert.equal(split.reduce((sum,polygon)=>sum+area(polygon),0),6400);
const crossed=S.faces([...square,line(-50,0,50,0),line(0,-50,0,50)]);
assert.equal(crossed.length,4);assert.equal(crossed.reduce((sum,polygon)=>sum+area(polygon),0),6400);
assert.equal(S.faces([...square,...square]).length,1,'Overlapping strokes do not double-fill a face');
for(const definition of C.catalog){
 const item=C.create(definition.kind,1000,1000),lines=S.extract(item);
 assert.ok(lines.length>0,definition.kind);assert.deepEqual(S.validate(lines,item),lines);
}
const item={...C.create('desk',700,800),sketch:{lines:square}};
assert.deepEqual(C.validate(JSON.parse(JSON.stringify([item]))),[item]);
assert.deepEqual(S.extract(item),square);
assert.deepEqual(C.duplicate([item],[item.id]).items[1].sketch,item.sketch);
const template=C.createTemplate([item],[item.id],'Sketch');
assert.deepEqual(C.instantiate(template,1000,1000).items[0].sketch,item.sketch);
assert.deepEqual(C.resize([item],[item.id],280,140,90)[0].sketch,item.sketch);
assert.deepEqual(C.mirror([item],[item.id])[0].sketch,item.sketch);
assert.throws(()=>C.validate([{...item,sketch:{lines:[line(-100,0,0,0)]}}]));
assert.throws(()=>C.validate([{...item,sketch:{lines:[line(0,0,0,0)]}}]));
assert.throws(()=>C.validate([{...item,sketch:{lines:[line(0,0,NaN,1)]}}]));
console.log('PASS: editable catalog lines, closed-face fill, intersections, validation and sketch persistence.');

const roundSketch={...C.create('shape-square',500,500),sketch:{lines:[{type:'circle',cx:0,cy:0,rx:20,ry:20}]}};
assert.deepEqual(C.validate([roundSketch]),[roundSketch]);
assert.deepEqual(C.duplicate([roundSketch],[roundSketch.id]).items[1].sketch,roundSketch.sketch);
assert.throws(()=>S.validate([{type:'circle',cx:45,cy:0,rx:20,ry:20}],roundSketch));
assert.throws(()=>S.validate([{type:'circle',cx:0,cy:0,rx:0,ry:20}],roundSketch));
