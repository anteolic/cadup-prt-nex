const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),labels=[],memory=new Map();
let downloadedBlob=null,downloadName=null;
const updateRequests=[];let updateFailure=null;
const publishedHtml=fs.readFileSync(__dirname+'/CADup.html','utf8');
const gridLines=[],paintCalls=[],gripCircles=[];let gridStart=null;
const canvas=new Proxy({arc(x,y,r){if(r>=11&&this.strokeStyle==='#dc2626')gripCircles.push({x,y,r});},fill(){paintCalls.push({color:this.fillStyle,alpha:this.globalAlpha});},measureText:text=>({width:text.length*6}),fillText:text=>labels.push(text),moveTo(x,y){gridStart={x,y};},lineTo(x,y){if(gridStart&&['#c1ccda','#e4e9f0'].includes(this.strokeStyle))gridLines.push({...gridStart,x2:x,y2:y});}},{get:(o,k)=>o[k]||(()=>{})});
function el(id){
 if(!nodes.has(id))nodes.set(id,{clientWidth:1000,clientHeight:800,style:{},classList:{toggle(){},add(){},remove(){}},focus(){},select(){},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getContext:()=>canvas,getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){}});
 return nodes.get(id);
}
const context=vm.createContext({console,Blob,fetch:async(url,options)=>{updateRequests.push({url,options});if(updateFailure==='network')throw new Error('Offline');return {ok:updateFailure!=='http'&&!(updateFailure==='script'&&url.includes('grid-app.js')),status:updateFailure==='http'||(updateFailure==='script'&&url.includes('grid-app.js'))?503:200,text:async()=>url.includes('CADup.html')?(updateFailure==='incomplete'?'<html></html>':publishedHtml):'/* verified script response */'};},URL:class extends URL{static createObjectURL(blob){downloadedBlob=blob;return 'blob:test';}static revokeObjectURL(){}},setTimeout:fn=>fn(),document:{addEventListener(type,fn){if(type==='close')this.onclose=fn;else this[type]=fn;},getElementById:el,createElement:()=>({click(){downloadName=this.download;}}),documentElement:{}},window:{location:{href:'https://anteolic.github.io/cadup-prt-nex/CADup.html?v=39&mode=test#drawing',replace(url){this.href=url;}},devicePixelRatio:1,addEventListener(){}},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>fn()});
for(const file of ['room-geometry.js','grid-geometry.js','cad-objects.js'])vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),context);
let source=fs.readFileSync(__dirname+'/grid-app.js','utf8');new Function(source);
source=source.replace('restore();status();',`globalThis.api={addCustomObject,get customLibrary(){return customLibrary},addObject,get objects(){return objects},get objectIds(){return [...objectIds]},handleScale,hitHandle,get mode(){return mode},model,undo,redo,draw,snap,step,point,resize,zoomAt,fit,get view(){return {w,h,ox,oy,scale,height}},get selection(){return selectedWall},get dimensions(){return dimensionHits},get segments(){return segments},get first(){return first},get visible(){return wallsVisible}};restore();status();`);
vm.runInContext(source,context);
const {api}=context,board=el('board');
const event=(x,y,id=1)=>({button:0,pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
function click(x,y){board.pointerdown(event(x,y));board.pointerup(event(x,y));}
function enterEdit(){if(api.mode==='draw')el('drawMode').click();else deselect();}
function finishDrawing(){enterEdit();}
function startDrawing(){if(api.mode!=='draw')el('drawMode').click();}
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
el('wallDelete').click();assert.equal(api.model().faces.length,1,'Brisanje u načinu Uredi uklanja cijelu pregradu');
assert.equal(api.selection,null);assert.ok(!api.segments.some(s=>s.x1===400&&s.x2===400));
api.undo();assert.equal(api.model().faces.length,2);api.redo();assert.equal(api.model().faces.length,1);
// Gumica otvara obris i undo ga zatvara.
click(150,100);el('wallDelete').click();assert.equal(api.model().faces.length,0);api.undo();assert.equal(api.model().faces.length,1);
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
drag(150,100,150,125);assert.equal(api.model().faces.length,2);
assert.ok(api.segments.some(s=>s.y1===250&&s.y2===250&&s.x1===200));
drag(150,125,150,75);assert.equal(api.model().faces.length,2);
assert.ok(api.segments.some(s=>s.y1===150&&s.y2===150&&s.x1===200),'Spušteni segment podiže se iznad početne ravnine');
api.undo();api.undo();
const beforeRoomMove=JSON.stringify(api.segments),beforeRoomCamera={scale:api.view.scale,ox:api.view.ox,oy:api.view.oy};drag(150,175,125,200);
assert.equal(JSON.stringify(api.segments),beforeRoomMove,'Povlačenje unutrašnjosti ne pomiče prostoriju');
assert.equal(api.model().faces.length,2);assert.deepEqual({scale:api.view.scale,ox:api.view.ox,oy:api.view.oy},beforeRoomCamera,'Povlačenje praznog prostora ne pomiče ni prikaz');
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
el('topMenu').open=false;

// Dimenzije su samo oznake; uređivanje počinje odabirom samog zida.
el('clearAll').click();el('clearAll').click();startDrawing();
line(100,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);
enterEdit();
const topDimension=api.dimensions.find(r=>r.dimension.axis==='h'&&r.dimension.line===185);
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
assert.equal(Math.min(...api.model().layout.outer.map(r=>r.y)),175);
const afterThickness=JSON.stringify(api.segments);api.undo();assert.equal(JSON.stringify(api.segments),beforeThickness);api.redo();assert.equal(JSON.stringify(api.segments),afterThickness);
click(200,100);el('dimensionValue').value='520';el('dimensionThickness').value='40';el('dimensionForm').submit({preventDefault(){}});
assert.equal(el('dimensionError').textContent,'');assert.equal(api.model().faces.length,1);
assert.ok(api.model().wallOutline.edges.some(e=>e.axis==='h'&&e.line===180&&e.span[1]-e.span[0]===550));
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
click(200,175);click(150,100);assert.equal(api.selection.y1,200);assert.equal(api.selection.x2,600);
assert.equal(JSON.stringify(api.segments),eraseOriginal);
click(175,100);assert.equal(JSON.stringify(api.segments),eraseOriginal,'Ponovljeni odabir ne briše zid');
el('wallDelete').click();assert.equal(api.selection,null);
assert.ok(!api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1<400));
assert.ok(!api.segments.some(s=>s.y1===200&&s.y2===200),'Briše se cijeli spojeni ravni zid');
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
el('wallDelete').click();assert.equal(JSON.stringify(api.segments),beforeSelectionDelete,'Brisanje bez odabira ništa ne radi');
click(200,100);el('wallDelete').click();assert.equal(api.segments.length,0);api.undo();assert.equal(JSON.stringify(api.segments),beforeSelectionDelete);
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
el('drawMode').click();assert.equal(api.mode,'edit');assert.equal(api.first,null);assert.equal(el('drawMode').attributes['aria-pressed'],'false');
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
 assert.equal(updateRequests.length,5);assert.ok(updateRequests.every(request=>request.options.cache==='reload'));
 for(const file of ['room-geometry.js','grid-geometry.js','cad-objects.js','grid-app.js'])assert.ok(updateRequests.some(request=>request.url.includes(file+'?v=')));
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
assert.equal(api.objects[0].width,240);el('objectRotate').click();assert.equal(api.objects[0].rotation,90);el('objectRotate').click();assert.equal(api.objects[0].rotation,180);api.undo();assert.equal(api.objects[0].rotation,90);
api.addObject('chair');assert.equal(api.objects.length,2);
let furniture=api.objects,objectView=api.view,chairPoint={x:objectView.ox+furniture[1].x*objectView.scale,y:objectView.oy+furniture[1].y*objectView.scale};
drag(chairPoint.x,chairPoint.y,chairPoint.x+100,chairPoint.y);
assert.ok(api.objects[1].x>api.objects[0].x+100);
el('objectMulti').click();objectView=api.view;click(objectView.ox+api.objects[0].x*objectView.scale,objectView.oy+api.objects[0].y*objectView.scale);
assert.equal(api.objectIds.length,2);el('objectGroup').click();assert.ok(api.objects[0].group);assert.equal(api.objects[0].group,api.objects[1].group);
const groupedFurniture=JSON.stringify(api.objects);el('objectCopy').click();assert.equal(api.objects.length,4);assert.notEqual(api.objects[2].group,api.objects[0].group);
api.undo();assert.equal(JSON.stringify(api.objects),groupedFurniture);api.redo();assert.equal(api.objects.length,4);
let groupPoint=api.objects[2];click(objectView.ox+groupPoint.x*objectView.scale,objectView.oy+groupPoint.y*objectView.scale);assert.equal(api.objectIds.length,2);
el('objectDelete').click();assert.equal(api.objects.length,2);api.undo();assert.equal(api.objects.length,4);
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
drag(corner.x,corner.y,corner.x+40,corner.y+20);
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

// Merged zid na T spoju ima jednu selekciju, ali ostaju unutarnje kote između pregrada.
el('clearAll').click();el('clearAll').click();api.fit();
line(100,100,200,100);line(200,100,300,100);line(300,100,300,250);line(300,250,100,250);line(100,250,100,100);line(200,100,200,250);
enterEdit();click(150,100);assert.equal(api.selection.x1,200);assert.equal(api.selection.x2,600);assert.equal(el('dimensionValue').value,'400');
assert.equal(api.model().faces.length,2);assert.ok(api.dimensions.some(r=>r.dimension.axis==='h'&&r.dimension.end-r.dimension.start===180),'Kote između zidova ostaju vidljive');
assert.ok(labels.includes('180 cm'));
el('dimensionThickness').value='20';el('dimensionForm').submit({preventDefault(){}});
assert.ok(api.segments.some(s=>s.y1===200&&s.y2===200&&s.x1===200&&s.x2===600&&s.thickness===20));

// Uhvaćena ručka skriva se tijekom povlačenja i vraća pri puštanju.
el('clearAll').click();el('clearAll').click();api.fit();line(100,100,300,100);enterEdit();click(200,100);
gripCircles.length=0;api.draw();assert.equal(gripCircles.length,2);
gripCircles.length=0;board.pointerdown(event(300,100));assert.equal(gripCircles.length,1,'Uhvaćena ručka je odmah skrivena');
gripCircles.length=0;board.pointermove(event(350,100));assert.equal(gripCircles.length,1);assert.ok(api.segments.some(s=>s.x2===700));
gripCircles.length=0;board.pointerup(event(350,100));assert.equal(gripCircles.length,2,'Nakon puštanja su opet vidljive obje ručke');
gripCircles.length=0;board.pointerdown(event(350,100));board.pointercancel(event(350,100));assert.ok(gripCircles.length>=2,'Prekid također vraća ručke');
