const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),labels=[],memory=new Map();
let downloadedBlob=null,downloadName=null,redStrokes=0,blueDraftStrokes=0;
const holdTimers=[];const updateRequests=[];let updateFailure=null;
const publishedHtml=fs.readFileSync(__dirname+'/CADup.html','utf8');
const gridLines=[],paintCalls=[],wallGrips=[];let gridStart=null;
const canvas=new Proxy({stroke(){if(this.strokeStyle==='#4b5563'&&this.lineWidth===1.5)wallGrips.push({});if(this.strokeStyle==='#dc2626')redStrokes++;if(this.strokeStyle==='#1675d1'&&this.lineWidth===2.5)blueDraftStrokes++;},arc(){},fill(){paintCalls.push({color:this.fillStyle,alpha:this.globalAlpha});},measureText:text=>({width:text.length*6}),fillText:text=>labels.push(text),moveTo(x,y){gridStart={x,y};},lineTo(x,y){if(gridStart&&['#c1ccda','#e4e9f0'].includes(this.strokeStyle))gridLines.push({...gridStart,x2:x,y2:y});}},{get:(o,k)=>o[k]||(()=>{})});
function el(id){
 if(!nodes.has(id))nodes.set(id,{clientWidth:1000,clientHeight:800,style:{},classList:{toggle(){},add(){},remove(){}},focus(){},select(){},showModal(){this.open=true;},close(){this.open=false;},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getContext:()=>canvas,getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});
 return nodes.get(id);
}
const context=vm.createContext({console,Blob,fetch:async(url,options)=>{updateRequests.push({url,options});if(updateFailure==='network')throw new Error('Offline');return {ok:updateFailure!=='http'&&!(updateFailure==='script'&&url.includes('grid-app.js')),status:updateFailure==='http'||(updateFailure==='script'&&url.includes('grid-app.js'))?503:200,text:async()=>url.includes('CADup.html')?(updateFailure==='incomplete'?'<html></html>':publishedHtml):'/* verified script response */'};},URL:class extends URL{static createObjectURL(blob){downloadedBlob=blob;return 'blob:test';}static revokeObjectURL(){}},setTimeout:(fn,delay)=>delay===550?holdTimers.push(fn):fn(),document:{removeEventListener(){},addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getElementById:el,createElement:()=>({click(){downloadName=this.download;}}),documentElement:{}},window:{location:{href:'https://anteolic.github.io/cadup-prt-nex/CADup.html?v=39&mode=test#drawing',replace(url){this.href=url;}},devicePixelRatio:1,addEventListener(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn()});
for(const file of ['room-geometry.js','grid-geometry.js','object-sketch.js','cad-objects.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
let source=fs.readFileSync(__dirname+'/grid-app.js','utf8');new Function(source);
source=source.replace('restore();status();',`globalThis.api={overallDimensions,get roomDetails(){return roomDetails},readRoomDetails,get selectedRoomId(){return selected},openGroupEditor,closeGroupEditor,get editingGroup(){return editingGroup},drawObjectViewportActions,objectViewportActions,displayPoint,viewBounds,get viewportTurns(){return viewportTurns},objectHandles,guideAxes,addCustomObject,get customLibrary(){return customLibrary},addObject,get objects(){return objects},get objectIds(){return [...objectIds]},handleScale,hitHandle,get mode(){return mode},model,undo,redo,draw,snap,step,point,resize,zoomAt,fit,get view(){return {w,h,ox,oy,scale,height}},get selection(){return selectedWall},get dimensions(){return dimensionHits},get segments(){return segments},get first(){return first},get visible(){return wallsVisible}};restore();status();`);
vm.runInContext(source,context);
const {api}=context,board=el('board');
const event=(x,y,id=1)=>({button:0,pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
function click(x,y){board.pointerdown(event(x,y));board.pointerup(event(x,y));}
function clickObjectAction(action){const target=api.objectViewportActions().find(item=>item.action===action);assert.ok(target);const p=api.displayPoint(target);click(p.x,p.y);}
function enterEdit(){if(api.mode!=='edit')el('selectMode').click();else deselect();}
function finishDrawing(){enterEdit();}
function startDrawing(){if(api.mode!=='draw')el('drawMode').click();}
function eraseSelection(){const selected=api.selection;if(!selected)return;const h=selected.y1===selected.y2,wall=context.GridGeometry.atomic(api.segments).find(s=>(s.y1===s.y2)===h&&(h?s.y1===selected.y1&&s.x1>=selected.x1&&s.x2<=selected.x2:s.x1===selected.x1&&s.y1>=selected.y1&&s.y2<=selected.y2));if(!wall)return;if(api.mode!=='erase')el('eraseMode').click();const v=api.view;click(v.ox+(wall.x1+wall.x2)/2*v.scale,v.oy+(wall.y1+wall.y2)/2*v.scale);}
function deselect(){click(api.view.w-8,api.view.h-8);}
function line(x1,y1,x2,y2){finishDrawing();startDrawing();click(x1,y1);click(x2,y2);finishDrawing();}
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);
assert.equal(api.model().faces.length,0);line(100,250,100,100);
assert.equal(api.model().faces.length,1);assert.equal(api.model().faces[0].area,120000);
assert.ok(!labels.some(t=>t.startsWith('Prostorija ')));assert.ok(!labels.some(t=>t.includes('m²')));
assert.ok(labels.some(t=>t.endsWith(' cm')),'Duljine zidova ostaju vidljive');
assert.equal(el('roomArea').textContent,'');
line(200,100,200,250);assert.equal(api.model().faces.length,2);assert.equal(api.model().layout.inner[0].width,10);
assert.equal(api.visible,true);assert.equal(api.model().faces.length,2);
enterEdit();const beforeEraseSelection=JSON.stringify(api.segments);
click(200,150);assert.ok(api.selection);assert.equal(JSON.stringify(api.segments),beforeEraseSelection,'Prvi dodir samo označava');
eraseSelection();assert.equal(api.model().faces.length,1,'Brisanje u načinu Uredi uklanja cijelu pregradu');
assert.equal(api.selection,null);assert.ok(!api.segments.some(s=>s.x1===400&&s.x2===400));
api.undo();assert.equal(api.model().faces.length,2);api.redo();assert.equal(api.model().faces.length,1);
// Gumica otvara obris i undo ga zatvara.
enterEdit();click(150,100);eraseSelection();assert.equal(api.model().faces.length,0);api.undo();assert.equal(api.model().faces.length,1);
// Otkazivanje gumice ne mijenja spremljeni tlocrt.
const count=JSON.stringify(api.segments);board.pointerdown(event(150,100));board.pointercancel(event(150,100));assert.equal(JSON.stringify(api.segments),count);
// Isti stari način podešavanja: klizanje gore-dolje mijenja duljinu vodoravnog poteza.
startDrawing();click(350,300);board.pointerdown(event(450,300));board.pointermove(event(450,275));
api.draw();assert.ok(labels.includes('250 cm'));board.pointerup(event(450,275));
assert.ok(api.segments.some(s=>s.x1===700&&s.x2===950&&s.y1===600&&s.y2===600));
// Klik izvan čvora sjeda na običnu mrežu.
const snapped=api.snap(413,333);assert.equal(snapped.x%api.step(),0);assert.equal(snapped.y%api.step(),0);
el('clearAll').click();el('clearAll').click();assert.equal(api.segments.length,0);api.undo();assert.ok(api.segments.length);
assert.ok(JSON.parse(memory.get('infoa_grid_loops_v1')).segments.length);
el('clearAll').click();el('clearAll').click();startDrawing();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
enterEdit();
function drag(x1,y1,x2,y2){board.pointerdown(event(x1,y1));board.pointermove(event(x2,y2));board.pointerup(event(x2,y2));}
click(150,100);drag(150,100,150,125);assert.equal(api.model().faces.length,2);
assert.ok(api.segments.some(s=>s.y1===250&&s.y2===250&&s.x1===200));
drag(150,125,150,75);assert.equal(api.model().faces.length,2);
assert.ok(api.segments.some(s=>s.y1===150&&s.y2===150&&s.x1===200),'Spušteni segment podiže se iznad početne ravnine');
api.undo();api.undo();
const beforeRoomMove=JSON.stringify(api.segments),beforeRoomCamera={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};drag(150,175,125,200);
assert.equal(JSON.stringify(api.segments),beforeRoomMove,'Povlačenje unutrašnjosti ne pomiče prostoriju');
assert.equal(api.model().faces.length,2);assert.deepEqual({scale:api.view.scale,ox:api.view.ox,oy:api.view.oy},{...beforeRoomCamera,ox:beforeRoomCamera.ox-25,oy:beforeRoomCamera.oy+25},'Povlačenje praznog prostora pomiče samo prikaz');
api.fit();
// Neprekinuti niz: svaki novi dodir dodaje segment i zadržava kraj za nastavak.
el('clearAll').click();el('clearAll').click();startDrawing();
click(100,100);click(300,100);click(300,250);click(100,250);
assert.equal(api.model().faces.length,0);
assert.ok(api.first);assert.equal(api.first.x,200);assert.equal(api.first.y,500);
click(100,100);assert.equal(api.model().faces.length,1);
assert.ok(api.first,'Zatvoren obris ne završava crtanje');assert.equal(api.mode,'draw');
const closed=JSON.stringify(api.segments);
click(100,100);assert.equal(api.first,null,'Ponovni dodir zadnje točke završava crtanje');assert.equal(api.mode,'edit');
assert.equal(JSON.stringify(api.segments),closed,'Završetak ne dodaje ni briše segmente');
// Pogrešan početak može se prekinuti ponovnim dodirom iste točke.
startDrawing();click(400,400);assert.ok(api.first);click(400,400);assert.equal(api.first,null);
assert.equal(JSON.stringify(api.segments),closed);
// Nakon završetka može se crtati odvojeni niz, a undo/redo čuva segmente.
startDrawing();click(400,400);click(500,400);click(500,500);click(500,500);
assert.equal(api.first,null);const extended=JSON.stringify(api.segments);
assert.notEqual(extended,closed);api.undo();assert.notEqual(JSON.stringify(api.segments),extended);
api.redo();assert.equal(JSON.stringify(api.segments),extended);
console.log('PASS: continuous line, ponovljeni dodir za završetak i otkazivanje početka; crtanje na dvije točke, podešavanje duljine, automatske prostorije, žive dimenzije, gumica, zidovi, snap, undo/redo i spremanje.');

// Pregrada: odabir sredine, skraćivanje ručkom, otkazivanje i undo/redo.
el('clearAll').click();el('clearAll').click();startDrawing();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
enterEdit();click(200,175);
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
el('clearAll').click();el('clearAll').click();startDrawing();line(100,100,200,100);
assert.equal(api.model().faces.length,0);assert.equal(api.model().layout.inner.length,1);
enterEdit();click(150,100);drag(200,100,250,100);
assert.ok(api.segments.some(s=>s.x2===500&&s.y2===200),'Ručka produžuje nepotpuni vodoravni zid');

assert.equal(api.visible,true);
// Tri uzastopna dodira moraju dati dva povezana poteza, bez novog početka.
el('clearAll').click();el('clearAll').click();startDrawing();
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
el('topMenu').open=true;enterEdit();assert.equal(el('topMenu').open,false);
el('topMenu').open=true;context.document.pointerdown({target:{closest:()=>null}});assert.equal(el('topMenu').open,false);
el('topMenu').open=true;context.document.pointerdown({target:{closest:()=>el('topMenu')}});assert.equal(el('topMenu').open,true);
el('topMenu').open=false;api.fit();

// Dimenzije su samo oznake; uređivanje počinje odabirom samog zida.
el('clearAll').click();el('clearAll').click();startDrawing();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);
enterEdit();
const topDimension=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===185);
assert.ok(topDimension);const beforeLabel=JSON.stringify(api.segments);
click((topDimension.left+topDimension.right)/2,(topDimension.top+topDimension.bottom)/2);
assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);assert.equal(JSON.stringify(api.segments),beforeLabel);
click(200,100);assert.ok(api.selection);assert.equal(el('wallActions').hidden,false);
assert.equal(el('dimensionValue').value,'370');assert.equal(el('dimensionThickness').value,'30');
const beforeNumber=JSON.stringify(api.segments);
el('dimensionValue').value='0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(JSON.stringify(api.segments),beforeNumber);assert.ok(el('dimensionError').textContent);
el('dimensionValue').value='440';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionError').textContent,'');assert.equal(api.model().faces.length,1);
assert.ok(api.segments.some(s=>s.x1===670&&s.x2===670));
api.undo();assert.equal(JSON.stringify(api.segments),beforeNumber);api.redo();
click(200,100);el('dimensionValue').value='460';el('dimensionForm').submit({preventDefault(){}});
assert.ok(api.segments.some(s=>s.x1===690&&s.x2===690));
const beforeThickness=JSON.stringify(api.segments);
el('dimensionThickness').value='0';el('dimensionForm').submit({preventDefault(){}});
assert.equal(JSON.stringify(api.segments),beforeThickness);assert.ok(el('dimensionError').textContent);
el('dimensionThickness').value='50';el('dimensionForm').submit({preventDefault(){}});
assert.equal(api.model().faces.length,1);assert.equal(api.segments.filter(s=>s.thickness===50).length,1);
assert.ok(api.segments.some(s=>s.x1===690&&s.x2===690));
assert.equal(Math.min(...api.model().layout.outer.map(r=>r.y)),175);
const afterThickness=JSON.stringify(api.segments);api.undo();assert.equal(JSON.stringify(api.segments),beforeThickness);api.redo();assert.equal(JSON.stringify(api.segments),afterThickness);
click(200,100);el('dimensionValue').value='520';el('dimensionThickness').value='40';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionError').textContent,'');assert.equal(api.model().faces.length,1);
assert.ok(api.model().wallOutline.edges.some(e=>e.axis==='h'&&e.line===180&&e.span[1]-e.span[0]===580));
// Odabir zida ne dodaje naglašenu kotu uz postojeća donja polja.
assert.ok(api.dimensions.every(r=>r.dimension.side===-1||r.dimension.side===1),'Prikazane su samo postojeće rubne kote');
deselect();assert.equal(el('wallActions').hidden,true);

// Mreža ostaje vidljiva i nakon odabira početka linije.
el('clearAll').click();el('clearAll').click();startDrawing();api.fit();
gridLines.length=0;click(100,100);assert.ok(gridLines.length>0);
finishDrawing();

// Uređivanje zida: neutralni odabir, radnje na ekranu i brisanje samo tipkom.
el('clearAll').click();el('clearAll').click();startDrawing();api.fit();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
enterEdit();const eraseOriginal=JSON.stringify(api.segments);
click(200,175);assert.equal(api.selection.x1,400);assert.equal(el('wallActions').hidden,false);
click(400,400);assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(200,175);click(150,100);assert.equal(api.selection.y1,200);assert.equal(api.selection.x2,400);
assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(175,100);assert.equal(JSON.stringify(api.segments),eraseOriginal,'Ponovljeni odabir ne briše zid');
eraseSelection();assert.equal(api.selection,null);
assert.ok(!api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1<400));
assert.ok(api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1===400),'Gumica ostavlja susjedni dio ravnog zida iza čvora');
api.undo();assert.equal(JSON.stringify(api.segments),eraseOriginal);api.redo();assert.notEqual(JSON.stringify(api.segments),eraseOriginal);

// Precrtavanje postojećeg zida ne briše njegov dio.
el('clearAll').click();el('clearAll').click();startDrawing();api.fit();
line(100,100,300,100);const beforeOverdraw=JSON.stringify(api.segments);
line(150,100,200,100);assert.equal(JSON.stringify(api.segments),beforeOverdraw);

// Završetak crtanja automatski uključuje Uredi; naredbe zidova su samo u tom načinu.
el('clearAll').click();el('clearAll').click();startDrawing();api.fit();
click(100,100);click(300,100);click(300,100);
assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(el('drawMode').attributes['aria-pressed'],'false');
assert.equal(el('wallActions').hidden,true);
click(200,100);assert.ok(api.selection);assert.equal(el('wallActions').hidden,false);
paintCalls.length=0;api.draw();assert.ok(paintCalls.some(p=>p.color==='#93c5fd'&&p.alpha===1),'Odabrani zid ima plavu ispunu');
assert.ok(paintCalls.some(p=>p.color==='#bfc3c8'&&p.alpha===.7),'Ostatak zidova je blago prigušen');
assert.ok(paintCalls.some(p=>p.color==='#f1f3f5'&&p.alpha===.9),'Oznake dimenzija ostaju čitljive');
assert.equal(el('dimensionValue').value,'400');assert.equal(el('dimensionThickness').value,'10');
click(200,100);assert.equal(el('wallActions').hidden,false);assert.equal(el('dimensionValue').value,'400');deselect();
click(200,100);assert.equal(el('wallActions').hidden,false);assert.equal(el('dimensionThickness').value,'10');deselect();
const beforeSelectionDelete=JSON.stringify(api.segments);
deselect();assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);
eraseSelection();assert.equal(JSON.stringify(api.segments),beforeSelectionDelete,'Brisanje bez odabira ništa ne radi');
click(200,100);eraseSelection();assert.equal(api.segments.length,0);api.undo();assert.equal(JSON.stringify(api.segments),beforeSelectionDelete);
startDrawing();assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);
const drawDimension=api.dimensions[0];assert.ok(drawDimension);
click((drawDimension.left+drawDimension.right)/2,(drawDimension.top+drawDimension.bottom)/2);
assert.equal(el('wallActions').hidden,true,'U crtanju nema polja uređivanja');
finishDrawing();assert.equal(api.mode,'edit');assert.equal(api.first,null);
// Tijelo zida može se povlačiti; krajnje ručke ostaju samo za duljinu.
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
enterEdit();assert.deepEqual(camera(),stableCamera);
const wallMid=api.segments[0],screenView=api.view;
click(screenView.ox+(wallMid.x1+wallMid.x2)/2*screenView.scale,screenView.oy+(wallMid.y1+wallMid.y2)/2*screenView.scale);
assert.deepEqual(camera(),stableCamera);
if(api.selection){el('dimensionValue').value='490';el('dimensionForm').submit({preventDefault(){}});assert.deepEqual(camera(),stableCamera);deselect();assert.deepEqual(camera(),stableCamera);}
api.zoomAt(.9);assert.notDeepEqual(camera(),stableCamera,'Korisnik i dalje može promijeniti zoom');

// Uređivanje privremeno zamjenjuje glavne alate na dnu.
enterEdit();const toolbarCamera={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};
api.fit();const oneWall=api.segments[0],toolView=api.view;
click(toolView.ox+(oneWall.x1+oneWall.x2)/2*toolView.scale,toolView.oy+(oneWall.y1+oneWall.y2)/2*toolView.scale);
assert.ok(api.selection);assert.equal(el('wallActions').hidden,false);assert.equal(el('mainTools').hidden,false);
deselect();assert.equal(el('wallActions').hidden,true);assert.equal(el('mainTools').hidden,false);

// Veće ručke i njihove dodirne površine prate približavanje.
enterEdit();api.fit();const gripWall=api.segments[0];
click((gripWall.x1+gripWall.x2)/2*api.view.scale,(gripWall.y1+gripWall.y2)/2*api.view.scale);
assert.ok(api.selection);const baseGrip=api.handleScale();
api.zoomAt(4,200,150);assert.ok(api.handleScale()>baseGrip);
const handleWall=api.selection,handleView=api.view;
assert.ok(api.hitHandle(handleView.ox+handleWall.x1*handleView.scale+25,handleView.oy+handleWall.y1*handleView.scale));


// Zatvaranje prostorije ili pregrade ne prekida crtanje; ponovni dodir zadnje točke prekida.
el('clearAll').click();el('clearAll').click();startDrawing();api.fit();
click(100,100);click(300,100);click(300,250);click(100,250);const closingCamera={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};click(100,100);
assert.equal(api.mode,'draw');assert.ok(api.first);assert.equal(api.model().faces.length,1);click(100,100);assert.equal(api.mode,'edit');
assert.deepEqual({scale:api.view.scale,ox:api.view.ox,oy:api.view.oy},closingCamera);
startDrawing();click(200,100);click(200,250);
assert.equal(api.mode,'draw');assert.ok(api.first);assert.equal(api.model().faces.length,2);click(200,250);assert.equal(api.mode,'edit');assert.equal(api.first,null);
api.undo();assert.equal(api.model().faces.length,1);api.redo();assert.equal(api.model().faces.length,2);
startDrawing();click(400,400);click(500,400);assert.equal(api.mode,'draw');assert.ok(api.first,'Postojeće prostorije ne završavaju nepovezani otvoreni potez');
finishDrawing();

// Olovka je prekidač Crtaj/Uredi; zidovi i olovka ostaju dostupni pri odabiru.
enterEdit();const pencilCamera={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};
el('drawMode').click();assert.equal(api.mode,'draw');assert.equal(el('drawMode').attributes['aria-pressed'],'true');
el('drawMode').click();assert.equal(api.mode,'draw');el('selectMode').click();assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(el('drawMode').attributes['aria-pressed'],'false');
assert.deepEqual({scale:api.view.scale,ox:api.view.ox,oy:api.view.oy},pencilCamera);assert.equal(el('mainTools').hidden,false);

// Dolje se prikazuje samo editor odabranog zida; glavni alati ostaju dostupni gore.
enterEdit();assert.equal(el('editorFooter').hidden,true);assert.equal(el('mainTools').hidden,false);
api.fit();const footerWall=api.segments[0],footerView=api.view;
click(footerView.ox+(footerWall.x1+footerWall.x2)/2*footerView.scale,footerView.oy+(footerWall.y1+footerWall.y2)/2*footerView.scale);
assert.ok(api.selection);assert.equal(el('editorFooter').hidden,false);assert.equal(el('mainTools').hidden,false);
deselect();assert.equal(el('editorFooter').hidden,true);assert.equal(el('mainTools').hidden,false);

// Nadogradnja dohvaća stranicu i sve tri skripte mimo cachea prije navigacije.
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 const beforeReload=JSON.stringify(api.segments);el('topMenu').open=true;updateRequests.length=0;
 await el('reloadApp').click();assert.equal(el('topMenu').open,false);
 const reloadUrl=new URL(context.window.location.href);
 assert.equal(reloadUrl.pathname,'/cadup-prt-nex/CADup.html');assert.ok(Number(reloadUrl.searchParams.get('v'))>42);
 assert.equal(updateRequests.length,6);assert.ok(updateRequests.every(request=>request.options.cache==='reload'));
 for(const file of ['room-geometry.js','grid-geometry.js','object-sketch.js','cad-objects.js','grid-app.js'])assert.ok(updateRequests.some(request=>request.url.includes(file+'?v=')));
 assert.equal(JSON.stringify(api.segments),beforeReload);assert.equal(JSON.stringify(JSON.parse(memory.get('infoa_grid_loops_v1')).segments),beforeReload);
 assert.equal(el('reloadApp').disabled,false);
 const previousUrl=context.window.location.href;
 for(const failure of ['network','http','incomplete','script']){
  updateFailure=failure;await el('reloadApp').click();assert.equal(context.window.location.href,previousUrl);
  assert.ok(el('status').textContent.includes('nije učitana'));assert.equal(el('reloadApp').disabled,false);
  assert.equal(JSON.stringify(api.segments),beforeReload,'Neuspjela nadogradnja ne gubi crtež');
 }
 updateFailure=null;
})().catch(error=>{console.error(error);process.exitCode=1;});

// Biblioteka elemenata: umetanje, izravne mjere, grupe, kopiranje i zajednički undo/redo.
el('clearAll').click();el('clearAll').click();api.fit();
api.addObject('sofa');assert.equal(api.objects.length,1);assert.equal(el('objectActions').hidden,false);assert.equal(el('wallActions').hidden,true);
assert.equal(el('objectWidth').value,'220');el('objectWidth').value='240';el('objectDepth').value='100';el('objectForm').submit({preventDefault(){}});
assert.equal(api.objects[0].width,240);clickObjectAction('rotate');assert.equal(api.objects[0].rotation,90);clickObjectAction('rotate');assert.equal(api.objects[0].rotation,180);api.undo();assert.equal(api.objects[0].rotation,90);
api.addObject('chair');assert.equal(api.objects.length,2);
let furniture=api.objects,objectView=api.view,chairPoint={x:objectView.ox+furniture[1].x*objectView.scale,y:objectView.oy+furniture[1].y*objectView.scale};
drag(chairPoint.x,chairPoint.y,chairPoint.x+100,chairPoint.y);
assert.ok(api.objects[1].x>api.objects[0].x+100);
el('objectMulti').click();objectView=api.view;click(objectView.ox+api.objects[0].x*objectView.scale,objectView.oy+api.objects[0].y*objectView.scale);
assert.equal(api.objectIds.length,2);el('objectGroup').click();assert.ok(api.objects[0].group);assert.equal(api.objects[0].group,api.objects[1].group);
const groupedFurniture=JSON.stringify(api.objects);el('objectCopy').click();assert.equal(api.objects.length,4);assert.notEqual(api.objects[2].group,api.objects[0].group);
api.undo();assert.equal(JSON.stringify(api.objects),groupedFurniture);api.redo();assert.equal(api.objects.length,4);
let groupPoint=api.objects[2];click(objectView.ox+groupPoint.x*objectView.scale,objectView.oy+groupPoint.y*objectView.scale);assert.equal(api.objectIds.length,2);
clickObjectAction('delete');assert.equal(api.objects.length,2);api.undo();assert.equal(api.objects.length,4);
api.addObject('stairs');assert.equal(api.objects.length,5);assert.equal(api.objects.at(-1).kind,'stairs');
const beforeInvalidObject=JSON.stringify(api.objects);el('objectWidth').value='0';el('objectForm').submit({preventDefault(){}});assert.equal(JSON.stringify(api.objects),beforeInvalidObject);assert.ok(el('objectError').textContent);
const beforeObjectClear=JSON.stringify(api.objects);el('clearAll').click();el('clearAll').click();assert.equal(api.objects.length,0);api.undo();assert.equal(JSON.stringify(api.objects),beforeObjectClear,'Briši sve i undo čuvaju cijelu scenu');

(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
// Undo u neprekinutom crtanju poništava segment već prvim klikom i odmah omogućuje Redo.
el('clearAll').click();el('clearAll').click();startDrawing();api.fit();
click(100,100);click(300,100);assert.equal(api.segments.length,1);assert.ok(api.first);
el('undo').click();assert.equal(api.segments.length,0);assert.equal(api.first,null);assert.equal(el('redo').disabled,false);
el('redo').click();assert.equal(api.segments.length,1);assert.equal(api.first,null);
const savedHistory=JSON.parse(memory.get('infoa_grid_loops_v1'));assert.equal(savedHistory.historyVersion,1);assert.ok(savedHistory.past.length);
// Ponovno pokretanje aplikacije učitava istu povijest.
vm.runInContext(source,context);assert.equal(context.api.segments.length,1);assert.equal(el('undo').disabled,false);
el('undo').click();assert.equal(context.api.segments.length,0);assert.equal(el('redo').disabled,false);
vm.runInContext(source,context);assert.equal(el('redo').disabled,false);el('redo').click();assert.equal(context.api.segments.length,1);

})().catch(error=>{console.error(error);process.exitCode=1;});

// Predmeti se i uz rub pomiču, bez promjene dimenzija povlačenjem.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('sofa');
const furnitureBefore={...api.objects[0]},furnitureView=api.view;
const corner={x:furnitureView.ox+(furnitureBefore.x+furnitureBefore.width/2-2)*furnitureView.scale,y:furnitureView.oy+(furnitureBefore.y+furnitureBefore.depth/2-2)*furnitureView.scale};
drag(corner.x,corner.y,corner.x+40,corner.y+40);
assert.equal(api.objects[0].width,furnitureBefore.width);assert.equal(api.objects[0].depth,furnitureBefore.depth);
assert.ok(api.objects[0].x>furnitureBefore.x);assert.ok(api.objects[0].y>furnitureBefore.y);
el('objectWidth').value='300';el('objectForm').submit({preventDefault(){}});assert.equal(api.objects[0].width,300,'Unos dimenzija u panelu ostaje dostupan');
// Glavni meniji i podmeniji međusobno zatvaraju prethodni odabir.
el('topMenu').open=true;el('objectMenu').open=true;el('objectMenu').toggle();assert.equal(el('topMenu').open,false);
el('topMenu').open=true;el('topMenu').toggle();assert.equal(el('objectMenu').open,false);
const menuSibling={tagName:'DETAILS',open:true},menuTarget={tagName:'DETAILS',open:true,parentElement:{children:[]}};menuTarget.parentElement.children=[menuTarget,menuSibling];
el('objectLibrary').toggle({target:menuTarget});assert.equal(menuSibling.open,false);

// Upisana mjera čeka prvi klik izvan polja, zatim se primjenjuje u jednom Undo koraku.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('sofa');
context.document.activeElement=el('objectWidth');el('objectForm').focusin({target:{tagName:'INPUT'}});
for(const value of ['3','30','300','300,','300,5']){el('objectWidth').value=value;el('objectForm').input({preventDefault(){}});assert.equal(el('objectWidth').value,value);}
assert.equal(api.objects[0].width,220,'Tijekom tipkanja crtež se ne mijenja');context.document.pointerdown({target:{closest:()=>null}});assert.equal(api.objects[0].width,300.5);el('objectForm').focusout();context.document.activeElement=null;
api.undo();assert.equal(api.objects[0].width,220,'Jedan Undo poništi cijelo upisivanje');api.redo();assert.equal(api.objects[0].width,300.5);
el('clearAll').click();el('clearAll').click();line(100,100,300,100);click(200,100);
context.document.activeElement=el('dimensionValue');el('dimensionForm').focusin({target:{tagName:'INPUT'}});
for(const value of ['100','200','350']){el('dimensionValue').value=value;el('dimensionForm').input({preventDefault(){}});assert.equal(el('wallActions').hidden,false);assert.equal(el('dimensionValue').value,value);}
assert.equal(api.segments[0].x2-api.segments[0].x1,400);context.document.pointerdown({target:{closest:()=>null}});assert.equal(api.segments[0].x2-api.segments[0].x1,350);el('dimensionForm').focusout();context.document.activeElement=null;
api.undo();assert.equal(api.segments[0].x2-api.segments[0].x1,400);api.redo();assert.equal(api.segments[0].x2-api.segments[0].x1,350);

// Imenovana grupa sprema se na kraj Custom biblioteke i ponovno se umeće kao zasebna grupa.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('sofa');api.addObject('chair');
let customView=api.view,customChair=api.objects[1];drag(customView.ox+customChair.x*customView.scale,customView.oy+customChair.y*customView.scale,customView.ox+customChair.x*customView.scale+120,customView.oy+customChair.y*customView.scale);
el('objectMulti').click();click(customView.ox+api.objects[0].x*customView.scale,customView.oy+api.objects[0].y*customView.scale);el('objectGroup').click();
assert.equal(api.objectIds.length,2);el('saveCustom').click();assert.equal(el('customSaveForm').hidden,false);
el('customName').value='Kutak <A>';el('customSaveForm').submit({preventDefault(){}});
assert.equal(api.customLibrary.length,1);assert.equal(api.customLibrary[0].name,'Kutak <A>');assert.ok(el('objectLibrary').innerHTML.includes('Kutak &lt;A&gt;'));
assert.equal(JSON.parse(memory.get('cadup_custom_library_v1')).length,1);assert.equal(el('customSaveForm').hidden,true);
const customTemplate=api.customLibrary[0];api.addCustomObject(customTemplate.id);assert.equal(api.objects.length,4);assert.equal(api.objectIds.length,2);
assert.notEqual(api.objects[2].group,api.objects[0].group);assert.equal(api.objects[2].group,api.objects[3].group);
el('saveCustom').click();el('customName').value='Kutak <A>';el('customSaveForm').submit({preventDefault(){}});assert.equal(api.customLibrary.length,1,'Isto ime se ne prepisuje');

// Zid na T spoju uređuje se po segmentima, uz unutarnje kote između pregrada.
el('clearAll').click();el('clearAll').click();api.fit();
line(100,100,200,100);line(200,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
enterEdit();click(150,100);assert.equal(api.selection.x1,200);assert.equal(api.selection.x2,400);assert.equal(el('dimensionValue').value,'180');
assert.equal(api.model().faces.length,2);assert.ok(api.dimensions.some(r=>r.dimension.axis==='h'&&r.dimension.end-r.dimension.start===180),'Kote između zidova ostaju vidljive');
assert.ok(labels.includes('180 cm'));
el('dimensionThickness').value='20';el('dimensionForm').submit({preventDefault(){}});
assert.ok(api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1===200&&s.x2===400&&s.thickness===20));

// Uhvaćena ručka skriva se tijekom povlačenja i vraća pri puštanju.
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();click(200,100);
wallGrips.length=0;paintCalls.length=0;api.draw();assert.equal(wallGrips.length,2);assert.ok(!paintCalls.some(p=>p.color==='rgba(255,255,255,0.35)'),'Vrhovi strelica nemaju kružnu podlogu koja bi prekrila čvor');
wallGrips.length=0;board.pointerdown(event(300,100));assert.equal(wallGrips.length,1,'Uhvaćena ručka je odmah skrivena');
wallGrips.length=0;board.pointermove(event(350,100));assert.equal(wallGrips.length,1);assert.ok(api.segments.some(s=>s.x2===700));
wallGrips.length=0;board.pointerup(event(350,100));assert.equal(wallGrips.length,2,'Nakon puštanja su opet vidljive obje ručke');
wallGrips.length=0;board.pointerdown(event(350,100));board.pointercancel(event(350,100));assert.ok(wallGrips.length>=2,'Prekid također vraća ručke');

// Pomoćne linije hvataju i ne-mrežne koordinate preko cijelog crteža.
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();click(200,100);
el('dimensionValue').value='333';el('dimensionForm').submit({preventDefault(){}});assert.ok(api.segments.some(s=>s.x2===533));
startDrawing();const guideView=api.view,aligned=api.snap(guideView.ox+541*guideView.scale,guideView.oy+800*guideView.scale);
assert.equal(aligned.x,533,'Snap na produžetak krajnje točke mimo osnovne mreže');
click(100,300);assert.ok(api.guideAxes().x.includes(533));assert.ok(api.guideAxes().y.includes(600));
click(guideView.ox+541*guideView.scale,guideView.oy+600*guideView.scale);
assert.ok(api.segments.some(s=>s.y1===600&&s.y2===600&&s.x2===533));assert.equal(api.model().faces.length,0,'Pomoćna linija ne postaje stvarni zid');
finishDrawing();

// Crvene osnovne linije vide se i tijekom crtanja; plave pomoćne osi ostaju dostupne.
startDrawing();redStrokes=0;api.draw();assert.ok(redStrokes>0,'Osnovne linije su crvene i u načinu Crtaj');assert.ok(api.guideAxes().x.length>0);finishDrawing();

// Krajnja ručka hvata točnu crvenu osnovnu liniju drugog zida mimo mreže.
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();click(200,100);
el('dimensionValue').value='333';el('dimensionForm').submit({preventDefault(){}});
startDrawing();click(270.5,200);click(270.5,400);finishDrawing();assert.ok(api.segments.some(s=>s.x1===533&&s.x2===533));
line(100,300,200,300);enterEdit();click(150,300);drag(200,300,270.5,300);
assert.ok(api.segments.some(s=>s.y1===600&&s.y2===600&&s.x2===533),'Ručka sjeda na osnovnu liniju, ne na 550 cm mreže');
assert.ok(api.model().layout.physicalJoints.some(j=>j.x===533&&j.y===600),'Nakon snap-a nastaje točan spoj osnovnih linija');
// Pomicanje zida hvata istu točnu koordinatu završetka druge osnovne linije.
el('clearAll').click();el('clearAll').click();line(100,100,100,300);enterEdit();click(100,200);el('dimensionValue').value='333';el('dimensionForm').submit({preventDefault(){}});
line(200,400,300,400);enterEdit();click(250,400);drag(250,400,250,270.5);
assert.ok(api.segments.some(s=>s.y1===533&&s.y2===533&&s.x1===400&&s.x2===600));

// Gumica briše odmah jednim klikom, ali samo dio između presjeka.
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
const beforeSpanErase=JSON.stringify(api.segments);el('eraseMode').click();assert.equal(api.mode,'erase');click(150,100);
assert.ok(!api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1<400));assert.ok(api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1===400));
api.undo();assert.equal(JSON.stringify(api.segments),beforeSpanErase);click(450,400);assert.equal(JSON.stringify(api.segments),beforeSpanErase);assert.equal(api.mode,'edit');el('eraseMode').click();
board.pointerdown(event(150,100));board.pointermove(event(150,150));board.pointerup(event(150,100));assert.equal(JSON.stringify(api.segments),beforeSpanErase,'Povlačenje ne briše');
board.pointerdown(event(150,100));board.pointercancel(event(150,100));assert.equal(JSON.stringify(api.segments),beforeSpanErase);el('selectMode').click();assert.equal(api.mode,'edit');

// Potvrđeni čvor na križanju je vidljiv i ima prednost pri snap-u.
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();click(200,100);el('dimensionValue').value='333';el('dimensionForm').submit({preventDefault(){}});
line(100,300,400,300);startDrawing();click(270.5,200);click(270.5,450);finishDrawing();
assert.ok(api.model().junctions.some(n=>n.x===533&&n.y===600&&n.degree===4));
startDrawing();const junctionSnap=api.snap(275.5,309);assert.equal(junctionSnap.x,533);assert.equal(junctionSnap.y,600);
paintCalls.length=0;api.draw();assert.ok(paintCalls.some(p=>p.color==='#dc2626'),'Spoj je označen crvenim kružićem');click(275.5,309);assert.equal(api.first.x,533);assert.equal(api.first.y,600);finishDrawing();

// Gumica briše objekte i grupe jednim dodirom; prazan klik vraća Uredi.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('sofa');const eraseObjectBefore=JSON.stringify(api.objects),eraseView=api.view;
let eraseItem=api.objects[0],erasePoint={x:eraseView.ox+eraseItem.x*eraseView.scale,y:eraseView.oy+eraseItem.y*eraseView.scale};el('eraseMode').click();click(erasePoint.x,erasePoint.y);assert.equal(api.objects.length,0);assert.equal(api.mode,'erase');api.undo();assert.equal(JSON.stringify(api.objects),eraseObjectBefore);
click(15,700);assert.equal(api.mode,'edit');assert.equal(el('eraseMode').attributes['aria-pressed'],'false');
el('clearAll').click();el('clearAll').click();api.addCustomObject(api.customLibrary[0].id);assert.equal(api.objects.length,2);
const eraseGroupBefore=JSON.stringify(api.objects),groupPoints=api.objects.map(item=>({x:api.view.ox+item.x*api.view.scale,y:api.view.oy+item.y*api.view.scale}));
el('eraseMode').click();click(groupPoints[0].x,groupPoints[0].y);assert.equal(api.objects.length,0);api.undo();assert.equal(JSON.stringify(api.objects),eraseGroupBefore);
el('selectMode').click();click(groupPoints[0].x,groupPoints[0].y);el('objectUngroup').click();assert.ok(api.objects.every(item=>!item.group));
el('eraseMode').click();click(groupPoints[1].x,groupPoints[1].y);assert.equal(api.objects.length,1);api.undo();assert.equal(api.objects.length,2);
// Trenutačni potez je plav, a potvrđene osi ostaju crvene.
el('clearAll').click();el('clearAll').click();startDrawing();click(100,100);blueDraftStrokes=0;board.pointermove(event(200,100));assert.ok(blueDraftStrokes>0);finishDrawing();

// Zasebna tipka briše predmet odmah; Undo ga vraća.
api.addObject('chair');const deleteButtonBefore=JSON.stringify(api.objects);clickObjectAction('delete');assert.equal(api.objects.length,0);api.undo();assert.equal(JSON.stringify(api.objects),deleteButtonBefore);

// Selected wall editor deletes immediately and supports Undo.
el('clearAll').click();el('clearAll').click();line(100,100,300,100);enterEdit();click(200,100);
const beforeEditDelete=JSON.stringify(api.segments);el('wallDelete').click();assert.equal(api.segments.length,0);api.undo();assert.equal(JSON.stringify(api.segments),beforeEditDelete);

// Pan on blank canvas never edits geometry, scales, or adds an undo entry.
el('clearAll').click();el('clearAll').click();api.fit();enterEdit();
const panBefore={...api.view},panScene=JSON.stringify(api.segments);drag(500,500,580,560);
assert.equal(api.view.ox,panBefore.ox+80);assert.equal(api.view.oy,panBefore.oy+60);assert.equal(api.view.scale,panBefore.scale);assert.equal(JSON.stringify(api.segments),panScene);
const afterPan={...api.view};click(500,500);assert.deepEqual({...api.view},afterPan,'Tap does not pan');
el('eraseMode').click();drag(500,500,470,460);assert.equal(api.mode,'erase');assert.equal(api.view.ox,afterPan.ox-30);assert.equal(api.view.oy,afterPan.oy-40);click(500,500);assert.equal(api.mode,'edit');

// Open a group, edit one member, duplicate inside it, and close without ungrouping.
el('clearAll').click();el('clearAll').click();api.fit();api.addCustomObject(api.customLibrary[0].id);
const groupMembers=JSON.parse(JSON.stringify(api.objects)),member=groupMembers[0],otherMember=groupMembers[1],groupView=api.view,groupCamera={...api.view};
assert.equal(api.objectIds.length,2);api.openGroupEditor(api.objects.find(item=>api.objectIds.includes(item.id)).group);assert.ok(api.editingGroup);assert.equal(api.objectIds.length,0);assert.equal(el('objectActions').hidden,false);
click(groupView.ox+member.x*groupView.scale,groupView.oy+member.y*groupView.scale);assert.equal(api.objectIds.length,1);assert.equal(api.objectIds[0],member.id);
el('objectWidth').value=String(member.width+20);el('objectForm').submit({preventDefault(){}});assert.equal(api.objects.find(o=>o.id===member.id).width,member.width+20);assert.equal(JSON.stringify(api.objects.find(o=>o.id===otherMember.id)),JSON.stringify(otherMember));
el('objectCopy').click();assert.equal(api.objects.length,3);assert.ok(api.objects.every(o=>o.group===member.group));api.undo();assert.equal(api.objects.length,2);assert.ok(api.editingGroup);
click(990,790);assert.equal(api.editingGroup,null);assert.equal(api.objectIds.length,2);assert.deepEqual({...api.view},groupCamera);

// View settings hide only the grid and labels; measures remain editable.
const viewSettingsCamera={...api.view},viewSettingsScene=JSON.stringify(api.segments);
el('showGrid').checked=false;el('showGrid').change();gridLines.length=0;api.draw();assert.equal(gridLines.length,0);
el('showMeasures').checked=false;el('showMeasures').change();el('showOverallMeasures').checked=false;el('showOverallMeasures').change();labels.length=0;api.draw();assert.equal(labels.length,0);assert.equal(api.dimensions.length,0);
assert.deepEqual(JSON.parse(memory.get('cadup_view_settings_v1')),{grid:false,measures:false,overallMeasures:false,rotation:0,autoFullscreen:true,continuousDrawing:true});assert.deepEqual({...api.view},viewSettingsCamera);assert.equal(JSON.stringify(api.segments),viewSettingsScene);
el('showGrid').checked=true;el('showGrid').change();gridLines.length=0;api.draw();assert.ok(gridLines.length);
el('showMeasures').checked=true;el('showMeasures').change();

// An unselected object or wall pans on drag, then requires a separate tap before editing.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('drawer-cabinet');deselect();
let selectionPanView={...api.view},selectionPanObject=api.objects[0],selectionPanScene=JSON.stringify(api.objects),selectionPanSaved=memory.get('infoa_grid_loops_v1');
let selectionPanPoint={x:selectionPanView.ox+selectionPanObject.x*selectionPanView.scale,y:selectionPanView.oy+selectionPanObject.y*selectionPanView.scale};
drag(selectionPanPoint.x,selectionPanPoint.y,selectionPanPoint.x+40,selectionPanPoint.y+20);
assert.equal(JSON.stringify(api.objects),selectionPanScene);assert.equal(memory.get('infoa_grid_loops_v1'),selectionPanSaved);assert.equal(api.objectIds.length,0);assert.equal(api.view.ox,selectionPanView.ox+40);assert.equal(api.view.oy,selectionPanView.oy+20);assert.equal(api.view.scale,selectionPanView.scale);
selectionPanView={...api.view};selectionPanPoint={x:selectionPanView.ox+selectionPanObject.x*selectionPanView.scale,y:selectionPanView.oy+selectionPanObject.y*selectionPanView.scale};click(selectionPanPoint.x,selectionPanPoint.y);assert.equal(api.objectIds.length,1);
drag(selectionPanPoint.x,selectionPanPoint.y,selectionPanPoint.x+50,selectionPanPoint.y);assert.notEqual(JSON.stringify(api.objects),selectionPanScene);assert.deepEqual({...api.view},selectionPanView);
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();const wallPanScene=JSON.stringify(api.segments),wallPanView={...api.view};drag(200,100,220,120);assert.equal(JSON.stringify(api.segments),wallPanScene);assert.equal(api.selection,null);assert.equal(api.view.ox,wallPanView.ox+20);assert.equal(api.view.oy,wallPanView.oy+20);
click(220,120);assert.ok(api.selection);const selectedPanView={...api.view};drag(220,120,220,160);assert.notEqual(JSON.stringify(api.segments),wallPanScene);assert.deepEqual({...api.view},selectedPanView);

// Double tap opens the group; one outside tap closes it.
el('clearAll').click();el('clearAll').click();api.fit();api.addCustomObject(api.customLibrary[0].id);
const doubleGroupMember=api.objects[0],doubleGroupView={...api.view},doubleGroupScene=memory.get('infoa_grid_loops_v1');
const doubleGroupPoint={x:doubleGroupView.ox+doubleGroupMember.x*doubleGroupView.scale,y:doubleGroupView.oy+doubleGroupMember.y*doubleGroupView.scale};
function timedTap(x,y,time){board.pointerdown({...event(x,y),timeStamp:time-30});board.pointerup({...event(x,y),timeStamp:time});}
timedTap(doubleGroupPoint.x,doubleGroupPoint.y,1000);assert.equal(api.editingGroup,null);timedTap(doubleGroupPoint.x,doubleGroupPoint.y,1200);assert.ok(api.editingGroup);assert.equal(api.objectIds.length,0);
timedTap(doubleGroupPoint.x,doubleGroupPoint.y,1700);timedTap(doubleGroupPoint.x,doubleGroupPoint.y,1900);assert.ok(api.editingGroup);
timedTap(990,790,2500);assert.equal(api.editingGroup,null);assert.equal(api.objectIds.length,2);assert.equal(memory.get('infoa_grid_loops_v1'),doubleGroupScene);assert.deepEqual({...api.view},doubleGroupView);

// A single selection exposes exactly two resize grips; no double tap is needed.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('drawer-cabinet');let gripObject=api.objects[0],gripView={...api.view};deselect();assert.equal(api.objectHandles().length,0);
timedTap(gripView.ox+gripObject.x*gripView.scale,gripView.oy+gripObject.y*gripView.scale,4000);assert.equal(api.objectHandles().length,2);
let objectWidthGrip=api.objectHandles().find(h=>h.axis==='width');drag(objectWidthGrip.x,objectWidthGrip.y,objectWidthGrip.x+20,objectWidthGrip.y);assert.equal(api.objects[0].width,100);assert.equal(api.objects[0].depth,60);assert.deepEqual({...api.view},gripView);
let objectDepthGrip=api.objectHandles().find(h=>h.axis==='depth');drag(objectDepthGrip.x,objectDepthGrip.y,objectDepthGrip.x,objectDepthGrip.y+15);assert.equal(api.objects[0].depth,90);assert.equal(api.objects[0].width,100);api.undo();assert.equal(api.objects[0].depth,60);assert.equal(api.objectHandles().length,2);api.undo();assert.equal(api.objects[0].width,60);assert.equal(api.objects[0].depth,60);deselect();assert.equal(api.objectHandles().length,0);

// Remove a saved Custom definition without deleting or editing its placed instances.
const customDeleteId=api.customLibrary[0].id,customDeleteScene=memory.get('infoa_grid_loops_v1'),customDeleteCamera={...api.view};
assert.ok(el('objectLibrary').innerHTML.includes('data-delete-custom="'+customDeleteId+'"'));
el('objectMenu').click({target:{closest:()=>({dataset:{deleteCustom:customDeleteId}})}});
assert.equal(api.customLibrary.length,1,'Prvi klik samo trazi potvrdu');
el('objectMenu').open=false;el('objectMenu').toggle();
el('objectMenu').click({target:{closest:()=>({dataset:{deleteCustom:customDeleteId}})}});
assert.equal(api.customLibrary.length,1,'Zatvaranje biblioteke ponistava potvrdu');
el('objectMenu').click({target:{closest:()=>({dataset:{deleteCustom:customDeleteId}})}});
assert.equal(api.customLibrary.length,0);assert.equal(JSON.parse(memory.get('cadup_custom_library_v1')).length,0);assert.equal(memory.get('infoa_grid_loops_v1'),customDeleteScene);assert.deepEqual({...api.view},customDeleteCamera);assert.ok(!el('objectLibrary').innerHTML.includes('data-delete-custom="'+customDeleteId+'"'));

// Viewport quarter turns preserve scene and zoom, and invert pointer coordinates exactly.
const rotationScene=memory.get('infoa_grid_loops_v1'),rotationCamera={...api.view};
for(let turn=1;turn<=4;turn++){
 el('viewportRotate').click();assert.equal(api.viewportTurns,turn%4);assert.deepEqual({...api.view},rotationCamera);assert.equal(memory.get('infoa_grid_loops_v1'),rotationScene);
 const p={x:137,y:259},display=api.displayPoint(p),inverse=api.displayPoint(display,true);assert.equal(inverse.x,p.x);assert.equal(inverse.y,p.y);
 assert.equal(api.viewBounds().width,turn%2?api.view.h:api.view.w);assert.equal(api.viewBounds().height,turn%2?api.view.w:api.view.h);
}
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('drawer-cabinet');drag(500,400,600,400);const rotatedObject=JSON.parse(JSON.stringify(api.objects[0]));deselect();el('viewportRotate').click();
const projectedObject=api.displayPoint({x:api.view.ox+rotatedObject.x*api.view.scale,y:api.view.oy+rotatedObject.y*api.view.scale});click(projectedObject.x,projectedObject.y);assert.equal(api.objectIds[0],rotatedObject.id);
const rotatedDragCamera={...api.view};drag(projectedObject.x,projectedObject.y,projectedObject.x+40,projectedObject.y);assert.equal(api.objects[0].x,rotatedObject.x);assert.ok(api.objects[0].y<rotatedObject.y);assert.deepEqual({...api.view},rotatedDragCamera);

// All hidden dimensions appear temporarily while editing a wall.
while(api.viewportTurns)el('viewportRotate').click();el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);line(100,300,250,300);enterEdit();
el('showMeasures').checked=false;el('showMeasures').change();el('showOverallMeasures').checked=false;el('showOverallMeasures').change();labels.length=0;api.draw();assert.equal(labels.length,0);
click(200,100);labels.length=0;api.draw();assert.ok(labels.includes('400 cm'));assert.ok(labels.includes('300 cm'));assert.equal(el('showMeasures').checked,false);assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).measures,false);
deselect();labels.length=0;api.draw();assert.equal(labels.length,0);

// Rotation and fullscreen preferences survive other setting changes; viewport changes are not scene edits.
const rememberedScene=memory.get('infoa_grid_loops_v1');el('viewportRotate').click();assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).rotation,1);
el('showGrid').checked=false;el('showGrid').change();assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).rotation,1);
el('autoFullscreen').checked=false;el('autoFullscreen').change();assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).autoFullscreen,false);assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).rotation,1);assert.equal(memory.get('infoa_grid_loops_v1'),rememberedScene);

// An off-axis tap stops drawing without projecting or committing an unwanted wall.
while(api.viewportTurns)el('viewportRotate').click();el('clearAll').click();el('clearAll').click();api.fit();startDrawing();click(100,100);click(300,100);const beforeOffAxis=JSON.stringify(api.segments),beforeOffAxisCamera={...api.view};click(400,200);assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(JSON.stringify(api.segments),beforeOffAxis);assert.deepEqual({...api.view},beforeOffAxisCamera);
startDrawing();click(400,300);click(500,306);assert.equal(api.mode,'draw');assert.ok(api.segments.some(s=>s.y1===600&&s.y2===600&&s.x1===800&&s.x2===1000));finishDrawing();
// The same orthogonal rule works after rotating the viewport.
el('viewportRotate').click();startDrawing();const startDisplay=api.displayPoint({x:200,y:200});click(startDisplay.x,startDisplay.y);const beforeRotatedOffAxis=JSON.stringify(api.segments),diagonalDisplay=api.displayPoint({x:300,y:300});click(diagonalDisplay.x,diagonalDisplay.y);assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(JSON.stringify(api.segments),beforeRotatedOffAxis);

// Continuous drawing is optional: off finishes a single wall, on keeps its endpoint active.
while(api.viewportTurns)el('viewportRotate').click();el('clearAll').click();el('clearAll').click();api.fit();el('continuousDrawing').checked=false;el('continuousDrawing').change();startDrawing();click(100,100);click(300,100);assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(api.segments.length,1);assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).continuousDrawing,false);
el('continuousDrawing').checked=true;el('continuousDrawing').change();startDrawing();click(100,300);click(300,300);assert.equal(api.mode,'draw');assert.ok(api.first);finishDrawing();

// Camera gestures preserve the selected editor; an actual blank tap still deselects.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('window');const keptWindow=api.objects[0],keptWindowScene=memory.get('infoa_grid_loops_v1');
board.pointerdown(event(750,650));assert.equal(api.objectIds[0],keptWindow.id);assert.equal(el('objectActions').hidden,false);board.pointermove(event(790,690));board.pointerup(event(790,690));assert.equal(api.objectIds[0],keptWindow.id);assert.equal(api.objectHandles().length,2);assert.equal(memory.get('infoa_grid_loops_v1'),keptWindowScene);
board.pointerdown(event(750,650,1));board.pointerdown(event(850,650,2));board.pointermove(event(900,650,2));board.pointerup(event(900,650,2));board.pointerup(event(750,650,1));assert.equal(api.objectIds[0],keptWindow.id);assert.equal(el('objectActions').hidden,false);assert.equal(api.objectHandles().length,2);assert.equal(memory.get('infoa_grid_loops_v1'),keptWindowScene);
board.wheel({clientX:750,clientY:650,deltaY:-1,preventDefault(){}});assert.equal(api.objectIds[0],keptWindow.id);assert.equal(el('objectActions').hidden,false);el('plus').click();assert.equal(api.objectIds[0],keptWindow.id);deselect();assert.equal(api.objectIds.length,0);assert.equal(el('objectActions').hidden,true);
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();click(200,100);const keptWall=JSON.stringify(api.selection),keptWallScene=memory.get('infoa_grid_loops_v1');drag(700,600,740,630);assert.equal(JSON.stringify(api.selection),keptWall);assert.equal(el('wallActions').hidden,false);
board.pointerdown(event(700,600,1));board.pointerdown(event(800,600,2));board.pointermove(event(850,600,2));board.pointerup(event(850,600,2));board.pointerup(event(700,600,1));assert.equal(JSON.stringify(api.selection),keptWall);assert.equal(el('wallActions').hidden,false);assert.equal(memory.get('infoa_grid_loops_v1'),keptWallScene);deselect();assert.equal(api.selection,null);assert.equal(el('wallActions').hidden,true);

// Canvas actions stay at screen corners and share Mirror/Rotate undo semantics.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');const actionObject=JSON.parse(JSON.stringify(api.objects[0])),actionCamera={...api.view};assert.equal(api.objectViewportActions().length,5);
let mirrorCorner=api.objectViewportActions().find(a=>a.action==='mirror'),rotateCorner=api.objectViewportActions().find(a=>a.action==='rotate');assert.ok(mirrorCorner.screenX>rotateCorner.screenX);assert.equal(mirrorCorner.screenY,rotateCorner.screenY);click(mirrorCorner.x,mirrorCorner.y);assert.equal(api.objects[0].mirrored,true);assert.equal(api.objects[0].rotation,actionObject.rotation);assert.deepEqual({...api.view},actionCamera);
rotateCorner=api.objectViewportActions().find(a=>a.action==='rotate');click(rotateCorner.x,rotateCorner.y);assert.equal(api.objects[0].rotation,90);api.undo();assert.equal(api.objects[0].rotation,0);api.undo();assert.equal(api.objects[0].mirrored,undefined);
el('viewportRotate').click();mirrorCorner=api.objectViewportActions().find(a=>a.action==='mirror');rotateCorner=api.objectViewportActions().find(a=>a.action==='rotate');assert.ok(mirrorCorner.screenX>rotateCorner.screenX);assert.equal(mirrorCorner.screenY,rotateCorner.screenY);const displayedMirror=api.displayPoint(mirrorCorner);click(displayedMirror.x,displayedMirror.y);assert.equal(api.objects[0].mirrored,true);assert.equal(api.objects[0].rotation,0);

// Active canvas actions do not inherit the dimmed group's background opacity.
paintCalls.length=0;canvas.globalAlpha=.2;api.drawObjectViewportActions();const activeActionFills=paintCalls.filter(p=>p.color==='rgba(255,255,255,0.96)');assert.equal(activeActionFills.length,5);assert.ok(activeActionFills.every(p=>p.alpha===1));

for(const [id,mode] of [['selectMode','edit'],['drawMode','draw'],['eraseMode','erase'],['selectMode','edit']]){el(id).click();el(id).click();assert.equal(api.mode,mode);assert.equal(['selectMode','drawMode','eraseMode'].filter(key=>el(key).attributes['aria-pressed']==='true').length,1);}

// Transform controls retain their positions through mirror and quarter turns.
while(api.viewportTurns)el('viewportRotate').click();
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');
const controlPositions=()=>JSON.stringify({handles:api.objectHandles().map(h=>({x:h.x,y:h.y})),actions:api.objectViewportActions().map(a=>({x:a.x,y:a.y}))});
const fixedControls=controlPositions();
clickObjectAction('mirror');assert.equal(controlPositions(),fixedControls);
for(let turn=0;turn<4;turn++){clickObjectAction('rotate');assert.equal(controlPositions(),fixedControls);}
clickObjectAction('rotate');
const stableRight=api.objectHandles().find(h=>h.nx===1),beforeDepth=api.objects[0].depth;
drag(stableRight.x,stableRight.y,stableRight.x+20,stableRight.y);assert.ok(api.objects[0].depth>beforeDepth);

// Zoom out fits the full model on wide desktops and rotated viewports.
for(const [width,height] of [[1400,700],[400,800]]){
 board.clientWidth=width;board.clientHeight=height;api.resize();
 for(let turn=0;turn<4;turn++){
  api.zoomAt(.001);const view=api.view,bounds=api.viewBounds();
  assert.ok(view.scale*2000<=bounds.width+1e-8);assert.ok(view.scale*2000<=bounds.height+1e-8);
  assert.ok(view.ox>=bounds.left-1e-8&&view.ox+2000*view.scale<=bounds.right+1e-8);
  assert.ok(view.oy>=bounds.top-1e-8&&view.oy+2000*view.scale<=bounds.bottom+1e-8);
  el('viewportRotate').click();
 }
}
board.clientWidth=1000;board.clientHeight=800;api.resize();api.fit();

// Selection panels replace the mode bar; duplication is available on the canvas.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');
assert.equal(el('modeTools').hidden,true);assert.equal(el('editorFooter').hidden,false);
clickObjectAction('duplicate');assert.equal(api.objects.length,2);
deselect();assert.equal(el('modeTools').hidden,false);assert.equal(el('editorFooter').hidden,true);

api.addObject('desk');assert.equal(el('objectGroupMenu').hidden,true);
el('objectMulti').click();assert.equal(el('objectGroupMenu').hidden,true);
el('objectMulti').click();assert.equal(el('objectGroupMenu').hidden,true);
deselect();assert.equal(el('modeTools').hidden,false);

// Multi selection only offers grouping; a selected group offers delete and ungroup.
api.addObject('desk');el('objectMulti').click();
assert.equal(el('objectForm').hidden,true);
assert.equal(el('objectGroup').hidden,false);assert.equal(el('objectUngroup').hidden,true);
el('objectMulti').click();
// Use an isolated scene to create a group without overlapping hit targets.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');drag(500,400,650,400);api.addObject('chair');
el('objectMulti').click();click(650,400);el('objectGroup').click();
assert.equal(api.objectIds.length,2);assert.equal(el('objectForm').hidden,false);
assert.equal(el('objectGroup').hidden,true);
assert.equal(el('objectUngroup').hidden,false);assert.equal(el('objectGroupMenu').hidden,true);
el('objectUngroup').click();assert.ok(api.objects.every(item=>!item.group));
deselect();

// Size grips stay right/bottom on screen; action icons share a row above the object.
el('clearAll').click();el('clearAll').click();api.addObject('desk');
for(let turn=0;turn<4;turn++){
 const actions=api.objectViewportActions();assert.deepEqual(Array.from(actions,a=>a.action),['delete','rotate','mirror','duplicate','multi']);
 assert.ok(actions.every(a=>a.screenY===actions[0].screenY));
 const item=api.objects[0],center=api.displayPoint({x:api.view.ox+item.x*api.view.scale,y:api.view.oy+item.y*api.view.scale});
 const grips=api.objectHandles().map(h=>api.displayPoint(h));
 assert.ok(grips[0].x>center.x);assert.ok(Math.abs(grips[0].y-center.y)<1e-7);
 assert.ok(grips[1].y>center.y);assert.ok(Math.abs(grips[1].x-center.x)<1e-7);
 el('viewportRotate').click();
}
clickObjectAction('delete');assert.equal(api.objects.length,0);api.undo();assert.equal(api.objects.length,1);
deselect();

// Holding an object starts selection, preserves it on release, and exposes group grips.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');drag(500,400,650,400);api.addObject('chair');deselect();
board.pointerdown(event(650,400));holdTimers.splice(0).forEach(fn=>fn());
assert.equal(el('objectMulti').attributes['aria-pressed'],'true');assert.equal(api.objectIds.length,1);
board.pointerup(event(650,400));assert.equal(api.objectIds.length,1);
click(500,400);assert.equal(api.objectIds.length,2);
assert.ok(api.objectViewportActions().some(a=>a.action==='group'));
clickObjectAction('group');assert.ok(api.objects[0].group);assert.equal(api.objects[0].group,api.objects[1].group);
assert.ok(api.objectViewportActions().some(a=>a.action==='ungroup'));
clickObjectAction('ungroup');assert.ok(api.objects.every(item=>!item.group));
deselect();board.pointerdown(event(650,400));board.pointermove(event(700,400));holdTimers.splice(0).forEach(fn=>fn());
assert.equal(el('objectMulti').attributes['aria-pressed'],'false');board.pointerup(event(700,400));deselect();

// The plus grip toggles multi selection from the object toolbar.
api.addObject('desk');clickObjectAction('multi');
assert.equal(el('objectMulti').attributes['aria-pressed'],'true');
assert.equal(el('objectForm').hidden,true);
clickObjectAction('multi');assert.equal(el('objectMulti').attributes['aria-pressed'],'false');
deselect();

// Group dimensions and resize grips scale all members without breaking membership.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');drag(500,400,650,400);api.addObject('chair');
clickObjectAction('multi');click(650,400);clickObjectAction('group');
const sizeGroupId=api.objects[0].group,oldGroupWidth=Number(el('objectWidth').value.replace(',','.'));
assert.equal(el('objectForm').hidden,false);assert.equal(api.objectHandles().length,2);
el('objectWidth').value=String(oldGroupWidth+100);el('objectForm').submit({preventDefault(){}});
assert.equal(Number(el('objectWidth').value.replace(',','.')),oldGroupWidth+100);
assert.ok(api.objects.every(item=>item.group===sizeGroupId));
const groupGrip=api.objectHandles().find(handle=>handle.axis==='width');
const beforeGroupGrip=Number(el('objectWidth').value.replace(',','.'));
drag(groupGrip.x,groupGrip.y,groupGrip.x+20,groupGrip.y);
assert.ok(Number(el('objectWidth').value.replace(',','.'))>beforeGroupGrip);
assert.ok(api.objects.every(item=>item.group===sizeGroupId));api.undo();
assert.ok(Math.abs(context.CadObjects.selectionBounds(api.objects).width-beforeGroupGrip)<1e-7);deselect();

// Group existing groups and loose objects, then edit and ungroup one level at a time.
el('clearAll').click();el('clearAll').click();api.fit();
api.addObject('desk');drag(500,400,200,300);api.addObject('chair');drag(500,400,350,300);
clickObjectAction('multi');click(200,300);clickObjectAction('group');const nestedFirst=api.objects[0].group;
api.addObject('desk');drag(500,400,650,300);api.addObject('chair');drag(500,400,800,300);
clickObjectAction('multi');click(650,300);clickObjectAction('group');const nestedSecond=api.objects[2].group;
api.addObject('shelf');drag(500,400,500,550);clickObjectAction('multi');click(200,300);click(650,300);
assert.equal(api.objectIds.length,5);assert.ok(api.objectViewportActions().some(action=>action.action==='group'));
clickObjectAction('group');const nestedOuter=api.objects[0].group;
assert.ok(api.objects.every(item=>item.group===nestedOuter));assert.equal(api.objects[0].subgroups[0],nestedFirst);assert.equal(api.objects[2].subgroups[0],nestedSecond);
api.undo();assert.equal(api.objects[0].group,nestedFirst);api.redo();assert.equal(api.objects[0].group,nestedOuter);
deselect();timedTap(200,300,10000);timedTap(200,300,10200);click(200,300);
assert.equal(api.objectIds.length,2);assert.equal(api.objectHandles().length,2);
paintCalls.length=0;api.draw();assert.ok(paintCalls.some(p=>p.color==='#f3e8ff'));
timedTap(200,300,11000);timedTap(200,300,11200);click(200,300);assert.equal(api.objectIds.length,1);
paintCalls.length=0;api.draw();assert.ok(paintCalls.some(p=>p.color==='#dbeafe'));
assert.equal(api.objectHandles().length,2);
api.closeGroupEditor();assert.equal(api.objectIds.length,2);
api.closeGroupEditor();assert.equal(api.objectIds.length,5);
clickObjectAction('ungroup');assert.equal(api.objects[0].group,nestedFirst);assert.equal(api.objects[2].group,nestedSecond);assert.equal(api.objects[4].group,null);
deselect();

// Plus selects grouping actions exclusively; an ordinary group selection offers ungroup.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');drag(500,400,200,300);api.addObject('chair');drag(500,400,350,300);
clickObjectAction('multi');click(200,300);clickObjectAction('group');
assert.ok(api.objectViewportActions().some(a=>a.action==='ungroup'));
assert.ok(!api.objectViewportActions().some(a=>a.action==='group'));
clickObjectAction('multi');assert.ok(!api.objectViewportActions().some(a=>a.action==='ungroup'));
api.addObject('shelf');drag(500,400,700,500);clickObjectAction('multi');click(200,300);
assert.ok(api.objectViewportActions().some(a=>a.action==='group'));
assert.ok(!api.objectViewportActions().some(a=>a.action==='ungroup'));
clickObjectAction('group');const actionOuter=api.objects[0].group;
deselect();timedTap(200,300,20000);timedTap(200,300,20200);click(200,300);
assert.ok(api.objectViewportActions().some(a=>a.action==='ungroup'));
clickObjectAction('multi');assert.ok(!api.objectViewportActions().some(a=>a.action==='ungroup'));
deselect();

// Double-click an object, edit its lines without walls, save, and undo at plan level.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('shape-rectangle');deselect();
const planBeforeSketch=JSON.stringify(api.segments),objectBeforeSketch=JSON.stringify(api.objects[0]);
timedTap(500,400,30000);timedTap(500,400,30200);
assert.equal(el('sketchEditor').hidden,false);assert.equal(el('appHeader').inert,true);
el('sketchDone').onclick();assert.equal(JSON.stringify(api.objects[0]),objectBeforeSketch,'Opening and closing does not convert the original symbol');
timedTap(500,400,31000);timedTap(500,400,31200);
const sketchCanvas=el('sketchBoard');
const sketchClick=(x,y)=>{sketchCanvas.onpointerdown(event(x,y));sketchCanvas.onpointerup(event(x,y));};
const sketchDrag=(x,y,a,b)=>{sketchCanvas.onpointerdown(event(x,y));sketchCanvas.onpointermove(event(a,b));sketchCanvas.onpointerup(event(a,b));};
el('sketchdraw').onclick();sketchClick(224,400);sketchClick(776,400);
el('sketchselect').onclick();sketchDrag(500,400,500,455);
assert.equal(el('sketchDelete').hidden,false);
el('sketcherase').onclick();sketchClick(500,455);el('sketchUndo').onclick();el('sketchRedo').onclick();el('sketchUndo').onclick();
el('sketchDone').onclick();
assert.equal(el('sketchEditor').hidden,true);assert.equal(el('appHeader').inert,false);
assert.equal(JSON.stringify(api.segments),planBeforeSketch,'Editing an object never creates walls');
assert.equal(api.objects[0].sketch.lines.length,5);
assert.ok(api.objects[0].sketch.lines.some(line=>Math.abs(line.y1-line.y2)<1e-7&&line.y1>0&&line.y1<20));
assert.ok(JSON.parse(memory.get('infoa_grid_loops_v1')).objects[0].sketch);
api.undo();assert.equal(api.objects[0].sketch,undefined);api.redo();assert.equal(api.objects[0].sketch.lines.length,5);
deselect();

// The object editor shares the plan grid and allows freely chosen directions.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('shape-rectangle');deselect();
timedTap(500,400,40000);timedTap(500,400,40200);
const sharedCanvas=el('sketchBoard');
const sharedDrag=(x,y,a,b)=>{sharedCanvas.onpointerdown(event(x,y));sharedCanvas.onpointermove(event(a,b));sharedCanvas.onpointerup(event(a,b));};
el('sketchdraw').onclick();sharedDrag(224,400,776,460);
// An outside tap neither closes nor saves the editor.
sharedCanvas.onpointerdown(event(20,20));sharedCanvas.onpointerup(event(20,20));
assert.equal(el('sketchEditor').hidden,false);assert.equal(api.objects[0].sketch,undefined);
el('sketchDone').onclick();assert.equal(el('sketchEditor').hidden,true);assert.equal(api.objects[0].sketch.lines.length,5);
const sharedStroke=api.objects[0].sketch.lines[4];assert.notEqual(sharedStroke.y1,sharedStroke.y2);
assert.equal(Math.abs(Math.round(sharedStroke.x1)%5),0);assert.equal(Math.abs(Math.round(sharedStroke.x2)%5),0);
timedTap(500,400,41000);timedTap(500,400,41200);
sharedDrag(20,20,30,30);assert.equal(el('sketchEditor').hidden,false,'Panning outside the object does not close the editor');
el('sketchDone').onclick();assert.equal(el('sketchEditor').hidden,true);deselect();

// Close discards local edits without creating plan history or changing the saved sketch.
timedTap(500,400,42000);timedTap(500,400,42200);
const savedBeforeClose=JSON.stringify(api.objects[0]),storedBeforeClose=memory.get('infoa_grid_loops_v1');
el('sketchdraw').onclick();sharedDrag(300,500,700,500);el('sketchClose').onclick();
assert.equal(el('sketchEditor').hidden,true);assert.equal(el('appHeader').inert,false);
assert.equal(JSON.stringify(api.objects[0]),savedBeforeClose);assert.equal(memory.get('infoa_grid_loops_v1'),storedBeforeClose);deselect();

// The plan passes the real wall cross-section to the door renderer.
el('clearAll').click();el('clearAll').click();api.fit();startDrawing();line(100,400,900,400);enterEdit();api.addObject('door');
const drawDoorOriginal=context.CadObjects.draw,doorDrawProfiles=[];
context.CadObjects.draw=(...args)=>{if(args[1].kind==='door')doorDrawProfiles.push(args[9]);return drawDoorOriginal(...args);};
api.draw();context.CadObjects.draw=drawDoorOriginal;
assert.ok(doorDrawProfiles.some(profile=>profile&&profile.max>profile.min));deselect();

// The open group's area has its own highlight, while other objects remain dimmed.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('desk');drag(500,400,200,300);api.addObject('chair');drag(500,400,350,300);
clickObjectAction('multi');click(200,300);clickObjectAction('group');
api.openGroupEditor(api.objects[0].group);paintCalls.length=0;api.draw();
assert.ok(paintCalls.some(p=>p.color==='rgba(147,51,234,0.07)'&&p.alpha===1));
click(990,790);assert.equal(api.editingGroup,null);deselect();

// Help is read-only and preserves selection and drawing state.
const sceneBeforeHelp=JSON.stringify(api.objects),wallsBeforeHelp=JSON.stringify(api.segments),modeBeforeHelp=api.mode;
el('helpOpen').click();assert.equal(el('helpDialog').open,true);
assert.equal(JSON.stringify(api.objects),sceneBeforeHelp);assert.equal(JSON.stringify(api.segments),wallsBeforeHelp);assert.equal(api.mode,modeBeforeHelp);
el('helpClose').click();assert.equal(el('helpDialog').open,false);

// Circle creation, selection, radius editing, erasure and undo preserve a real circle.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('shape-square');deselect();
timedTap(500,400,60000);timedTap(500,400,60200);
const circleCanvas=el('sketchBoard');
const circleTap=(x,y)=>{circleCanvas.onpointerdown(event(x,y));circleCanvas.onpointerup(event(x,y));};
const circleDrag=(x,y,a,b)=>{circleCanvas.onpointerdown(event(x,y));circleCanvas.onpointermove(event(a,b));circleCanvas.onpointerup(event(a,b));};
el('sketchcircle').onclick();circleTap(500,400);circleTap(644,400);
el('sketchselect').onclick();circleTap(644,400);circleDrag(644,400,680,400);
el('sketcherase').onclick();circleTap(680,400);el('sketchUndo').onclick();
el('sketchDone').onclick();
const drawnCircle=api.objects[0].sketch.lines.find(shape=>shape.type==='circle');assert.ok(drawnCircle);assert.ok(drawnCircle.rx>20);assert.equal(drawnCircle.rx,drawnCircle.ry);
assert.equal(JSON.stringify(context.CadObjects.validate(JSON.parse(JSON.stringify(api.objects)))),JSON.stringify(api.objects));
api.undo();assert.equal(api.objects[0].sketch,undefined);api.redo();assert.ok(api.objects[0].sketch.lines.some(shape=>shape.type==='circle'));deselect();

// Select a room, edit its label, area and pastel hue, and retain settings with the plan.
el('clearAll').click();el('clearAll').click();api.fit();startDrawing();
line(100,100,500,100);line(500,100,500,400);line(500,400,100,400);line(100,400,100,100);enterEdit();
click(300,250);assert.equal(el('roomActions').hidden,false);assert.equal(el('modeTools').hidden,true);
const editedRoomId=api.selectedRoomId;
el('roomName').value='Dnevni boravak';el('roomShowArea').checked=true;el('roomHue').value='215';el('roomForm').input({preventDefault(){}});
assert.equal(api.roomDetails[0].name,'Dnevni boravak');assert.equal(api.roomDetails[0].showArea,true);assert.equal(api.roomDetails[0].hue,215);
assert.ok(labels.includes('Dnevni boravak'));assert.ok(labels.some(text=>String(text).includes('m\u00b2')));
paintCalls.length=0;api.draw();assert.ok(paintCalls.some(p=>p.color==='hsl(215.0000, 35%, 96%)'));
const savedRoomDetails=JSON.parse(memory.get('infoa_grid_loops_v1')).roomDetails;
assert.equal(savedRoomDetails[0].name,'Dnevni boravak');assert.equal(savedRoomDetails[0].id,editedRoomId);
api.undo();assert.equal(api.roomDetails[0].name,'');api.redo();assert.equal(api.roomDetails[0].name,'Dnevni boravak');
// Moving a boundary keeps identity and settings, while the net area changes.
const areaBeforeRoomMove=api.model().layout.net[0].area;
click(300,400);drag(300,400,300,450);
assert.equal(api.roomDetails[0].id,editedRoomId);assert.equal(api.roomDetails[0].name,'Dnevni boravak');assert.ok(api.model().layout.net[0].area>areaBeforeRoomMove);
api.undo();assert.equal(api.model().layout.net[0].area,areaBeforeRoomMove);assert.equal(api.roomDetails[0].name,'Dnevni boravak');
assert.throws(()=>api.readRoomDetails([{...savedRoomDetails[0],hue:400}]));
assert.throws(()=>api.readRoomDetails([{...savedRoomDetails[0],showArea:'yes'}]));
assert.throws(()=>api.readRoomDetails([savedRoomDetails[0],savedRoomDetails[0]]));
click(990,790);

// Room properties are exported alongside the drawing and survive a partition change.
el('saveJson').click();const roomExportBlob=downloadedBlob;
roomExportBlob.text().then(text=>{const data=JSON.parse(text);assert.equal(data.roomDetails[0].name,'Dnevni boravak');assert.equal(data.roomDetails[0].showArea,true);assert.equal(data.roomDetails[0].hue,215);}).catch(error=>{console.error(error);process.exitCode=1;});
startDrawing();line(300,100,300,400);enterEdit();
assert.equal(api.model().faces.length,2);assert.equal(api.roomDetails.filter(room=>room.name==='Dnevni boravak').length,1);
assert.equal(new Set(api.roomDetails.map(room=>room.id)).size,2);
api.undo();assert.equal(api.roomDetails.length,1);assert.equal(api.roomDetails[0].name,'Dnevni boravak');deselect();

// Overall dimensions include wall thickness, ignore furniture, and have their own switch.
el('showOverallMeasures').checked=true;el('showOverallMeasures').change();
const totalBox=api.overallDimensions();assert.ok(totalBox);assert.ok(totalBox.width>0&&totalBox.depth>0);
el('showMeasures').checked=false;el('showMeasures').change();labels.length=0;api.draw();
assert.ok(labels.includes(totalBox.width.toLocaleString('hr-HR',{maximumFractionDigits:1})+' cm'));
assert.ok(labels.includes(totalBox.depth.toLocaleString('hr-HR',{maximumFractionDigits:1})+' cm'));
const totalBeforeFurniture=JSON.stringify(api.overallDimensions());api.addObject('desk');assert.equal(JSON.stringify(api.overallDimensions()),totalBeforeFurniture);
el('showOverallMeasures').checked=false;el('showOverallMeasures').change();
assert.equal(JSON.parse(memory.get('cadup_view_settings_v1')).overallMeasures,false);
el('showMeasures').checked=true;el('showMeasures').change();

// Insertion and dimension input retain an edge on the drawing grid.
el('clearAll').click();el('clearAll').click();api.fit();api.addObject('shelf');
let insertedBox=context.CadObjects.selectionBounds(api.objects);const insertionUnit=100;
assert.ok(Math.abs(insertedBox.left/insertionUnit-Math.round(insertedBox.left/insertionUnit))<1e-8);
assert.ok(Math.abs(insertedBox.bottom/insertionUnit-Math.round(insertedBox.bottom/insertionUnit))<1e-8);
el('objectWidth').value='45';el('objectDepth').value='35';el('objectForm').submit({preventDefault(){}});
const resizedGridBox=context.CadObjects.selectionBounds(api.objects);assert.equal(resizedGridBox.left,insertedBox.left);assert.equal(resizedGridBox.bottom,insertedBox.bottom);
// The editor grid starts at the object's lower-left edge, including odd half-sizes.
deselect();const oddItem=api.objects[0],oddCenter={x:api.view.ox+oddItem.x*api.view.scale,y:api.view.oy+oddItem.y*api.view.scale};
timedTap(oddCenter.x,oddCenter.y,70000);timedTap(oddCenter.x,oddCenter.y,70200);
const oddCanvas=el('sketchBoard'),oddZoom=Math.min((oddCanvas.clientWidth-80)/45,(oddCanvas.clientHeight-80)/35),oddLeft=oddCanvas.clientWidth/2-45*oddZoom/2,oddBottom=oddCanvas.clientHeight/2+35*oddZoom/2;
el('sketchdraw').onclick();
for(const p of [{x:oddLeft+10*oddZoom,y:oddBottom-10*oddZoom},{x:oddLeft+25*oddZoom,y:oddBottom-20*oddZoom}]){oddCanvas.onpointerdown(event(p.x,p.y));oddCanvas.onpointerup(event(p.x,p.y));}
el('sketchDone').onclick();const snappedStroke=api.objects[0].sketch.lines.at(-1);
for(const n of [1,2]){
 const x=(snappedStroke['x'+n]+50)*45/100,y=(snappedStroke['y'+n]-50)*35/100;
 assert.ok(Math.abs(x/5-Math.round(x/5))<1e-8);assert.ok(Math.abs(y/5-Math.round(y/5))<1e-8);
}
deselect();
