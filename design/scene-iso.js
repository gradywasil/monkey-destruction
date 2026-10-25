/* ---------- helpers ---------- */
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(h,t,a)=>{const c=hex(h),k=hex(t);return '#'+c.map((v,i)=>Math.round(v+(k[i]-v)*a).toString(16).padStart(2,'0')).join('')};

/* ---------- shared scene data (game units: x,y tiles; building 8 x 6) ---------- */
const KD={ // w,d,h,color
  desk:[1.1,.6,.5,'desk'],cab:[.45,.5,.85,'cab'],chair:[.4,.4,.4,'chair'],rack:[.7,.7,1.6,'rack'],
  vend:[.7,.7,1.4,'vend'],safe:[.8,.8,1.0,'safe'],statue:[.45,.45,1.0,'statue'],ceo:[2.0,1.0,.7,'ceo'],mon:[.35,.3,.3,'mon']};
const ITEMS=[
 ['desk',.6,.5],['desk',2.0,.5],['desk',.6,4.7],['desk',2.0,4.7],
 ['cab',.3,1.2],['cab',3.0,1.3],['cab',3.0,3.7],
 ['chair',1.0,1.3],['chair',2.4,1.3],['chair',1.1,4.1],['chair',2.5,4.1],
 ['rack',4.0,.4],['rack',4.7,.4],['rack',5.4,.4],['vend',6.4,.4],
 ['ceo',4.6,4.2],['safe',7.0,3.7],['statue',4.0,5.2]];
const MONS=[[.8,.65],[2.2,.65],[.8,4.85],[2.2,4.85]]; // sit on desks (z .5)
const CHAIN=[.5,1.3,2.1,2.9,3.7,4.5,5.3], CY=2.5;
const SWARM=[[4.3,4.4],[4.3,4.9],[4.5,5.4],[5.0,5.45],[5.6,5.45],[6.2,5.45],[6.8,5.2],[6.85,4.7],[6.8,4.3],[6.3,3.95],[5.6,3.95],[5.0,3.95],[4.6,3.95]];

/* ---------- ISOMETRIC renderer (A, B) ---------- */
function iso(T){
  const hw=T.hw||22,hh=T.hh||11,zs=T.zs||26,H=2.0;
  const P=(x,y,z=0)=>[(x-y)*hw,(x+y)*hh-z*zs];
  const pts=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const sw=T.stroke?` stroke="${T.line}" stroke-width="${T.stroke}" stroke-linejoin="round"`:'';
  const L=[]; const add=(k,s,sp)=>L.push({k,s,sp});
  const tri=T.tri||(b=>[mix(b,'#ffffff',T.lt),b,mix(b,'#000000',T.dk)]);
  function box(x,y,w,d,h,base,z0=0,k){
    const c=Array.isArray(base)?base:tri(base);
    const top=[P(x,y,z0+h),P(x+w,y,z0+h),P(x+w,y+d,z0+h),P(x,y+d,z0+h)];
    const lf=[P(x,y+d,z0),P(x+w,y+d,z0),P(x+w,y+d,z0+h),P(x,y+d,z0+h)];
    const rt=[P(x+w,y,z0),P(x+w,y+d,z0),P(x+w,y+d,z0+h),P(x+w,y,z0+h)];
    add(k??(x+w/2+y+d/2+z0*.01),`<g${sw}><polygon points="${pts(lf)}" fill="${c[1]}"/><polygon points="${pts(rt)}" fill="${c[2]}"/><polygon points="${pts(top)}" fill="${c[0]}"/></g>`);
  }
  const faceL=(x,y,w,d,u0,u1,z0,z1,fill,k)=>add(k,`<polygon points="${pts([P(x+u0,y+d,z0),P(x+u1,y+d,z0),P(x+u1,y+d,z1),P(x+u0,y+d,z1)])}" fill="${fill}"/>`);
  const dot=(x,y,z,r,fill,k)=>{const p=P(x,y,z);add(k,`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r}" fill="${fill}"/>`)};
  const poly=(arr,fill,k,extra='')=>add(k,`<polygon points="${pts(arr)}" fill="${fill}" ${extra}/>`);
  const pal=T.pal;

  /* ground slabs */
  add(-300,`<ellipse cx="0" cy="${P(4,3,-.3)[1]+40}" rx="230" ry="60" fill="#000" opacity=".1"/>`);
  box(0,0,8.2,6,.3,pal.slab,-.3,-200);
  box(-4.6,1.5,4.6,3.2,.3,pal.pad,-.3,-199);
  box(5.6,-2.3,2.7,2.3,.3,pal.pad,-.3,-198);
  /* room floors */
  const flo=(x,y,w,d,c)=>poly([P(x,y),P(x+w,y),P(x+w,y+d),P(x,y+d)],c,-150);
  flo(0,0,3.5,6,pal.fA);flo(3.5,0,4.7,3.2,pal.fB);flo(3.5,3.2,4.7,2.8,pal.fC);
  let g='';
  for(let i=0;i<=8;i++){const a=P(i,0),b=P(i,6);g+=`M${a[0]},${a[1]}L${b[0]},${b[1]}`}
  for(let j=0;j<=6;j++){const a=P(0,j),b=P(8,j);g+=`M${a[0]},${a[1]}L${b[0]},${b[1]}`}
  add(-149,`<path d="${g}" stroke="#fff" stroke-opacity="${T.grid}" stroke-width="1" fill="none"/>`);
  /* truck pad stripes */
  add(-148,`<polygon points="${pts([P(-4.4,1.7),P(-.2,1.7),P(-.2,2.0),P(-4.4,2.0)])}" fill="#ffc83d" opacity=".7"/>`);

  /* walls (1-tile destructible chunks) */
  const wall=(x,y,len,axis,h,base=pal.wall,t=.2)=>{for(let i=0;i<len-.001;i+=1){const l=Math.min(1,len-i);axis==='x'?box(x+i,y,l,t,h,base):box(x,y+i,t,l,h,base)}};
  wall(0,0,8.2,'x',H);                       // back (window) wall
  wall(0,.2,1.8,'y',H);wall(0,4,2,'y',H);     // dock wall w/ gap y 2..4
  box(0,2,.2,2,.3,pal.wall,H-.3);              // dock lintel
  wall(0,5.8,8.2,'x',.35,pal.wallLow,.2);      // low cutaway rails
  wall(8,0,6,'y',.35,pal.wallLow,.2);
  wall(3.5,.2,2,'y',H);                        // partition up to breach
  wall(3.5,3.2,2.7,'y',H);                     // partition after breach
  [[3.55,2.3,.45,.45,.2],[3.6,2.75,.5,.4,.14],[3.5,2.95,.4,.25,.25]].forEach(r=>box(r[0],r[1],r[2],r[3],r[4],pal.rubble)); // breach rubble
  wall(3.7,3.2,.6,'x',H);wall(5.2,3.2,2.8,'x',H); // B|C wall
  box(4.3,3.2,.9,.2,H-.15,pal.door);               // locked exec door
  dot(5.0,3.4,.9,2.2,'#ffc83d',20);               // lock knob
  /* cracks on wall face being smashed */
  { const a=P(3.7,4.3,.4),b=P(3.7,4.6,1.0),c=P(3.7,4.9,.6),d=P(3.7,5.1,1.4);
    add(3.7+4.3+.5,`<path d="M${a[0]},${a[1]}L${b[0]},${b[1]}L${c[0]},${c[1]}L${d[0]},${d[1]}" stroke="${T.line||'#555'}" stroke-width="1.4" fill="none"/>`);}
  /* window on back wall */
  faceL(0,0,0,.2,6.3,7.7,.8,1.7,pal.glass,7.1);
  faceL(0,0,0,.2,6.3,7.7,.8,.9,pal.wall,7.12);
  /* cubicle partitions */
  box(1.85,.2,.08,1.3,.75,pal.part);box(1.85,4.5,.08,1.3,.75,pal.part);

  /* items */
  ITEMS.forEach(([k,x,y])=>{const [w,d,h,c]=KD[k];box(x,y,w,d,h,pal[c]);
    if(k==='rack'){[.5,.8,1.15].forEach((z,i)=>{dot(x+.18,y+d,z,1.4,i==1?'#ff5a5a':'#5cff8a',x+y+1.2);dot(x+.52,y+d,z,1.4,'#5cff8a',x+y+1.2)})}
    if(k==='vend'){faceL(x,y,w,d,.12,.48,.25,1.15,'#bfe9ff',x+y+1.2);dot(x+.6,y+d,.8,1.6,'#ffd23f',x+y+1.2)}
    if(k==='safe'){dot(x+.4,y+d,.55,3,'#ffc83d',x+y+1.2);dot(x+.4,y+d,.55,1.2,'#7a5a00',x+y+1.21)}
    if(k==='ceo'){faceL(x,y,w,d,.2,1.8,.1,.55,mix(pal.ceo,'#000',.25),x+y+1.6)}});
  MONS.forEach(([x,y])=>box(x,y,.35,.3,.3,['#7ad7ff','#2b3340','#1d232d'],.5));

  /* truck */
  box(-4.3,2.15,3.9,1.7,.2,'#2b2f38',.1);
  box(-2.7,2.1,2.3,1.8,.3,pal.truck,.3);
  { const a=P(-2.6,3.9,.33),b=P(-.6,3.9,.33);const ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
    add(-.4+3.9+.02,`<text transform="translate(${a[0]+8},${a[1]-4}) rotate(${ang}) skewX(${-ang*0})" font-family="${T.font}" font-weight="900" font-size="11" fill="#2a2a33">IMI  FLATBED</text>`);}
  box(-2.7,2.1,2.3,.12,.3,pal.truckRail,.6);box(-2.7,3.78,2.3,.12,.3,pal.truckRail,.6);box(-2.7,2.1,.12,1.8,.3,pal.truckRail,.6);
  box(-4.3,2.2,1.55,1.6,.95,pal.truck,.3);
  faceL(-4.3,2.2,1.55,1.6,.2,1.1,.75,1.15,pal.glass,-2.75+3.8+.05);
  [-3.7,-1.9,-.9].forEach(x=>{const p=P(x,3.95,.15);add(x+3.95+.3,`<circle cx="${p[0]}" cy="${p[1]}" r="6.5" fill="#1c1f26"${sw}/><circle cx="${p[0]}" cy="${p[1]}" r="2.4" fill="#9aa0aa"/>`)});
  box(-2.5,2.3,.45,.5,.85,pal.cab,.6);box(-1.9,2.35,1.1,.6,.5,pal.desk,.6);box(-1.7,2.45,.35,.3,.3,['#7ad7ff','#2b3340','#1d232d'],1.1);
  box(-2.5,3.0,.8,.8,.8,pal.safe,.6);box(-1.3,3.0,.4,.4,.4,pal.chair,.6);box(-1.7,2.95,.3,.3,.3,pal.mon,.6);

  /* outside net + rope + statue in flight */
  [[5.9,-2.0],[7.9,-2.0],[7.9,-.6],[5.9,-.6]].forEach(([x,y])=>box(x-.04,y-.04,.08,.08,.9,'#8a6a45',0,x+y));
  poly([P(5.9,-2.0,.6),P(7.9,-2.0,.6),P(7.9,-.6,.6),P(5.9,-.6,.6)],T.net,5.6,'opacity=".85"');
  { let n='';for(let i=0;i<=4;i++){const a=P(5.9+i*.5,-2.0,.6),b=P(5.9+i*.5,-.6,.6);n+=`M${a[0]},${a[1]}L${b[0]},${b[1]}`;const c=P(5.9,-2+i*.35,.6),d=P(7.9,-2+i*.35,.6);n+=`M${c[0]},${c[1]}L${d[0]},${d[1]}`}
    add(5.62,`<path d="${n}" stroke="#fff" stroke-opacity=".7" fill="none"/>`);}
  { const a=P(7.0,.2,1.7),b=P(7.0,-1.3,.65);add(9,`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${T.accent}" stroke-width="2.2" stroke-dasharray="1 0"/>`);}
  box(6.85,-.75,.3,.3,.45,pal.statue,.9,9);
  { const p=P(7.0,-.9,2.0);add(9.1,`<text x="${p[0]}" y="${p[1]}" text-anchor="middle" font-size="9" font-weight="800" fill="${T.label}" font-family="${T.font}">DROP ↓</text>`);}

  /* chain gang + items hopping between hands */
  const lerp=(a,b,t)=>a+(b-a)*t;
  const chainPts=[[-.9,2.7,.6],...CHAIN.map(x=>[x,CY,0])];
  let arcs='';
  for(let i=0;i<chainPts.length-1;i++){
    const a=chainPts[i],b=chainPts[i+1];const pa=P(a[0],a[1],a[2]+.75),pb=P(b[0],b[1],b[2]+.75);
    const mid=[lerp(pa[0],pb[0],.5),lerp(pa[1],pb[1],.5)-14];
    arcs+=`<path d="M${pa[0]},${pa[1]}Q${mid[0]},${mid[1]} ${pb[0]},${pb[1]}" fill="none" stroke="${T.accent}" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round"/>`;
    const ip=[lerp(pa[0],pb[0],.5),lerp(pa[1],pb[1],.5)-7];
    const col=[pal.mon,pal.cab,pal.chair,pal.desk,pal.mon,pal.cab][i%6];
    arcs+=`<rect x="${ip[0]-4}" y="${ip[1]-4}" width="8" height="8" rx="1.5" fill="${col}"${sw}/>`;
  }
  add(30,arcs);
  /* monkeys */
  const mon=(x,y,kind,o={})=>{const p=P(x,y,o.z||0);if(T.sprites){add(x+y+.35,'',{kind,f:o.f||1,up:!!o.up,x:p[0],y:p[1]});return}add(x+y+.35,mk(p[0],p[1],kind,o))};
  function mk(px,py,kind,o={}){
    const s=(o.s||.85)*(T.ms||1),f=o.f||1,fur=T.fur,face=T.face;
    const col={breacher:'#ff7a1a',hauler:'#3b8cff',rigger:'#25b86a',decoy:'#c8a26a',plain:'#9aa0aa'}[kind];
    const mst=T.mstroke??T.stroke;const ln=mst?` stroke="${T.line}" stroke-width="${T.mstroke||1.4}" stroke-linejoin="round"`:'';
    let g=`<g transform="translate(${px.toFixed(1)},${py.toFixed(1)}) scale(${s*f},${s})"${ln}>`;
    g+=`<ellipse cx="0" cy="0" rx="7" ry="3" fill="#000" opacity=".18" stroke="none"/>`;
    g+=`<path d="M3 -5 q10 -1 7 -11" fill="none" stroke="${fur}" stroke-width="2.4" stroke-linecap="round"/>`;
    if(kind==='decoy'){g+=`<path d="M-6.5 0 L-5 -13 L5 -13 L6.5 0 Z" fill="${col}"/><path d="M-5.5 -6 H5.5" stroke="#8c6d3f" stroke-width="1.4"/><path d="M-2 -13 L0 -8 L2 -13" fill="#e8d3a8" stroke="none"/>`}
    else g+=`<rect x="-4.6" y="-12" width="9.2" height="11" rx="3.5" fill="${col}"/>`;
    if(kind==='hauler'||o.up)g+=`<path d="M-4 -9 L-7.5 -17.5 M4 -9 L7.5 -17.5" stroke="${fur}" stroke-width="2.3" stroke-linecap="round" fill="none"/>`;
    if(kind==='rigger')g+=`<path d="M-4.6 -11 L4.6 -2 M4.6 -11 L-4.6 -2" stroke="#fff" stroke-width="1.6" fill="none"/><circle cx="6.5" cy="-5" r="3" fill="none" stroke="#ff9f1c" stroke-width="1.6"/>`;
    g+=`<circle cx="-6.6" cy="-18" r="2.8" fill="${fur}"/><circle cx="6.6" cy="-18" r="2.8" fill="${fur}"/>`;
    g+=`<circle cx="0" cy="-17.5" r="6.6" fill="${fur}"/><ellipse cx="0" cy="-16.2" rx="4.4" ry="3.6" fill="${face}" stroke="none"/>`;
    if(kind==='decoy')g+=`<circle cx="-2" cy="-17" r="2.4" fill="#fff" stroke="#222" stroke-width="1"/><circle cx="2" cy="-17" r="2.4" fill="#fff" stroke="#222" stroke-width="1"/><path d="M-0.4 -17H0.4" stroke="#222"/><circle cx="-2" cy="-17" r=".9" fill="#222" stroke="none"/><circle cx="2" cy="-17" r=".9" fill="#222" stroke="none"/>`;
    else g+=`<circle cx="-1.8" cy="-17" r="${T.eye||1}" fill="#2b1b12" stroke="none"/><circle cx="1.8" cy="-17" r="${T.eye||1}" fill="#2b1b12" stroke="none"/>`;
    g+=`<ellipse cx="0" cy="-14.5" rx="2" ry="1.2" fill="#e4b98e" stroke="none"/>`;
    if(kind==='breacher')g+=`<path d="M-7 -20.5 a7 6.2 0 0 1 14 0 z" fill="#ffd23f"/><rect x="-8" y="-21" width="16" height="2.2" rx="1" fill="#ffd23f"/><path d="M7 -8 L12 -19" stroke="#6b4429" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="8.5" y="-25" width="7.5" height="5" rx="1" fill="#808892" transform="rotate(25 12 -22)"/>`;
    if(kind==='rigger')g+=`<path d="M-6.6 -20.5 a6.6 5 0 0 1 13.2 0 z" fill="#25b86a"/>`;
    if(kind==='hauler')g+=`<path d="M-6.6 -20.5 a6.6 5 0 0 1 13.2 0 z" fill="#3b8cff"/>`;
    if(kind==='decoy')g+=`<ellipse cx="0" cy="-22" rx="8.5" ry="2.2" fill="#555a66"/><rect x="-4.5" y="-27.5" width="9" height="6" rx="2" fill="#555a66"/>`;
    return g+'</g>';
  }
  function inspector(x,y){const p=P(x,y);if(T.sprites){add(x+y+.35,'',{kind:'inspector',f:-1,x:p[0],y:p[1]});return}add(x+y+.35,`<g transform="translate(${p[0]},${p[1]}) scale(1.05)"${T.stroke?` stroke="${T.line}" stroke-width="1.4" stroke-linejoin="round"`:''}><ellipse rx="7.5" ry="3" fill="#000" opacity=".18" stroke="none"/><rect x="-5.5" y="-14" width="11" height="13" rx="3" fill="#6b7482"/><path d="M0 -13 L-1.5 -7 L0 -5 L1.5 -7Z" fill="#e5473d" stroke="none"/><circle cy="-19" r="6" fill="#f1cfa5"/><path d="M-6 -22 H6" stroke="#444" stroke-width="2"/><rect x="5" y="-12" width="7" height="9" rx="1" fill="#fff" transform="rotate(12 8 -8)"/><path d="M6.5 -9 h4 M6.5 -7 h4" stroke="#999" stroke-width=".8" fill="none"/><path d="M-2.5 -19.5 l1.6 .8 M2.5 -19.5 l-1.6 .8" stroke="#222" stroke-width="1.1" fill="none"/></g>`)}
  const bubble=(x,y,z,txt,bg)=>{const p=P(x,y,z);add(40,`<g transform="translate(${p[0]},${p[1]})"><rect x="-9" y="-9" width="18" height="18" rx="9" fill="${bg}"${T.stroke?` stroke="${T.line}" stroke-width="1.6"`:''}/><text y="4.5" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="${T.font}">${txt}</text></g>`)};

  mon(-.9,2.7,'hauler',{z:.6,f:1});
  CHAIN.forEach((x,i)=>mon(x,CY,'hauler',{f:1}));
  mon(1.5,1.9,'plain',{up:1});            // manual-start thrower
  { const a=P(1.5,1.9,.9),b=P(.6,2.4,.9);add(30.1,`<path d="M${a[0]},${a[1]}Q${(a[0]+b[0])/2},${a[1]-22} ${b[0]},${b[1]}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" stroke-dasharray="2 3"/>`);box(1.2,1.6,.3,.3,.3,pal.chair,1.0,30.2)}
  mon(3.1,4.6,'breacher',{f:-1});mon(4.75,2.95,'breacher',{f:-1});
  mon(6.3,1.55,'rigger',{f:1});mon(7.35,1.55,'rigger',{f:-1});
  inspector(4.9,1.75);mon(5.5,1.9,'decoy',{f:-1,s:1});mon(4.35,1.9,'decoy',{f:1,s:1});
  bubble(4.9,1.75,1.7,'!','#e5473d');
  SWARM.forEach(([x,y],i)=>mon(x,y,'hauler',{f:i%2?1:-1,up:1,s:.78}));
  /* dust */
  [[3.5,2.6,.4],[3.8,2.4,.7],[3.4,2.9,.9],[4.7,3.1,.5],[5.0,3.0,.9]].forEach(([x,y,z],i)=>{const p=P(x,y,z);add(35,`<circle cx="${p[0]}" cy="${p[1]}" r="${6+i%3*2}" fill="#fff" opacity=".6"/>`)});
  /* whistle ring */
  { let d='';for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,p=P(5.6+1.95*Math.cos(a),4.7+1.35*Math.sin(a));d+=(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)}
    add(-120,`<path d="${d}Z" fill="${T.accent}" fill-opacity=".28" stroke="${T.accent}" stroke-width="2" stroke-dasharray="5 4"/>`);
    const p=P(5.6,4.7,2.2);
    add(45,`<g transform="translate(${p[0]},${p[1]})"><rect x="-47" y="-11" width="94" height="22" rx="11" fill="${T.accent}"${T.stroke?` stroke="${T.line}" stroke-width="2"`:''}/><text y="4" text-anchor="middle" font-size="11" font-weight="900" fill="#2a2a33" font-family="${T.font}">×13 · HEAVE!</text></g>`);}
  /* labels */
  const lab=(x,y,z,t)=>{const p=P(x,y,z);add(44,`<text x="${p[0]}" y="${p[1]}" text-anchor="middle" font-size="8.5" font-weight="800" letter-spacing=".08em" fill="${T.label}" opacity=".8" font-family="${T.font}">${t}</text>`)};
  lab(1.7,3.4,0,'OPEN PLAN');lab(5.4,2.6,0,'SERVER RM');lab(7.1,5.5,0,'C-SUITE');
  { const p=P(-2,3,2.1);add(44,`<text x="${p[0]}" y="${p[1]}" text-anchor="middle" font-size="9" font-weight="800" fill="${T.label}" font-family="${T.font}">LOADING DOCK ▸</text>`);}

  L.sort((a,b)=>a.k-b.k);iso.LIST=L;iso.P=P;
  const ov=[];
  if(T.noText) L.forEach(o=>{o.s=o.s.replace(/<text([^>]*)>([^<]*)<\/text>/g,(m,at,t)=>{
    if(/rotate/.test(at)) return '';
    let x=+((/\sx="([-\d.]+)"/.exec(at)||[0,0])[1]), y=+((/\sy="([-\d.]+)"/.exec(at)||[0,0])[1]);
    const g=/^<g transform="translate\(([-\d.]+),([-\d.]+)\)/.exec(o.s);
    if(g&&!/\sx="/.test(at)){x+=+g[1];y+=+g[2]}
    ov.push({x,y:y-3,t});return ''})});
  iso.OV=ov;
  let body=L.map(o=>o.s).join('');
  return `<svg viewBox="${T.vb||'-188 -130 396 450'}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${T.deco||''}${body}</svg>`;
}

