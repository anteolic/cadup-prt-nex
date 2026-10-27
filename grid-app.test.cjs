const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),labels=[],memory=new Map();
const canvas=new Proxy({measureText:text=>({width:text.length*6}),fillText:text=>labels.push(text)},{get:(o,k)=>o[k]||(()=>{})});
function el(id){
 if(!nodes.has(id))nodes.set(id,{clientWidth:1000,clientHeight:800,style:{},classList:{toggle(){},add(){},remove(){}},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){this[type]=fn;},getContext:()=>canvas,getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});
 return nodes.get(id);
}
const context=vm.createContext({console,document:{getElementById:el,documentElement:{}},window:{devicePixelRatio:1,addEventListener(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn()});
for(const file of ['room-geometry.js','grid-geometry.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
let source=fs.readFileSync(__dirname+'/grid-app.js','utf8');new Function(source);
source=source.replace('restore();status();',`globalThis.api={model,undo,redo,draw,snap,step,point,get segments(){return segments},get first(){return first},get visible(){return wallsVisible}};restore();status();`);
vm.runInContext(source,context);
const {api}=context,board=el('board');
const event=(x,y,id=1)=>({button:0,pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
function click(x,y){board.pointerdown(event(x,y));board.pointerup(event(x,y));}
function line(x1,y1,x2,y2){el('cancel').click();click(x1,y1);click(x2,y2);el('cancel').click();}
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);
assert.equal(api.model().faces.length,0);line(100,250,100,100);
assert.equal(api.model().faces.length,1);assert.equal(api.model().faces[0].area,120000);
assert.ok(labels.includes('Prostorija 1'));assert.ok(labels.some(t=>t.includes('m²')));
line(200,100,200,250);assert.equal(api.model().faces.length,2);assert.equal(api.model().layout.inner[0].width,10);
el('toggleWalls').click();assert.equal(api.visible,false);assert.equal(api.model().faces.length,2);
el('eraseMode').click();line(200,150,200,200);assert.equal(api.model().faces.length,2,'Otvor za vrata zadržava dvije prostorije');
assert.equal(api.model().doors.length,1);
assert.ok(!api.model().layout.inner.some(r=>r.y<400&&r.y+r.height>300),'Vrata ostaju bez ispune zida');
api.undo();assert.equal(api.model().faces.length,2);api.redo();assert.equal(api.model().faces.length,2);
// Gumica otvara obris i undo ga zatvara.
line(150,100,175,100);assert.equal(api.model().faces.length,0);api.undo();assert.equal(api.model().faces.length,2);
// Otkazivanje gumice ne mijenja spremljeni tlocrt.
const count=JSON.stringify(api.segments);board.pointerdown(event(150,100));board.pointercancel(event(150,100));assert.equal(JSON.stringify(api.segments),count);
// Isti stari način podešavanja: klizanje gore-dolje mijenja duljinu vodoravnog poteza.
el('drawMode').click();click(350,300);board.pointerdown(event(450,300));board.pointermove(event(450,275));
api.draw();assert.ok(labels.includes('2,50 m'));board.pointerup(event(450,275));
assert.ok(api.segments.some(s=>s.x1===700&&s.x2===950&&s.y1===600&&s.y2===600));
// Klik izvan čvora sjeda na običnu mrežu.
const snapped=api.snap(413,333);assert.equal(snapped.x%api.step(),0);assert.equal(snapped.y%api.step(),0);
el('clearAll').click();el('clearAll').click();assert.equal(api.segments.length,0);api.undo();assert.ok(api.segments.length);
assert.ok(JSON.parse(memory.get('infoa_grid_loops_v1')).segments.length);
el('clearAll').click();el('clearAll').click();el('drawMode').click();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
el('editMode').click();
function drag(x1,y1,x2,y2){board.pointerdown(event(x1,y1));board.pointermove(event(x2,y2));board.pointerup(event(x2,y2));}
drag(150,100,150,125);assert.equal(api.model().faces.length,2);
assert.ok(api.segments.some(s=>s.y1===250&&s.y2===250&&s.x1===200));
drag(150,125,150,75);assert.equal(api.model().faces.length,2);
assert.ok(api.segments.some(s=>s.y1===150&&s.y2===150&&s.x1===200),'Spušteni segment podiže se iznad početne ravnine');
api.undo();api.undo();
const beforeRoomMove=JSON.stringify(api.segments);drag(150,175,125,200);
assert.notEqual(JSON.stringify(api.segments),beforeRoomMove,'Povlačenje unutrašnjosti pomiče prostoriju');
assert.equal(api.model().faces.length,2);api.undo();assert.equal(JSON.stringify(api.segments),beforeRoomMove);
// Neprekinuti niz: svaki novi dodir dodaje segment i zadržava kraj za nastavak.
el('clearAll').click();el('clearAll').click();el('drawMode').click();
click(100,100);click(300,100);click(300,250);click(100,250);
assert.equal(api.model().faces.length,0);
assert.ok(api.first);assert.equal(api.first.x,200);assert.equal(api.first.y,500);
click(100,100);assert.equal(api.model().faces.length,1);
assert.ok(api.first,'Zatvoren obris dopušta nastavak crtanja');
const closed=JSON.stringify(api.segments);
click(100,100);assert.equal(api.first,null,'Drugi dodir iste točke završava niz');
assert.equal(JSON.stringify(api.segments),closed,'Završetak ne dodaje ni briše segmente');
// Pogrešan početak može se prekinuti ponovnim dodirom iste točke.
click(400,400);assert.ok(api.first);click(400,400);assert.equal(api.first,null);
assert.equal(JSON.stringify(api.segments),closed);
// Nakon završetka može se crtati odvojeni niz, a undo/redo čuva segmente.
click(400,400);click(500,400);click(500,500);click(500,500);
assert.equal(api.first,null);const extended=JSON.stringify(api.segments);
assert.notEqual(extended,closed);api.undo();assert.notEqual(JSON.stringify(api.segments),extended);
api.redo();assert.equal(JSON.stringify(api.segments),extended);
console.log('PASS: continuous line, ponovljeni dodir za završetak i otkazivanje početka; crtanje na dvije točke, podešavanje duljine, automatske prostorije, žive dimenzije, gumica, zidovi, snap, undo/redo i spremanje.');

// Pregrada: odabir sredine, skraćivanje ručkom, otkazivanje i undo/redo.
el('clearAll').click();el('clearAll').click();el('drawMode').click();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
el('editMode').click();click(200,175);
const beforeResize=JSON.stringify(api.segments);
drag(200,250,200,225);
assert.ok(api.segments.some(s=>s.x1===400&&s.x2===400&&s.y2===450),'Donja ručka skraćuje pregradu');
assert.ok(!api.model().layout.inner.some(r=>r.x===395&&r.y<500&&r.y+r.height>450),'Otvor ostaje prazan');
const shortWall=JSON.stringify(api.segments);
board.pointerdown(event(200,225));board.pointermove(event(200,200));board.pointercancel(event(200,200));
assert.equal(JSON.stringify(api.segments),shortWall,'Otkazivanje vraća duljinu');
api.undo();assert.equal(JSON.stringify(api.segments),beforeResize);
api.redo();assert.equal(JSON.stringify(api.segments),shortWall);
click(200,175);drag(200,225,200,250);
assert.equal(JSON.stringify(api.segments),beforeResize,'Produženje ručkom ponovno spaja zid');
// I nezatvoren, samostalan zid mora biti nacrtan debljinom.
el('clearAll').click();el('clearAll').click();el('drawMode').click();line(100,100,200,100);
assert.equal(api.model().faces.length,0);assert.equal(api.model().layout.inner.length,1);
el('editMode').click();click(150,100);drag(200,100,250,100);
assert.ok(api.segments.some(s=>s.x2===500&&s.y2===200),'Ručka produžuje nepotpuni vodoravni zid');

assert.equal(el('toggleWalls').attributes['aria-pressed'],String(api.visible));
el('toggleWalls').click();assert.equal(el('toggleWalls').attributes['aria-pressed'],String(api.visible));
assert.equal(el('toggleWalls').attributes['aria-label'],api.visible?'Sakrij zidove':'Prikaži zidove');
// Tri uzastopna dodira moraju dati dva povezana poteza, bez novog početka.
el('clearAll').click();el('clearAll').click();el('drawMode').click();
click(100,100);click(250,100);click(250,200);
assert.equal(api.segments.length,2);assert.equal(api.first.x,500);assert.equal(api.first.y,400);
click(250,200);assert.equal(api.first,null);assert.equal(api.segments.length,2);
