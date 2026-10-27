/* Geometrija prostora: unija pravokutnika i zidovi izvan slobodnog prostora. */
globalThis.RoomGeometry = (() => {
 const contains=(r,x,y)=>x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height;
 const roomKey=r=>r.roomKey??r.id;
 function groups(rects){
  const result=new Map();
  for(const r of rects){const key=roomKey(r);if(!result.has(key))result.set(key,[]);result.get(key).push(r);}
  return [...result].map(([id,rects])=>({id,rects}));
 }
 function split(rects,id,axis,position){
  const target=rects.filter(r=>roomKey(r)===id),low=[],high=[];
  if(!Number.isFinite(position)||!['h','v'].includes(axis))return null;
  for(const r of target){
   const start=axis==='v'?r.x:r.y,end=start+(axis==='v'?r.width:r.height);
   if(end<=position)low.push({...r});
   else if(start>=position)high.push({...r});
   else if(axis==='v'){
    low.push({...r,width:position-r.x});high.push({...r,x:position,width:end-position});
   }else{
    low.push({...r,height:position-r.y});high.push({...r,y:position,height:end-position});
   }
  }
  return low.length&&high.length?{low,high}:null;
 }
 function connected(rects,id){
  const result=rects.filter(r=>r.id===id),seen=new Set(result.map(r=>r.id));
  for(let i=0;i<result.length;i++)for(const r of rects){
   const a=result[i];
   if(!seen.has(r.id)&&a.x<=r.x+r.width&&r.x<=a.x+a.width&&a.y<=r.y+r.height&&r.y<=a.y+a.height){seen.add(r.id);result.push(r);}
  }
  return result;
 }
 function shell(rects,t){
  if(!Number.isFinite(t)||t<=0)throw new Error('Neispravna debljina zida');
  const expanded=rects.map(r=>({x:r.x-t,y:r.y-t,width:r.width+2*t,height:r.height+2*t}));
  const xs=[...new Set([...rects,...expanded].flatMap(r=>[r.x,r.x+r.width]))].sort((a,b)=>a-b);
  const ys=[...new Set([...rects,...expanded].flatMap(r=>[r.y,r.y+r.height]))].sort((a,b)=>a-b);
  const result=[];let previous=new Map();
  for(let j=0;j<ys.length-1;j++){
   const current=new Map();let start=null;
   for(let i=0;i<xs.length;i++){
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    const filled=i<xs.length-1&&!rects.some(r=>contains(r,x,y))&&expanded.some(r=>contains(r,x,y));
    if(filled&&start===null)start=xs[i];
    if(!filled&&start!==null){
     const width=xs[i]-start,key=start+':'+width,old=previous.get(key);
     const box=old||{x:start,y:ys[j],width,height:0};box.height+=ys[j+1]-ys[j];
     if(!old)result.push(box);current.set(key,box);start=null;
    }
   }
   previous=current;
  }
  return result;
 }
 function union(rects){
  const xs=[...new Set(rects.flatMap(r=>[r.x,r.x+r.width]))].sort((a,b)=>a-b);
  const ys=[...new Set(rects.flatMap(r=>[r.y,r.y+r.height]))].sort((a,b)=>a-b);
  const cells=new Set(),key=(i,j)=>i+','+j;
  let area=0;const lines=new Map();
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
   if(rects.some(r=>contains(r,(xs[i]+xs[i+1])/2,(ys[j]+ys[j+1])/2))){cells.add(key(i,j));area+=(xs[i+1]-xs[i])*(ys[j+1]-ys[j]);}
  }
  function edge(axis,line,start,end,side){
   const k=axis+':'+line+':'+side;
   if(!lines.has(k))lines.set(k,{axis,line,side,intervals:[]});
   lines.get(k).intervals.push([start,end]);
  }
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++)if(cells.has(key(i,j))){
   if(!cells.has(key(i,j-1)))edge('h',ys[j],xs[i],xs[i+1],-1);
   if(!cells.has(key(i,j+1)))edge('h',ys[j+1],xs[i],xs[i+1],1);
   if(!cells.has(key(i-1,j)))edge('v',xs[i],ys[j],ys[j+1],-1);
   if(!cells.has(key(i+1,j)))edge('v',xs[i+1],ys[j],ys[j+1],1);
  }
  const edges=[];
  for(const {axis,line,side,intervals} of lines.values()){
   intervals.sort((a,b)=>a[0]-b[0]);let span=null;
   for(const interval of intervals){
    if(span&&span[1]===interval[0])span[1]=interval[1];
    else {span=[...interval];edges.push({axis,line,side,span});}
   }
  }
  return {area,edges};
 }
 function subtract(rects,cut){
  const result=[];
  for(const r of rects){
   const left=Math.max(r.x,cut.x),right=Math.min(r.x+r.width,cut.x+cut.width);
   const top=Math.max(r.y,cut.y),bottom=Math.min(r.y+r.height,cut.y+cut.height);
   if(left>=right||top>=bottom){result.push({...r});continue;}
   const pieces=[
    {x:r.x,y:r.y,width:r.width,height:top-r.y},
    {x:r.x,y:bottom,width:r.width,height:r.y+r.height-bottom},
    {x:r.x,y:top,width:left-r.x,height:bottom-top},
    {x:right,y:top,width:r.x+r.width-right,height:bottom-top}
   ];
   for(const p of pieces)if(p.width>0&&p.height>0)result.push({...r,...p});
  }
  return result;
 }
 function defaultThickness(rects,wall){
  const x=(wall.x1+wall.x2)/2,y=(wall.y1+wall.y2)/2,h=wall.y1===wall.y2;
  const covered=(a,b)=>rects.some(r=>a>=r.x&&a<=r.x+r.width&&b>=r.y&&b<=r.y+r.height);
  return covered(x-(h?0:.001),y-(h?.001:0))!==covered(x+(h?0:.001),y+(h?.001:0))?30:10;
 }
 function outerWalls(rects,physicalWalls){
  if(!physicalWalls?.some(s=>s.thickness!==undefined))return shell(rects,30);
  const pieces=[];let custom=false;
  for(const e of union(rects).edges){
   const matches=physicalWalls.filter(s=>(s.y1===s.y2)===(e.axis==='h')&&(e.axis==='h'?s.y1:s.x1)===e.line);
   const cuts=[...new Set([...e.span,...matches.flatMap(s=>e.axis==='h'?[s.x1,s.x2]:[s.y1,s.y2]).filter(v=>v>e.span[0]&&v<e.span[1])])].sort((a,b)=>a-b);
   for(let i=1;i<cuts.length;i++){
    const start=cuts[i-1],end=cuts[i],wall=matches.find(s=>(e.axis==='h'?s.x1:s.y1)<=start&&(e.axis==='h'?s.x2:s.y2)>=end);
    const t=wall?.thickness??30;custom||=t!==30;
    const a=start-(start===e.span[0]?t:0),b=end+(end===e.span[1]?t:0);
    pieces.push(e.axis==='h'?{x:a,y:e.line+(e.side<0?-t:0),width:b-a,height:t}:{x:e.line+(e.side<0?-t:0),y:a,width:t,height:b-a});
   }
  }
  if(!custom)return shell(rects,30);
  let outside=pieces;for(const r of rects)outside=subtract(outside,r);return outside;
 }
 function layout(rects,physicalWalls=null){
  const xs=[...new Set(rects.flatMap(r=>[r.x,r.x+r.width]))].sort((a,b)=>a-b);
  const ys=[...new Set(rects.flatMap(r=>[r.y,r.y+r.height]))].sort((a,b)=>a-b);
  const members=(x,y)=>[...new Set(rects.filter(r=>contains(r,x,y)).map(roomKey))].sort((a,b)=>a-b).join(',');
  const segments=[];
  function add(axis,line,start,end,a,b){
   if(!a||!b||a===b)return;
   const previous=segments[segments.length-1];
   if(previous&&previous.axis===axis&&previous.line===line&&previous.end===start)previous.end=end;
   else segments.push({axis,line,start,end});
  }
  for(let i=1;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
   const y=(ys[j]+ys[j+1])/2;
   add('v',xs[i],ys[j],ys[j+1],members((xs[i-1]+xs[i])/2,y),members((xs[i]+xs[i+1])/2,y));
  }
  for(let j=1;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
   const x=(xs[i]+xs[i+1])/2;
   add('h',ys[j],xs[i],xs[i+1],members(x,(ys[j-1]+ys[j])/2),members(x,(ys[j]+ys[j+1])/2));
  }
  if(physicalWalls){
   // Debljina zida dolazi od stvarnih poteza, uključujući slijepe pregrade.
   segments.length=0;
   const covered=(x,y)=>rects.some(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);
   for(const s of physicalWalls){
    const h=s.y1===s.y2,line=h?s.y1:s.x1,start=h?s.x1:s.y1,end=h?s.x2:s.y2;
    const cuts=[...new Set([start,end,...(h?xs:ys).filter(v=>v>start&&v<end)])].sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++){
     const mid=(cuts[i-1]+cuts[i])/2,x=h?mid:line,y=h?line:mid;
     // Samo rub zatvorene prostorije već ima vanjski zid; ostali potezi moraju biti vidljivi.
     if(covered(x-(h?0:.001),y-(h?.001:0))===covered(x+(h?0:.001),y+(h?.001:0)))
      segments.push({axis:h?'h':'v',line,start:cuts[i-1],end:cuts[i],thickness:s.thickness??10});
    }
   }
  }
  const inner=segments.map(s=>{const t=s.thickness??10;return s.axis==='v'?{x:s.line-t/2,y:s.start,width:t,height:s.end-s.start}:{x:s.start,y:s.line-t/2,width:s.end-s.start,height:t};});
  // Kvadratni spoj popunjava vanjski kut dvaju stvarnih okomitih poteza.
  const joints=new Set();
  for(const a of segments)for(const b of segments){
   if(a.axis!=='h'||b.axis!=='v'||b.line<a.start||b.line>a.end||a.line<b.start||a.line>b.end)continue;
   const key=b.line+':'+a.line+':'+(a.thickness??10)+':'+(b.thickness??10);if(joints.has(key))continue;joints.add(key);
   const tx=b.thickness??10,ty=a.thickness??10;inner.push({x:b.line-tx/2,y:a.line-ty/2,width:tx,height:ty});
  }
  const outer=outerWalls(rects,physicalWalls);
  const net=groups(rects).map(group=>{
   let pieces=group.rects;for(const wall of inner)pieces=subtract(pieces,wall);
   const width=pieces.length?Math.max(...pieces.map(p=>p.x+p.width))-Math.min(...pieces.map(p=>p.x)):0;
   const height=pieces.length?Math.max(...pieces.map(p=>p.y+p.height))-Math.min(...pieces.map(p=>p.y)):0;
   return {id:group.id,area:union(pieces).area,width,height};
  });
  let free=rects;for(const wall of inner)free=subtract(free,wall);
  return {outer,inner,net,area:union(free).area,segments};
 }
 return {connected,shell,union,subtract,defaultThickness,layout,roomKey,groups,split};
})();
