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
     if(covered(x-(h?0:.001),y-(h?.001:0))&&covered(x+(h?0:.001),y+(h?.001:0)))
      segments.push({axis:h?'h':'v',line,start:cuts[i-1],end:cuts[i]});
    }
   }
  }
  const inner=segments.map(s=>s.axis==='v'?{x:s.line-5,y:s.start,width:10,height:s.end-s.start}:{x:s.start,y:s.line-5,width:s.end-s.start,height:10});
  const outer=shell(rects,30);
  const net=groups(rects).map(group=>{
   let pieces=group.rects;for(const wall of inner)pieces=subtract(pieces,wall);
   const width=pieces.length?Math.max(...pieces.map(p=>p.x+p.width))-Math.min(...pieces.map(p=>p.x)):0;
   const height=pieces.length?Math.max(...pieces.map(p=>p.y+p.height))-Math.min(...pieces.map(p=>p.y)):0;
   return {id:group.id,area:union(pieces).area,width,height};
  });
  let free=rects;for(const wall of inner)free=subtract(free,wall);
  return {outer,inner,net,area:union(free).area,segments};
 }
 return {connected,shell,union,subtract,layout,roomKey,groups,split};
})();
