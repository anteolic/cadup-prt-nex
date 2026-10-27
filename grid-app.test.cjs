const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),labels=[],memory=new Map();
let downloadedBlob=null,downloadName=null;
const gridLines=[],paintCalls=[];let gridStart=null;
const canvas=new Proxy({fill(){paintCalls.push({color:this.fillStyle,alpha:this.globalAlpha});},measureText:text=>({width:text.length*6}),fillText:text=>labels.push(text),moveTo(x,y){gridStart={x,y};},lineTo(x,y){if(gridStart&&['#c1ccda','#e4e9f0'].includes(this.strokeStyle))gridLines.push({...gridStart,x2:x,y2:y});}},{get:(o,k)=>o[k]||(()=>{})});
function el(id){
 if(!nodes.has(id))nodes.set(id,{clientWidth:1000,clientHeight:800,style:{},classList:{toggle(){},add(){},remove(){}},focus(){},select(){},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getContext:()=>canvas,getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});
 return nodes.get(id);
}
const context=vm.createContext({console,Blob,URL:{createObjectURL(blob){downloadedBlob=blob;return 'blob:test';},revokeObjectURL(){}},setTimeout:fn=>fn(),document:{addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getElementById:el,createElement:()=>({click(){downloadName=this.download;}}),documentElement:{}},window:{devicePixelRatio:1,addEventListener(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn()});
for(const file of ['room-geometry.js','grid-geometry.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
let source=fs.readFileSync(__dirname+'/grid-app.js','utf8');new Function(source);
source=source.replace('restore();status();',`globalThis.api={get mode(){return mode},model,undo,redo,draw,snap,step,point,resize,zoomAt,fit,get view(){return {w,h,ox,oy,scale,height}},get selection(){return selectedWall},get dimensions(){return dimensionHits},get segments(){return segments},get first(){return first},get visible(){return wallsVisible}};restore();status();`);
vm.runInContext(source,context);
const {api}=context,board=el('board');
const event=(x,y,id=1)=>({button:0,pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
function click(x,y){board.pointerdown(event(x,y));board.pointerup(event(x,y));}
function line(x1,y1,x2,y2){el('cancel').click();el('drawMode').click();click(x1,y1);click(x2,y2);el('cancel').click();}
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);
assert.equal(api.model().faces.length,0);line(100,250,100,100);
assert.equal(api.model().faces.length,1);assert.equal(api.model().faces[0].area,120000);
assert.ok(!labels.some(t=>t.startsWith('Prostorija ')));assert.ok(!labels.some(t=>t.includes('m²')));
assert.ok(labels.some(t=>t.endsWith(' cm')),'Duljine zidova ostaju vidljive');
assert.equal(el('roomArea').textContent,'');
line(200,100,200,250);assert.equal(api.model().faces.length,2);assert.equal(api.model().layout.inner[0].width,10);
el('toggleWalls').click();assert.equal(api.visible,false);assert.equal(api.model().faces.length,2);
el('editMode').click();const beforeEraseSelection=JSON.stringify(api.segments);
click(200,150);assert.ok(api.selection);assert.equal(JSON.stringify(api.segments),beforeEraseSelection,'Prvi dodir samo označava');
el('wallDelete').click();assert.equal(api.model().faces.length,1,'Brisanje u načinu Uredi uklanja cijelu pregradu');
assert.equal(api.selection,null);assert.ok(!api.segments.some(s=>s.x1===400&&s.x2===400));
api.undo();assert.equal(api.model().faces.length,2);api.redo();assert.equal(api.model().faces.length,1);
// Gumica otvara obris i undo ga zatvara.
click(150,100);el('wallDelete').click();assert.equal(api.model().faces.length,0);api.undo();assert.equal(api.model().faces.length,1);
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
el('drawMode').click();click(400,400);assert.ok(api.first);click(400,400);assert.equal(api.first,null);
assert.equal(JSON.stringify(api.segments),closed);
// Nakon završetka može se crtati odvojeni niz, a undo/redo čuva segmente.
el('drawMode').click();click(400,400);click(500,400);click(500,500);click(500,500);
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
 const cameraBeforeImport={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};
 await load(exported);assert.deepEqual({scale:api.view.scale,ox:api.view.ox,oy:api.view.oy},cameraBeforeImport,'Uvoz ne mijenja kameru');
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

// Dimenzije su samo oznake; uređivanje počinje odabirom samog zida.
el('clearAll').click();el('clearAll').click();el('drawMode').click();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);
el('editMode').click();
const topDimension=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===170);
assert.ok(topDimension);const beforeLabel=JSON.stringify(api.segments);
click((topDimension.left+topDimension.right)/2,(topDimension.top+topDimension.bottom)/2);
assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);assert.equal(JSON.stringify(api.segments),beforeLabel);
click(200,100);assert.ok(api.selection);assert.equal(el('wallActions').hidden,false);
assert.equal(el('dimensionValue').value,'400');assert.equal(el('dimensionThickness').value,'30');
const beforeNumber=JSON.stringify(api.segments);
el('dimensionValue').value='0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(JSON.stringify(api.segments),beforeNumber);assert.ok(el('dimensionError').textContent);
el('dimensionValue').value='440';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionError').textContent,'');assert.equal(api.model().faces.length,1);
assert.ok(api.segments.some(s=>s.x1===640&&s.x2===640));
api.undo();assert.equal(JSON.stringify(api.segments),beforeNumber);api.redo();
click(200,100);el('dimensionValue').value='460';el('dimensionForm').submit({preventDefault(){}});
assert.ok(api.segments.some(s=>s.x1===660&&s.x2===660));
const beforeThickness=JSON.stringify(api.segments);
el('dimensionThickness').value='0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(JSON.stringify(api.segments),beforeThickness);assert.ok(el('dimensionError').textContent);
el('dimensionThickness').value='50';el('dimensionForm').submit({preventDefault(){}});
assert.equal(api.model().faces.length,1);assert.equal(api.segments.filter(s=>s.thickness===50).length,1);
assert.ok(api.segments.some(s=>s.x1===660&&s.x2===660));
assert.equal(Math.min(...api.model().layout.outer.map(r=>r.y)),150);
const afterThickness=JSON.stringify(api.segments);api.undo();assert.equal(JSON.stringify(api.segments),beforeThickness);api.redo();assert.equal(JSON.stringify(api.segments),afterThickness);
click(200,100);el('dimensionValue').value='520';el('dimensionThickness').value='40';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionError').textContent,'');assert.equal(api.model().faces.length,1);
assert.ok(api.model().wallOutline.edges.some(e=>e.axis==='h'&&e.line===160&&e.span[1]-e.span[0]===600));
// Odabir zida ne dodaje naglašenu kotu uz postojeća donja polja.
assert.ok(api.dimensions.every(r=>r.dimension.side===-1||r.dimension.side===1),'Prikazane su samo postojeće rubne kote');
el('wallDeselect').click();assert.equal(el('wallActions').hidden,true);

// Mreža ostaje vidljiva i nakon odabira početka linije.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
gridLines.length=0;click(100,100);assert.ok(gridLines.length>0);
el('cancel').click();

// Uređivanje zida: neutralni odabir, radnje na ekranu i brisanje samo tipkom.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
el('editMode').click();const eraseOriginal=JSON.stringify(api.segments);
click(200,175);assert.equal(api.selection.x1,400);assert.equal(el('wallActions').hidden,false);
click(400,400);assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(200,175);click(150,100);assert.equal(api.selection.y1,200);assert.equal(api.selection.x2,400);
assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(175,100);assert.equal(JSON.stringify(api.segments),eraseOriginal,'Ponovljeni odabir ne briše zid');
el('wallDelete').click();assert.equal(api.selection,null);
assert.ok(!api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1<400));
assert.ok(api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1===400));
api.undo();assert.equal(JSON.stringify(api.segments),eraseOriginal);api.redo();assert.notEqual(JSON.stringify(api.segments),eraseOriginal);

// Precrtavanje postojećeg zida ne briše njegov dio.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
line(100,100,300,100);const beforeOverdraw=JSON.stringify(api.segments);
line(150,100,200,100);assert.equal(JSON.stringify(api.segments),beforeOverdraw);

// Završetak crtanja automatski uključuje Uredi; naredbe zidova su samo u tom načinu.
el('clearAll').click();el('clearAll').click();el('drawMode').click();api.fit();
click(100,100);click(300,100);click(300,100);
assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(el('editMode').attributes['aria-pressed'],'true');
assert.equal(el('wallActions').hidden,true);
click(200,100);assert.ok(api.selection);assert.equal(el('wallActions').hidden,false);
paintCalls.length=0;api.draw();assert.ok(paintCalls.some(p=>p.color==='#93c5fd'&&p.alpha===1),'Odabrani zid ima plavu ispunu');
assert.ok(paintCalls.some(p=>p.color==='#bfc3c8'&&p.alpha===.3),'Ostatak zidova je prigušen');
assert.equal(el('dimensionValue').value,'400');assert.equal(el('dimensionThickness').value,'10');
click(200,100);assert.equal(el('wallActions').hidden,false);assert.equal(el('dimensionValue').value,'400');el('wallDeselect').click();
click(200,100);assert.equal(el('wallActions').hidden,false);assert.equal(el('dimensionThickness').value,'10');el('wallDeselect').click();
const beforeSelectionDelete=JSON.stringify(api.segments);
el('wallDeselect').click();assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);
el('wallDelete').click();assert.equal(JSON.stringify(api.segments),beforeSelectionDelete,'Brisanje bez odabira ništa ne radi');
click(200,100);el('wallDelete').click();assert.equal(api.segments.length,0);api.undo();assert.equal(JSON.stringify(api.segments),beforeSelectionDelete);
el('drawMode').click();assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);
const drawDimension=api.dimensions[0];assert.ok(drawDimension);
click((drawDimension.left+drawDimension.right)/2,(drawDimension.top+drawDimension.bottom)/2);
assert.equal(el('wallActions').hidden,true,'U crtanju nema polja uređivanja');
el('cancel').click();assert.equal(api.mode,'edit');assert.equal(api.first,null);
// Srednja ručka pomiče zid; krajnje ručke ostaju za duljinu.
click(200,100);drag(200,100,200,150);
assert.ok(api.segments.some(s=>s.y1===300&&s.y2===300));assert.equal(el('wallActions').hidden,false);
assert.equal(canvas.globalAlpha,1,'Prigušenje ne prelazi u sljedeći kadar');

// Izravna donja polja zadržavaju unos pri osvježavanju i podržavaju uzastopne promjene.
assert.equal(el('wallActions').hidden,false);
el('dimensionValue').value='450';el('dimensionThickness').value='12,5';api.zoomAt(1);
assert.equal(el('dimensionValue').value,'450');assert.equal(el('dimensionThickness').value,'12,5');
el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionError').textContent,'');assert.equal(el('wallActions').hidden,false);
assert.equal(el('dimensionValue').value,'450');assert.equal(el('dimensionThickness').value,'12,5');
assert.ok(api.segments.some(s=>s.thickness===12.5&&s.x2-s.x1===450));
el('dimensionValue').value='475';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionValue').value,'475');assert.ok(api.segments.some(s=>s.x2-s.x1===475));

// Kamera se ne mijenja zbog uređivanja, tipkovnice, panela ni rotacije.
const camera=()=>({scale:api.view.scale,ox:api.view.ox,oy:api.view.oy});
api.zoomAt(2,200,150);const stableCamera=camera();
for(let i=0;i<5;i++)api.resize();assert.deepEqual(camera(),stableCamera,'Ponavljanje ResizeObservera ne povećava zoom');
board.clientHeight=450;api.resize();assert.deepEqual(camera(),stableCamera,'Otvaranje tipkovnice ne mijenja kameru');
board.clientHeight=800;api.resize();assert.deepEqual(camera(),stableCamera);
board.clientWidth=400;board.clientHeight=800;api.resize();assert.deepEqual(camera(),stableCamera,'Rotacija i promjena širine zadržavaju zoom');
board.clientWidth=1000;api.resize();assert.deepEqual(camera(),stableCamera);
el('editMode').click();assert.deepEqual(camera(),stableCamera);
const wallMid=api.segments[0],screenView=api.view;
click(screenView.ox+(wallMid.x1+wallMid.x2)/2*screenView.scale,screenView.oy+(wallMid.y1+wallMid.y2)/2*screenView.scale);
assert.deepEqual(camera(),stableCamera);
if(api.selection){el('dimensionValue').value='490';el('dimensionForm').submit({preventDefault(){}});assert.deepEqual(camera(),stableCamera);el('wallDeselect').click();assert.deepEqual(camera(),stableCamera);}
api.zoomAt(.9);assert.notDeepEqual(camera(),stableCamera,'Korisnik i dalje može promijeniti zoom');

// Uređivanje privremeno zamjenjuje glavne alate na dnu.
el('editMode').click();const toolbarCamera={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};
api.fit();const oneWall=api.segments[0],toolView=api.view;
click(toolView.ox+(oneWall.x1+oneWall.x2)/2*toolView.scale,toolView.oy+(oneWall.y1+oneWall.y2)/2*toolView.scale);
assert.ok(api.selection);assert.equal(el('wallActions').hidden,false);assert.equal(el('mainTools').hidden,true);
el('wallDeselect').click();assert.equal(el('wallActions').hidden,true);assert.equal(el('mainTools').hidden,false);
