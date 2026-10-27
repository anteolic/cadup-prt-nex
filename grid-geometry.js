/* Mreža ortogonalnih poteza. Prostorije su zatvorene plohe mreže. */
globalThis.GridGeometry=(()=>{
 function normalize(input){
  const lines=new Map();
  for(const s of input){
   if(!s||!['x1','y1','x2','y2'].every(k=>Number.isFinite(s[k])))continue;
   const h=s.y1===s.y2;if(!h&&s.x1!==s.x2)continue;
   const line=h?s.y1:s.x1,start=h?Math.min(s.x1,s.x2):Math.min(s.y1,s.y2),end=h?Math.max(s.x1,s.x2):Math.max(s.y1,s.y2);
   if(start===end)continue;
   const thickness=Number.isFinite(s.thickness)&&s.thickness>=1&&s.thickness<=100?s.thickness:undefined;
   const key=(h?'h':'v')+':'+line;if(!lines.has(key))lines.set(key,{h,line,spans:[]});lines.get(key).spans.push({start,end,thickness});
  }
  const result=[];
  for(const {h,line,spans} of lines.values()){
   const cuts=[...new Set(spans.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b);let previous=null;
   for(let i=1;i<cuts.length;i++){
    const start=cuts[i-1],end=cuts[i],cover=spans.filter(s=>s.start<=start&&s.end>=end);
    if(!cover.length){previous=null;continue;}
    const thickness=cover.filter(s=>s.thickness!==undefined).at(-1)?.thickness;
    if(previous&&previous.thickness===thickness&&(h?previous.x2:previous.y2)===start){if(h)previous.x2=end;else previous.y2=end;continue;}
    previous=h?{x1:start,y1:line,x2:end,y2:line}:{x1:line,y1:start,x2:line,y2:end};
    if(thickness!==undefined)previous.thickness=thickness;result.push(previous);
   }
  }
  return result;
 }
 function erase(input,index,start,end){
  const result=[];
  input.forEach((s,i)=>{
   if(i!==index){result.push(s);return;}
   const h=s.y1===s.y2,a=h?s.x1:s.y1,b=h?s.x2:s.y2;
   if(start>a)result.push(h?{...s,x2:Math.min(start,b)}:{...s,y2:Math.min(start,b)});
   if(end<b)result.push(h?{...s,x1:Math.max(end,a)}:{...s,y1:Math.max(end,a)});
  });return normalize(result);
 }
 function detect(input){
  const segments=normalize(input);if(!segments.length)return {rooms:[],faces:[]};
  const xs=[...new Set(segments.flatMap(s=>[s.x1,s.x2]))].sort((a,b)=>a-b);
  const ys=[...new Set(segments.flatMap(s=>[s.y1,s.y2]))].sort((a,b)=>a-b);
  xs.unshift(xs[0]-50);xs.push(xs[xs.length-1]+50);ys.unshift(ys[0]-50);ys.push(ys[ys.length-1]+50);
  const nx=xs.length-1,ny=ys.length-1;
  if(nx*ny>250000)throw new Error('Mreža ima previše detalja');
  const horizontal=new Map(),vertical=new Map();
  for(const s of segments){const h=s.y1===s.y2,map=h?horizontal:vertical,line=h?s.y1:s.x1;if(!map.has(line))map.set(line,[]);map.get(line).push(h?[s.x1,s.x2]:[s.y1,s.y2]);}
  const blocked=(map,line,start,end)=>(map.get(line)||[]).some(s=>s[0]<=start&&s[1]>=end);
  const visited=new Uint8Array(nx*ny),faces=[],rooms=[];let id=1;
  for(let seed=0;seed<visited.length;seed++){
   if(visited[seed])continue;
   const queue=[seed],cells=[];let outside=false;visited[seed]=1;
   for(let cursor=0;cursor<queue.length;cursor++){
    const key=queue[cursor],i=key%nx,j=Math.floor(key/nx);cells.push([i,j]);
    if(i===0||j===0||i===nx-1||j===ny-1)outside=true;
    const visit=(ii,jj,wall)=>{if(ii<0||jj<0||ii>=nx||jj>=ny||wall)return;const key=jj*nx+ii;if(!visited[key]){visited[key]=1;queue.push(key);}};
    visit(i-1,j,blocked(vertical,xs[i],ys[j],ys[j+1]));visit(i+1,j,blocked(vertical,xs[i+1],ys[j],ys[j+1]));
    visit(i,j-1,blocked(horizontal,ys[j],xs[i],xs[i+1]));visit(i,j+1,blocked(horizontal,ys[j+1],xs[i],xs[i+1]));
   }
   if(outside)continue;
   const rects=[];cells.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);let previous=null;
   for(const [i,j] of cells){
    const x=xs[i],y=ys[j],width=xs[i+1]-x,height=ys[j+1]-y;
    if(previous&&previous.y===y&&previous.height===height&&previous.x+previous.width===x)previous.width+=width;
    else{previous={id:rooms.length+rects.length+1,roomKey:id,x,y,width,height};rects.push(previous);}
   }
   const area=rects.reduce((a,r)=>a+r.width*r.height,0);faces.push({id,rects,area});rooms.push(...rects);id++;
  }
  return {rooms,faces};
 }
 // Otvori se zatvaraju samo za prepoznavanje prostorija, nikad u nacrtanim potezima.
 function detectWithDoors(input){
  const lines=normalize(input),enclosed=detect(lines),doors=[];
  // Rubovi ćelija mogu prolaziti kroz unutrašnjost; uključujemo susjedne ćelije.
  const interior=(x,y)=>{
   const covered=(a,b)=>enclosed.rooms.some(r=>a>=r.x&&a<=r.x+r.width&&b>=r.y&&b<=r.y+r.height);
   return covered(x-.001,y-.001)&&covered(x+.001,y-.001)&&covered(x-.001,y+.001)&&covered(x+.001,y+.001);
  };
  const groups=new Map();
  for(const s of lines){const h=s.y1===s.y2,key=(h?'h':'v')+':'+(h?s.y1:s.x1);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
  for(const spans of groups.values()){
   const h=spans[0].y1===spans[0].y2;
   spans.sort((a,b)=>(h?a.x1-b.x1:a.y1-b.y1));
   for(let i=1;i<spans.length;i++){
    const a=spans[i-1],b=spans[i],start=h?a.x2:a.y2,end=h?b.x1:b.y1,line=h?a.y1:a.x1;
    const solidLength=h?(a.x2-a.x1)+(b.x2-b.x1):(a.y2-a.y1)+(b.y2-b.y1);
    // Dvije prostorije kad je otvor kraći od susjednih punih dijelova pregrade.
    if(end<=start||end-start>=solidLength)continue;
    const cuts=[start,end,...enclosed.rooms.flatMap(r=>h?[r.x,r.x+r.width]:[r.y,r.y+r.height]).filter(v=>v>start&&v<end)].sort((a,b)=>a-b);
    if(!cuts.slice(1).every((v,j)=>v===cuts[j]||interior(h?(v+cuts[j])/2:line,h?line:(v+cuts[j])/2)))continue;
    doors.push(h?{x1:start,y1:line,x2:end,y2:line}:{x1:line,y1:start,x2:line,y2:end});
   }
  }
  return {...detect([...lines,...doors]),doors};
 }
 function atomic(input){
  const lines=normalize(input),result=[];
  for(const s of lines){
   const h=s.y1===s.y2,start=h?s.x1:s.y1,end=h?s.x2:s.y2,cuts=new Set([start,end]);
   for(const other of lines){
    if(h===(other.y1===other.y2))continue;
    const along=h?other.x1:other.y1,line=h?s.y1:s.x1;
    const low=h?other.y1:other.x1,high=h?other.y2:other.x2;
    if(along>start&&along<end&&line>=low&&line<=high)cuts.add(along);
   }
   const sorted=[...cuts].sort((a,b)=>a-b);
   for(let i=0;i<sorted.length-1;i++)result.push(h?{...s,x1:sorted[i],x2:sorted[i+1]}:{...s,y1:sorted[i],y2:sorted[i+1]});
  }
  return result;
 }
 function junctions(input){
  const nodes=new Map();
  for(const s of atomic(input))for(const n of [1,2]){const x=s['x'+n],y=s['y'+n],key=x+':'+y;if(!nodes.has(key))nodes.set(key,{x,y,degree:0});nodes.get(key).degree++;}
  return [...nodes.values()].filter(node=>node.degree>=2);
 }
 function eraseLine(input,stroke){
  const h=stroke.y1===stroke.y2,line=h?stroke.y1:stroke.x1;
  const start=h?Math.min(stroke.x1,stroke.x2):Math.min(stroke.y1,stroke.y2),end=h?Math.max(stroke.x1,stroke.x2):Math.max(stroke.y1,stroke.y2);
  const result=[];
  for(const s of normalize(input)){
   if(h!==(s.y1===s.y2)||(h?s.y1:s.x1)!==line){result.push(s);continue;}
   const a=h?s.x1:s.y1,b=h?s.x2:s.y2;
   if(end<=a||start>=b){result.push(s);continue;}
   if(start>a)result.push(h?{...s,x2:start}:{...s,y2:start});
   if(end<b)result.push(h?{...s,x1:end}:{...s,y1:end});
  }
  return normalize(result);
 }
 function wallForDimension(input,dimension){
  const h=dimension.axis==='h',lines=atomic(input),start=dimension.start,end=dimension.end;
  let root=-1,best=Infinity;
  for(let i=0;i<lines.length;i++){
   const s=lines[i];if((s.y1===s.y2)!==h)continue;
   const overlap=Math.min(end,h?s.x2:s.y2)-Math.max(start,h?s.x1:s.y1);
   const distance=Math.abs(dimension.line-(h?s.y1:s.x1));
   if(overlap<=0||distance>100.001)continue;
   const score=distance*10000-overlap;if(score<best){best=score;root=i;}
  }
  if(root<0)throw new Error('Nije pronađen zid za ovu mjeru.');
  return {wall:lines[root],lines,index:root};
 }
 function setWallThickness(input,dimension,thickness){
  if(!Number.isFinite(thickness)||thickness<1||thickness>100)throw new Error('Debljina mora biti od 1 do 100 cm.');
  const {lines,index}=wallForDimension(input,dimension);lines[index]={...lines[index],thickness};return normalize(lines);
 }
 // Promjena kote pomiče vezani kraj i susjedne zidove, čuvajući zatvoren obris.
 function resizeDimension(input,dimension,length,min=5,width=2000,height=2000){
  const h=dimension.axis==='h',lines=atomic(input),start=dimension.start,end=dimension.end;
  if(!Number.isFinite(length)||length<min)throw new Error('Duljina mora biti najmanje 5 cm.');
  const wall=wallForDimension(input,dimension).wall,line=h?wall.y1:wall.x1,axis=h?'x':'y';
  const root=lines.findIndex(s=>(s.y1===s.y2)===h&&(h?s.y1:s.x1)===line&&s[axis+'1']>=wall[axis+'1']&&s[axis+'2']<=wall[axis+'2']);
  const candidates=lines.filter(s=>(s.y1===s.y2)===h&&(h?s.y1:s.x1)===line).flatMap(s=>[s[axis+'1'],s[axis+'2']]);
  const cut=candidates.reduce((a,b)=>Math.abs(b-end)<Math.abs(a-end)?b:a);
  if(Math.abs(cut-end)>100.001)throw new Error('Za ovaj dio zida upotrijebi krajnju ručku.');
  const neighbors=new Map(),key=(x,y)=>x+':'+y;
  lines.forEach((s,i)=>{for(const n of [1,2]){const k=key(s['x'+n],s['y'+n]);if(!neighbors.has(k))neighbors.set(k,[]);neighbors.get(k).push(i);}});
  const connected=new Set([root]),queue=[root];
  for(let j=0;j<queue.length;j++)for(const n of [1,2])for(const i of neighbors.get(key(lines[queue[j]]['x'+n],lines[queue[j]]['y'+n]))){
   if(!connected.has(i)){connected.add(i);queue.push(i);}
  }
  const delta=length-(end-start);
  const resized=lines.map((s,i)=>{
   if(!connected.has(i))return s;const next={...s};
   for(const n of [1,2])if(next[axis+n]>=cut)next[axis+n]=Math.round((next[axis+n]+delta)*1000)/1000;
   if(next.x1<0||next.y1<0||next.x2>width||next.y2>height||next.x2<next.x1||next.y2<next.y1||
    Math.abs(next.x2-next.x1)+Math.abs(next.y2-next.y1)<min)throw new Error('Duljina prelazi rub tlocrta ili previše skraćuje susjedni zid.');
   return next;
  });
  return normalize(resized);
 }
 function resizeWall(input,wall,endpoint,position,min=5,width=2000,height=2000){
  let lines=normalize(input),index=lines.findIndex(s=>['x1','y1','x2','y2'].every(k=>s[k]===wall[k]));
  if(index<0){lines=atomic(input);index=lines.findIndex(s=>['x1','y1','x2','y2'].every(k=>s[k]===wall[k]));}
  if(index<0||![1,2].includes(endpoint)||!Number.isFinite(position))return {segments:normalize(input),wall};
  const horizontal=wall.y1===wall.y2,axis=horizontal?'x':'y',limit=horizontal?width:height;
  const low=endpoint===1?0:wall[axis+'1']+min,high=endpoint===1?wall[axis+'2']-min:limit;
  if(low>high)return {segments:normalize(input),wall};
  const resized={...wall,[axis+endpoint]:Math.max(low,Math.min(high,position))};
  lines[index]=resized;return {segments:normalize(lines),wall:resized};
 }
 function moveWall(input,wall,requested,min=5,width=2000,height=2000){
  const lines=atomic(input),horizontal=wall.y1===wall.y2,axis=horizontal?'y':'x';
  const matches=s=>(s.y1===s.y2)===horizontal&&(horizontal?s.y1===wall.y1&&s.x1>=wall.x1&&s.x2<=wall.x2:s.x1===wall.x1&&s.y1>=wall.y1&&s.y2<=wall.y2);
  if(!lines.some(matches))return {segments:normalize(input),wall,delta:0};
  const endpoints=lines.filter(matches).flatMap(s=>[{x:s.x1,y:s.y1},{x:s.x2,y:s.y2}]),at=p=>endpoints.some(e=>e.x===p.x&&e.y===p.y);
  const coordinate=horizontal?wall.y1:wall.x1;
  let low=-coordinate,high=(horizontal?height:width)-coordinate;
  let safeLow=low,safeHigh=high;
  for(const s of lines){
   if(matches(s)||horizontal===(s.y1===s.y2))continue;
   for(const [a,b] of [[1,2],[2,1]]){
    const p={x:s['x'+a],y:s['y'+a]};if(!at(p))continue;
    const fixed=s[axis+b];
    const branching=lines.some(other=>other!==s&&!matches(other)&&horizontal!==(other.y1===other.y2)&&
     ((other.x1===p.x&&other.y1===p.y)||(other.x2===p.x&&other.y2===p.y)));
    const gap=branching?0:min;
    if(fixed>coordinate){high=Math.min(high,fixed-coordinate-gap);safeHigh=Math.min(safeHigh,fixed-coordinate-min);}
    else{low=Math.max(low,fixed-coordinate+gap);safeLow=Math.max(safeLow,fixed-coordinate+min);}
   }
  }
  function build(delta){
  const result=[],connectors=[];
  for(const s of lines){
   const next={...s};
   if(matches(s)){next[axis+'1']+=delta;next[axis+'2']+=delta;result.push(next);continue;}
   for(const n of [1,2]){
    const p={x:s['x'+n],y:s['y'+n]};if(!at(p))continue;
    if(horizontal!==(s.y1===s.y2))next[axis+n]+=delta;
    else{const q={...p};q[axis]+=delta;connectors.push({x1:p.x,y1:p.y,x2:q.x,y2:q.y});}
   }
   result.push(next);
  }
  const moved={...wall};moved[axis+'1']+=delta;moved[axis+'2']+=delta;
  return {segments:normalize([...result,...connectors]),wall:moved,delta};
  }
  const delta=Math.max(low,Math.min(high,requested)),candidate=build(delta);
  // Povrat kratkog spoja na ravninu je dopušten, ali cijela prostorija ne smije kolabirati.
  if((delta<safeLow||delta>safeHigh)&&detect(candidate.segments).faces.length<detect(input).faces.length)
   return build(Math.max(safeLow,Math.min(safeHigh,requested)));
  return candidate;
 }
 function moveRoom(input,rects,dx,dy,width=2000,height=2000){
  if(!rects.length)return {segments:normalize(input),dx:0,dy:0};
  const left=Math.min(...rects.map(r=>r.x)),right=Math.max(...rects.map(r=>r.x+r.width));
  const top=Math.min(...rects.map(r=>r.y)),bottom=Math.max(...rects.map(r=>r.y+r.height));
  dx=Math.max(-left,Math.min(width-right,dx));dy=Math.max(-top,Math.min(height-bottom,dy));
  const inside=p=>rects.some(r=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height);
  const result=[];
  for(const s of atomic(input)){
   const a={x:s.x1,y:s.y1},b={x:s.x2,y:s.y2},moveA=inside(a),moveB=inside(b);
   const p={x:a.x+(moveA?dx:0),y:a.y+(moveA?dy:0)},q={x:b.x+(moveB?dx:0),y:b.y+(moveB?dy:0)};
   if(p.x===q.x||p.y===q.y)result.push({...s,x1:p.x,y1:p.y,x2:q.x,y2:q.y});
   else{
    // Udaljeni kraj susjednog zida ostaje na mjestu, a spoj dobiva ortogonalni pregib.
    const horizontal=s.y1===s.y2;
    const elbow=moveA?(horizontal?{x:p.x,y:q.y}:{x:q.x,y:p.y}):(horizontal?{x:q.x,y:p.y}:{x:p.x,y:q.y});
    result.push({...s,x1:p.x,y1:p.y,x2:elbow.x,y2:elbow.y},{...s,x1:elbow.x,y1:elbow.y,x2:q.x,y2:q.y});
   }
  }
  return {segments:normalize(result),dx,dy};
 }
 return {normalize,erase,detect,detectWithDoors,atomic,junctions,eraseLine,wallForDimension,setWallThickness,resizeDimension,resizeWall,moveWall,moveRoom};
})();
