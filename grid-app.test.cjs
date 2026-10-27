const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),labels=[],memory=new Map();
let downloadedBlob=null,downloadName=null;
const gridLines=[];let gridStart=null;
const canvas=new Proxy({measureText:text=>({width:text.length*6}),fillText:text=>labels.push(text),moveTo(x,y){gridStart={x,y};},lineTo(x,y){if(gridStart&&['#c1ccda','#e4e9f0'].includes(this.strokeStyle))gridLines.push({...gridStart,x2:x,y2:y});}},{get:(o,k)=>o[k]||(()=>{})});
function el(id){
 if(!nodes.has(id))nodes.set(id,{clientWidth:1000,clientHeight:800,style:{},classList:{toggle(){},add(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},focus(){},select(){},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getContext:()=>canvas,getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});
 return nodes.get(id);
}
const context=vm.createContext({console,Blob,URL:{createObjectURL(blob){downloadedBlob=blob;return 'blob:test';},revokeObjectURL(){}},setTimeout:fn=>fn(),document:{addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getElementById:el,createElement:()=>({click(){downloadName=this.download;}}),documentElement:{}},window:{devicePixelRatio:1,addEventListener(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn()});
for(const file of ['room-geometry.js','grid-geometry.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
let source=fs.readFileSync(__dirname+'/grid-app.js','utf8');new Function(source);
source=source.replace('restore();status();',`globalThis.api={model,undo,redo,draw,snap,step,point,resize,zoomAt,fit,get view(){return {w,h,ox,oy,scale,height}},get selection(){return selectedWall},get dimensions(){return dimensionHits},get segments(){return segments},get first(){return first},get visible(){return wallsVisible}};restore();status();`);
vm.runInContext(source,context);
const {api}=context,board=el('board');
const event=(x,y,id=1)=>({button:0,pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
function click(x,y){board.pointerdown(event(x,y));board.pointerup(event(x,y));}
function line(x1,y1,x2,y2){el('cancel').click();click(x1,y1);click(x2,y2);el('cancel').click();}
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);
assert.equal(api.model().faces.length,0);line(100,250,100,100);
assert.equal(api.model().faces.length,1);assert.equal(api.model().faces[0].area,120000);
assert.ok(!labels.some(t=>t.startsWith('Prostorija ')));assert.ok(!labels.some(t=>t.includes('m²')));
assert.ok(labels.some(t=>t.endsWith(' cm')),'Duljine zidova ostaju vidljive');
assert.equal(el('roomArea').textContent,'');
line(200,100,200,250);assert.equal(api.model().faces.length,2);assert.equal(api.model().layout.inner[0].width,10);
el('toggleWalls').click();assert.equal(api.visible,false);assert.equal(api.model().faces.length,2);
el('eraseMode').click();const beforeEraseSelection=JSON.stringify(api.segments);
click(200,150);assert.ok(api.selection);assert.equal(JSON.stringify(api.segments),beforeEraseSelection,'Prvi dodir samo označava');
click(200,200);assert.equal(api.model().faces.length,1,'Drugi dodir briše cijelu pregradu');
assert.equal(api.selection,null);assert.ok(!api.segments.some(s=>s.x1===400&&s.x2===400));
api.undo();assert.equal(api.model().faces.length,2);api.redo();assert.equal(api.model().faces.length,1);
// Gumica otvara obris i undo ga zatvara.
click(150,100);click(175,100);assert.equal(api.model().faces.length,0);api.undo();assert.equal(api.model().faces.length,1);
// Otkazivanje gumice ne mijenja spremljeni tlocrt.
const count=JSON.stringify(api.segments);board.pointerdown(event(150,100));board.pointercancel(event(150,100));assert.equal(JSON.stringify(api.segments),count);
// Isti stari način podešavanja: klizanje gore-dolje mijenja duljinu vodoravnog poteza.
el('drawMode').click();click(350,300);board.pointerdown(event(450,300));board.pointermove(event(450,275));
api.draw();assert.ok(labels.includes('250 cm'));board.pointerup(event(450,275));
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

(async()=>{
 const original=JSON.stringify(api.segments);
 el('saveJson').click();assert.ok(downloadedBlob,'Spremi izrađuje JSON datoteku');
 const exported=await downloadedBlob.text(),data=JSON.parse(exported);
 assert.equal(data.format,'infoa-tlocrt');assert.equal(data.unit,'cm');
 assert.equal(JSON.stringify(data.segments),original);assert.ok(downloadName.endsWith('.json'));
 const load=async text=>{const input={files:[{size:text.length,text:async()=>text}],value:'selected'};await el('jsonFile').change({target:input});assert.equal(input.value,'');};
 el('clearAll').click();el('clearAll').click();assert.equal(api.segments.length,0);
 await load(exported);assert.equal(JSON.stringify(api.segments),original,'JSON izvoz i uvoz vraća isti tlocrt');
 assert.equal(api.visible,data.wallsVisible);
 api.undo();assert.equal(api.segments.length,0,'Uvoz se može poništiti');api.redo();
 const intact=JSON.stringify(api.segments);
 for(const text of ['{bad',JSON.stringify({segments:[{x1:1,y1:1,x2:2,y2:2}]}),JSON.stringify({version:999,segments:[]}),JSON.stringify({segments:[{x1:0,y1:0,x2:3000,y2:0}]})]){
  await load(text);assert.equal(JSON.stringify(api.segments),intact,'Neispravan uvoz ne briše tlocrt');
  assert.ok(el('status').textContent.startsWith('Uvoz nije uspio:'));
 }
 await load(JSON.stringify({segments:[]}));assert.equal(api.segments.length,0,'Valjan prazan tlocrt se može uvesti');
 await load(JSON.stringify({unit:'cm',segments:[{x1:100,y1:100,x2:400,y2:100,thickness:25}]}));
 assert.equal(api.segments[0].thickness,25,'JSON uvoz čuva debljinu');
 el('saveJson').click();assert.equal(JSON.parse(await downloadedBlob.text()).segments[0].thickness,25,'JSON izvoz čuva debljinu');
 const beforeBadThickness=JSON.stringify(api.segments);
 await load(JSON.stringify({segments:[{x1:100,y1:100,x2:400,y2:100,thickness:-5}]}));
 assert.equal(JSON.stringify(api.segments),beforeBadThickness,'Neispravna debljina ne mijenja crtež');
 console.log('PASS: JSON preuzimanje, povratni uvoz, undo/redo i zaštita od neispravnog uvoza.');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Portretni prikaz: pri zoom-outu mreža mora ostati vidljiva i iznad radne plohe.
board.clientWidth=400;board.clientHeight=800;api.resize();gridLines.length=0;api.zoomAt(.001);
let view=api.view;assert.equal(view.oy,200,'Smanjena ploha je centrirana bez neispravnih granica pomicanja');
assert.ok(gridLines.some(l=>l.x===0&&l.x2===400&&l.y===l.y2&&l.y>=0&&l.y<=api.step()*view.scale),'Mreža dopire do vrha prikaza');
assert.ok(gridLines.some(l=>l.y===0&&l.y2===800),'Okomita mreža pokriva cijelu visinu');
api.fit();assert.equal(api.view.oy,200);
api.zoomAt(2,200,100);view=api.view;assert.equal(view.oy,0);
board.clientWidth=1000;board.clientHeight=800;api.resize();api.fit();

// Najveći zoom-out: vidljivi razmak mreže iznosi točno 100 cm.
gridLines.length=0;api.zoomAt(.001);
const horizontalLevels=[...new Set(gridLines.filter(l=>l.x===0&&l.x2===1000&&l.y===l.y2).map(l=>l.y))].sort((a,b)=>a-b);
assert.ok(horizontalLevels.length>2);
assert.equal(horizontalLevels[1]-horizontalLevels[0],100*api.view.scale);
// Izbornik se zatvara na crtežu i pri odabiru alata, a ostaje otvoren pri radu u njemu.
el('topMenu').open=true;click(100,100);assert.equal(el('topMenu').open,false);
el('topMenu').open=true;el('editMode').click();assert.equal(el('topMenu').open,false);
el('topMenu').open=true;context.document.pointerdown({target:{closest:()=>null}});assert.equal(el('topMenu').open,false);
el('topMenu').open=true;context.document.pointerdown({target:{closest:()=>el('topMenu')}});assert.equal(el('topMenu').open,true);
el('topMenu').open=false;

// Dodir stvarno prikazane vanjske kote otvara unos i mijenja spojene zidove.
el('clearAll').click();el('clearAll').click();el('drawMode').click();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);
el('editMode').click();
const topDimension=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===170);
assert.ok(topDimension);click((topDimension.left+topDimension.right)/2,(topDimension.top+topDimension.bottom)/2);
assert.equal(el('dimensionDialog').open,true);assert.equal(el('dimensionValue').value,'460');
const beforeNumber=JSON.stringify(api.segments);
el('dimensionValue').value='0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(JSON.stringify(api.segments),beforeNumber);assert.ok(el('dimensionError').textContent);
el('dimensionValue').value='500,00';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionDialog').open,false);assert.equal(api.model().faces.length,1);
assert.ok(api.segments.some(s=>s.x1===640&&s.x2===640),'Vezani vanjski zid pomiče se s novom mjerom');
api.undo();assert.equal(JSON.stringify(api.segments),beforeNumber);api.redo();
const beforeCancel=JSON.stringify(api.segments);
el('editMode').click();const another=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===170);
click((another.left+another.right)/2,(another.top+another.bottom)/2);el('dimensionCancel').click();
assert.equal(JSON.stringify(api.segments),beforeCancel);assert.equal(el('dimensionDialog').open,false);

// Ručni unos izravno dodirom kote, bez uključivanja načina Uredi.
el('drawMode').click();const directDimension=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===170);
click((directDimension.left+directDimension.right)/2,(directDimension.top+directDimension.bottom)/2);
assert.equal(el('dimensionDialog').open,true);
el('dimensionValue').value='520.0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionDialog').open,false);assert.equal(api.model().faces.length,1);
assert.ok(api.segments.some(s=>s.x1===660&&s.x2===660));

// U istom prozoru mijenja se samo debljina, uz nepromijenjene osi i undo/redo.
el('drawMode').click();let thicknessLabel=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===170);
click((thicknessLabel.left+thicknessLabel.right)/2,(thicknessLabel.top+thicknessLabel.bottom)/2);
assert.equal(el('dimensionThickness').value,'30');const beforeThickness=JSON.stringify(api.segments);
el('dimensionThickness').value='0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(JSON.stringify(api.segments),beforeThickness);assert.equal(el('dimensionDialog').open,true);
el('dimensionThickness').value='50';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionDialog').open,false);assert.equal(api.model().faces.length,1);
assert.equal(api.segments.filter(s=>s.thickness===50).length,1);
assert.ok(api.segments.some(s=>s.x1===660&&s.x2===660),'Sama debljina ne mijenja duljinu osi');
assert.equal(Math.min(...api.model().layout.outer.map(r=>r.y)),150);
const afterThickness=JSON.stringify(api.segments);api.undo();assert.equal(JSON.stringify(api.segments),beforeThickness);api.redo();assert.equal(JSON.stringify(api.segments),afterThickness);
// Istodobni unos duljine i debljine daje traženu novu kotu.
let combinedLabel=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===150);
click((combinedLabel.left+combinedLabel.right)/2,(combinedLabel.top+combinedLabel.bottom)/2);
el('dimensionValue').value='600';el('dimensionThickness').value='40';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionDialog').open,false);assert.equal(api.model().faces.length,1);
assert.ok(api.model().wallOutline.edges.some(e=>e.axis==='h'&&e.line===160&&e.span[1]-e.span[0]===600));

// Mreža ostaje vidljiva i nakon odabira početka linije.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
gridLines.length=0;click(100,100);assert.ok(gridLines.length>0);
el('cancel').click();

// Odabir za brisanje: prazan prostor poništava, drugi zid prebacuje odabir.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
el('eraseMode').click();const eraseOriginal=JSON.stringify(api.segments);
click(200,175);assert.equal(api.selection.x1,400);
click(400,400);assert.equal(api.selection,null);assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(200,175);click(150,100);assert.equal(api.selection.y1,200);assert.equal(api.selection.x2,400);
assert.equal(JSON.stringify(api.segments),eraseOriginal,'Drugi zid se označi bez brisanja prethodnog');
board.pointerdown(event(150,100));board.pointermove(event(150,140));board.pointerup(event(150,100));
assert.equal(JSON.stringify(api.segments),eraseOriginal,'Povlačenje ne potvrđuje brisanje');
board.pointerdown(event(150,100));board.pointercancel(event(150,100));assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(175,100);assert.equal(api.selection,null);
assert.ok(!api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1<400),'Briše se cijeli odabrani dio između spojeva');
assert.ok(api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1===400),'Susjedni segment ostaje');
api.undo();assert.equal(JSON.stringify(api.segments),eraseOriginal);api.redo();assert.notEqual(JSON.stringify(api.segments),eraseOriginal);

// Crtanje preko zida zamjenjuje staro brisanje dijela, uz neprekinuti nastavak.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
line(100,100,300,100);const beforeOverdraw=JSON.stringify(api.segments);
click(150,100);click(200,100);
assert.equal(api.segments.length,2);assert.ok(api.first);
assert.ok(!api.segments.some(s=>s.y1===200&&s.x1<400&&s.x2>300),'Preklop je otvoren');
el('cancel').click();api.undo();assert.equal(JSON.stringify(api.segments),beforeOverdraw);api.redo();assert.equal(api.segments.length,2);
line(150,100,200,100);assert.equal(api.segments.length,1,'Prazan otvor može se ponovno nacrtati');
