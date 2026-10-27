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
 function physicalLayout(rects,walls){
  const outer=[],inner=[],segments=[],physicalParts=[],physicalJoints=[];
  const xs=[...new Set(rects.flatMap(r=>[r.x,r.x+r.width]))],ys=[...new Set(rects.flatMap(r=>[r.y,r.y+r.height]))];
  for(const source of walls){
   const h=source.y1===source.y2,line=h?source.y1:source.x1,start=h?source.x1:source.y1,end=h?source.x2:source.y2;
   const cuts=[...new Set([start,end,...(h?xs:ys).filter(v=>v>start&&v<end)])].sort((a,b)=>a-b);
   for(let i=1;i<cuts.length;i++){
    const a=cuts[i-1],b=cuts[i],piece=h?{x1:a,y1:line,x2:b,y2:line}:{x1:line,y1:a,x2:line,y2:b};
    const exterior=defaultThickness(rects,piece)===30,t=source.thickness??(exterior?30:10);
    const box=h?{x:a,y:line-t/2,width:b-a,height:t}:{x:line-t/2,y:a,width:t,height:b-a};
    (exterior?outer:inner).push(box);segments.push({axis:h?'h':'v',line,start:a,end:b,thickness:t});physicalParts.push({source,box,exterior});
   }
  }
  const seen=new Set();
  for(const a of physicalParts)for(const b of physicalParts){
   if(a.source.y1!==a.source.y2||b.source.x1!==b.source.x2)continue;
   const x=b.source.x1,y=a.source.y1;
   // Spoj postoji samo ako se stvarne osnovne linije točno sijeku ili dodiruju.
   if(x<a.box.x||x>a.box.x+a.box.width||y<b.box.y||y>b.box.y+b.box.height)continue;
   const key=x+':'+y+':'+b.box.width+':'+a.box.height;if(seen.has(key))continue;seen.add(key);
   const box={x:x-b.box.width/2,y:y-a.box.height/2,width:b.box.width,height:a.box.height};
   (a.exterior||b.exterior?outer:inner).push(box);physicalJoints.push({x,y,box,sources:[a.source,b.source]});
  }
  const parent=walls.map((_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const touches=(a,b)=>{
   const ah=a.y1===a.y2,bh=b.y1===b.y2;
   if(ah===bh)return (ah?a.y1===b.y1:a.x1===b.x1)&&Math.max(ah?Math.min(a.x1,a.x2):Math.min(a.y1,a.y2),bh?Math.min(b.x1,b.x2):Math.min(b.y1,b.y2))<=Math.min(ah?Math.max(a.x1,a.x2):Math.max(a.y1,a.y2),bh?Math.max(b.x1,b.x2):Math.max(b.y1,b.y2));
   const h=ah?a:b,v=ah?b:a;return v.x1>=Math.min(h.x1,h.x2)&&v.x1<=Math.max(h.x1,h.x2)&&h.y1>=Math.min(v.y1,v.y2)&&h.y1<=Math.max(v.y1,v.y2);
  };
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++)if(touches(walls[i],walls[j]))parent[root(j)]=root(i);
  const index=new Map(walls.map((wall,i)=>[wall,i])),groupsByRoot=new Map();
  for(const part of physicalParts){const key=root(index.get(part.source));if(!groupsByRoot.has(key))groupsByRoot.set(key,[]);groupsByRoot.get(key).push(part.box);}
  for(const joint of physicalJoints)groupsByRoot.get(root(index.get(joint.sources[0]))).push(joint.box);
  const wallGroups=[...groupsByRoot.values()];let disconnectedOverlap=false;
  for(let i=0;i<wallGroups.length&&!disconnectedOverlap;i++)for(let j=i+1;j<wallGroups.length&&!disconnectedOverlap;j++)for(const a of wallGroups[i])for(const b of wallGroups[j])if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)disconnectedOverlap=true;
  const unjoinedCaps=[],capKeys=new Set(),pointOn=(p,s)=>s.y1===s.y2?p.y===s.y1&&p.x>=Math.min(s.x1,s.x2)&&p.x<=Math.max(s.x1,s.x2):p.x===s.x1&&p.y>=Math.min(s.y1,s.y2)&&p.y<=Math.max(s.y1,s.y2);
  for(const part of physicalParts){const source=part.source,h=source.y1===source.y2;
   for(const n of [1,2]){const p={x:source['x'+n],y:source['y'+n]};if(walls.some(other=>other!==source&&pointOn(p,other)))continue;
    if(h?(p.x<part.box.x||p.x>part.box.x+part.box.width):(p.y<part.box.y||p.y>part.box.y+part.box.height))continue;
    const cap=h?{x1:p.x,y1:part.box.y,x2:p.x,y2:part.box.y+part.box.height}:{x1:part.box.x,y1:p.y,x2:part.box.x+part.box.width,y2:p.y};
    const overlaps=physicalParts.some(other=>other.source!==source&&(h?cap.x1>other.box.x&&cap.x1<other.box.x+other.box.width&&cap.y1<other.box.y+other.box.height&&cap.y2>other.box.y:cap.y1>other.box.y&&cap.y1<other.box.y+other.box.height&&cap.x1<other.box.x+other.box.width&&cap.x2>other.box.x));
    const key=JSON.stringify(cap);if(overlaps&&!capKeys.has(key)){capKeys.add(key);unjoinedCaps.push(cap);}
   }
  }
  disconnectedOverlap||=unjoinedCaps.length>0;
  const boxes=[...outer,...inner];
  const net=groups(rects).map(group=>{let free=group.rects;for(const box of boxes)free=subtract(free,box);return {id:group.id,area:union(free).area,width:free.length?Math.max(...free.map(r=>r.x+r.width))-Math.min(...free.map(r=>r.x)):0,height:free.length?Math.max(...free.map(r=>r.y+r.height))-Math.min(...free.map(r=>r.y)):0};});
  let free=rects;for(const box of boxes)free=subtract(free,box);
  return {outer,inner,net,area:union(free).area,segments,physicalParts,physicalJoints,wallGroups,disconnectedOverlap,unjoinedCaps,centered:true};
 }
 function wallSelection(rects,physicalWalls,wall,layout){
  if(layout.centered){
   const h=wall.y1===wall.y2,line=h?wall.y1:wall.x1,start=h?wall.x1:wall.y1,end=h?wall.x2:wall.y2;
   const same=source=>(source.y1===source.y2)===h&&(h?source.y1:source.x1)===line;
   const result=[];
   for(const part of layout.physicalParts){if(!same(part.source))continue;const box=part.box,a=Math.max(start,h?box.x:box.y),b=Math.min(end,h?box.x+box.width:box.y+box.height);if(b>a)result.push(h?{x:a,y:box.y,width:b-a,height:box.height}:{x:box.x,y:a,width:box.width,height:b-a});}
   for(const joint of layout.physicalJoints)if(joint.sources.some(same)&&(h?joint.x:joint.y)>=start&&(h?joint.x:joint.y)<=end)result.push(joint.box);
   return result;
  }
  const h=wall.y1===wall.y2,line=h?wall.y1:wall.x1,start=h?wall.x1:wall.y1,end=h?wall.x2:wall.y2;
  const mid=(start+end)/2,x=h?mid:line,y=h?line:mid;
  const covered=(a,b)=>rects.some(r=>a>=r.x&&a<=r.x+r.width&&b>=r.y&&b<=r.y+r.height);
  const negative=covered(x-(h?0:.001),y-(h?.001:0)),positive=covered(x+(h?0:.001),y+(h?.001:0));
  const exterior=negative!==positive,t=wall.thickness??(exterior?30:10);
  const across=exterior?(negative?line:line-t):line-t/2;
  const extension=(position,before)=>{
   const continuation=physicalWalls.some(s=>(s.y1===s.y2)===h&&(h?s.y1:s.x1)===line&&
    (before?(h?s.x1:s.y1)<position&&(h?s.x2:s.y2)>=position:(h?s.x2:s.y2)>position&&(h?s.x1:s.y1)<=position));
   if(continuation)return 0;
   if(exterior)return t;
   let reach=0;
   for(const s of physicalWalls)if((s.y1===s.y2)!==h&&(h?s.x1:s.y1)===position&&
    (h?s.y1:s.x1)<=line&&(h?s.y2:s.x2)>=line)reach=Math.max(reach,(s.thickness??defaultThickness(rects,s))/2);
   return reach;
  };
  const a=start-extension(start,true),b=end+extension(end,false);
  const bounds=h?{x:a,y:across,width:b-a,height:t}:{x:across,y:a,width:t,height:b-a};
  const result=[];
  for(const r of [...layout.outer,...layout.inner]){
   const x=Math.max(r.x,bounds.x),y=Math.max(r.y,bounds.y),right=Math.min(r.x+r.width,bounds.x+bounds.width),bottom=Math.min(r.y+r.height,bounds.y+bounds.height);
   if(right>x&&bottom>y)result.push({x,y,width:right-x,height:bottom-y});
  }
  return result;
 }
 function layout(rects,physicalWalls=null){
  if(physicalWalls!==null)return physicalLayout(rects,physicalWalls);
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
  const inner=segments.map(s=>{const t=s.thickness??10;return s.axis==='v'?{x:s.line-t/2,y:s.start,width:t,height:s.end-s.start}:{x:s.start,y:s.line-t/2,width:s.end-s.start,height:t};});
  // Kvadratni spoj popunjava vanjski kut dvaju stvarnih okomitih poteza.
  const joints=new Set();
  for(const a of segments)for(const b of segments){
   if(a.axis!=='h'||b.axis!=='v'||b.line<a.start||b.line>a.end||a.line<b.start||a.line>b.end)continue;
   const key=b.line+':'+a.line+':'+(a.thickness??10)+':'+(b.thickness??10);if(joints.has(key))continue;joints.add(key);
   const tx=b.thickness??10,ty=a.thickness??10;inner.push({x:b.line-tx/2,y:a.line-ty/2,width:tx,height:ty});
  }
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
 return {connected,shell,union,subtract,defaultThickness,wallSelection,layout,roomKey,groups,split};
})();
