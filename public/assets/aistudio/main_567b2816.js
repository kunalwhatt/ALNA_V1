/* al:na — scripts */
const $=id=>document.getElementById(id);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* layout: place the quote just under the top bar */
function layoutTop(){document.documentElement.style.setProperty('--top-h',$('top').offsetHeight-parseFloat(getComputedStyle($('top')).paddingTop)+12+'px');}

/* quote */
(function(){const q=$('quote');const w=q.textContent.trim().split(' ');q.textContent='';
  w.forEach((x,i)=>{const s=document.createElement('span');s.className='w';s.setAttribute('aria-hidden','true');s.textContent=x;s.style.animationDelay=(0.95+i*0.15)+'s';q.appendChild(s);if(i<w.length-1)q.appendChild(document.createTextNode(' '));});})();

/* ripple */
document.addEventListener('pointerdown',e=>{const el=e.target.closest('.rip');if(!el)return;const r=el.getBoundingClientRect();const d=Math.max(r.width,r.height)*2;
  const s=document.createElement('span');s.className='ripple';s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;el.appendChild(s);setTimeout(()=>s.remove(),650);});

/* counter */
const START=new Date('2022-08-03T00:00:00+05:30');const pad=n=>String(n).padStart(2,'0');
function diff(now){let y=now.getFullYear()-START.getFullYear(),m=now.getMonth()-START.getMonth(),d=now.getDate()-START.getDate();
  if(d<0){m--;d+=new Date(now.getFullYear(),now.getMonth(),0).getDate();}if(m<0){y--;m+=12;}
  const ms=now-START;return {y,m,d,h:Math.floor(ms/3.6e6)%24,mi:Math.floor(ms/6e4)%60,s:Math.floor(ms/1e3)%60,total:Math.floor(ms/864e5)};}
function tick(){const t=diff(new Date());
  $('cYmd').textContent=`${t.y}y ${t.m}m ${t.d}d`;$('cH').textContent=pad(t.h);$('cM').textContent=pad(t.mi);$('cS').textContent=pad(t.s);
  $('y').textContent=t.y;$('mo').textContent=t.m;$('d').textContent=t.d;$('h').textContent=pad(t.h);$('mi').textContent=pad(t.mi);$('s').textContent=pad(t.s);
  $('total').textContent=t.total.toLocaleString('en-IN');}
tick();setInterval(tick,1000);

/* progress count-up */
setTimeout(()=>{if(reduce){$('pct').textContent='34%';return;}const t0=performance.now();(function f(n){const p=Math.min(1,(n-t0)/2200);const e=1-Math.pow(1-p,3);$('pct').textContent=Math.round(34*e)+'%';if(p<1)requestAnimationFrame(f);})(t0);},5600);

/* bottom sheet */
const sheet=$('sheet'),scrim=$('scrim');
function openSheet(){sheet.classList.add('on');scrim.classList.add('on');sheet.setAttribute('aria-hidden','false');sheet.style.transform='';setTimeout(()=>$('close').focus(),300);}
function closeSheet(){sheet.classList.remove('on');scrim.classList.remove('on');sheet.setAttribute('aria-hidden','true');sheet.style.transform='';$('panel').focus();}
$('panel').addEventListener('click',openSheet);$('close').addEventListener('click',closeSheet);scrim.addEventListener('click',closeSheet);
addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet.classList.contains('on'))closeSheet();});
(function(){let y0=null,dy=0;
  sheet.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;y0=e.clientY;dy=0;sheet.style.transition='none';sheet.setPointerCapture(e.pointerId);});
  sheet.addEventListener('pointermove',e=>{if(y0==null)return;dy=Math.max(0,e.clientY-y0);sheet.style.transform=`translateY(${dy}px)`;});
  sheet.addEventListener('pointerup',()=>{if(y0==null)return;sheet.style.transition='';y0=null;if(dy>90)closeSheet();else sheet.style.transform='';});})();

/* visits + last seen */
function ago(ts){if(!ts)return 'First visit';const s=Math.max(0,(Date.now()-ts)/1000);if(s<45)return 'Just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' hr ago';return Math.round(s/86400)+' days ago';}
let lastTs=null;
function renderLast(){const a=ago(lastTs);$('lastSeen').textContent=a;$('lastSeen2').firstChild.nodeValue=a;
  $('lastSeenExact').textContent=lastTs?new Date(lastTs).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';}
setInterval(renderLast,30000);
function showVisits(n){const v=Number(n).toLocaleString('en-IN');const el=$('visits');el.textContent=v;$('visits2').textContent=v;el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
function counted(){try{return sessionStorage.getItem('counted')==='1'}catch(e){return false}}
function markCounted(){try{sessionStorage.setItem('counted','1')}catch(e){}}
function localFallback(){let c=0,prev=null;try{c=parseInt(localStorage.getItem('visits')||'0',10);prev=parseInt(localStorage.getItem('lastSeen')||'',10)||null}catch(e){}
  if(!counted()){c++;markCounted();try{localStorage.setItem('visits',c);localStorage.setItem('lastSeen',Date.now())}catch(e){}}
  lastTs=prev;renderLast();showVisits(c);}
(async function(){let db=null;try{if(window.claude&&window.claude.use)db=await window.claude.use('db');}catch(e){}
  if(!db){localFallback();return;}
  const ref=db.doc('stats/site');
  try{const snap=await ref.get();const data=snap.exists?(snap.data()||{}):{};let count=Number(data.count)||0;lastTs=Number(data.lastSeen)||null;
    if(!counted()){count++;try{await ref.set({count,lastSeen:Date.now()});markCounted();}catch(e){count--;}}
    renderLast();showVisits(count);
    ref.onSnapshot(s=>{const d=s.exists?(s.data()||{}):{};if(d.count!=null&&String(d.count)!==$('visits').textContent.replace(/,/g,''))showVisits(d.count);},()=>{});
  }catch(e){localFallback();}})();

/* visitor IP */
(async function(){
  try{const c=new AbortController();const to=setTimeout(()=>c.abort(),3500);const r=await fetch('https://api.ipify.org?format=json',{signal:c.signal});clearTimeout(to);const j=await r.json();
    $('ip').textContent=j.ip||'—';$('ip2').textContent=j.ip||'—';}
  catch(e){$('ip').textContent='Hidden';$('ip2').innerHTML='Hidden<small>shows on your domain</small>';}})();

/* scene geometry */
const stage=$('stage');const HZR=.62;let geo={};
function measure(){const sr=stage.getBoundingClientRect(),lr=$('lampHeart').getBoundingClientRect();
  geo={W:sr.width,H:sr.height,hz:sr.height*HZR,lx:lr.left-sr.left+lr.width/2,ly:lr.top-sr.top+lr.height/2,dockTop:document.querySelector('.dock').getBoundingClientRect().top};
  const b=$('beam');b.style.width=(geo.lx+80)+'px';b.style.left='-80px';b.style.top=(geo.ly-85)+'px';
  const g=$('glow');g.style.left=geo.lx+'px';g.style.top=geo.ly+'px';}

/* heart breaks: one half lights the lamp, the other sails away */
let lit=false;
function lightUp(){lit=true;['lampHeart','lampG'].forEach(i=>$(i).classList.add('lit'));$('sailHeart').classList.add('on');$('glow').classList.add('on');$('beam').classList.add('on');$('boat').classList.add('on');}
function fly(){
  measure();$('hnames').classList.add('gone');$('boat').classList.add('on');let done=0;
  [[$('halfL'),$('lampHeart'),-1],[$('halfR'),$('sailHeart'),1]].forEach(([el,target,dir])=>{
    const a=el.getBoundingClientRect(),b=target.getBoundingClientRect();
    const dx=(b.left+b.width/2)-(a.left+a.width/2),dy=(b.top+b.height/2)-(a.top+a.height/2),s=b.width/a.width;
    const an=el.animate([{transform:'translate(0,0) rotate(0) scale(1)'},{transform:`translate(${dir*14}px,6px) rotate(${dir*9}deg) scale(1)`,offset:.22},
      {transform:`translate(${dir*18}px,0) rotate(${dir*11}deg) scale(.95)`,offset:.38},{transform:`translate(${dx}px,${dy}px) rotate(0) scale(${s})`}],
      {duration:2600,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
    an.onfinish=()=>{el.style.transition='opacity .5s';el.style.opacity='0';if(++done===2)lightUp();};});
}
function start(){layoutTop();measure();if(reduce){$('bheart').style.display='none';lightUp();return;}setTimeout(fly,3700);}
addEventListener('load',start);
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{layoutTop();measure();size();},200)});

/* beam sweep + heart reflections */
const heartCols=['#B8304A','#D9566C','#F2C230','#FCF9F0'];let lastSpawn=0;
function spawnHeart(x,y){const h=document.createElement('span');h.className='wheart';const sz=8+Math.random()*10;
  h.style.cssText=`left:${x-sz/2}px;top:${y}px;width:${sz}px;height:${sz*.9}px`;
  h.innerHTML=`<svg viewBox="0 0 200 180"><use href="#hp" fill="${heartCols[Math.floor(Math.random()*4)]}"/></svg>`;stage.appendChild(h);setTimeout(()=>h.remove(),2500);}
function beamLoop(ts){const t=ts/1000;const a=-5+11*Math.sin(t*.55);
  $('beam').style.transform=`rotate(${a}deg) scaleY(${.85+.25*Math.sin(t*1.1)})`;
  if(lit&&a<-3&&ts-lastSpawn>130&&geo.W){lastSpawn=ts;const th=(a+(Math.random()-.5)*5)*Math.PI/180;const dx=-Math.cos(th),dy=-Math.sin(th);
    const maxY=Math.min(geo.H,geo.dockTop||geo.H)-14;const y=geo.hz+10+Math.random()*Math.max(10,maxY-geo.hz-10);const k=(y-geo.ly)/dy;const x=geo.lx+k*dx;
    if(dy>0&&x>8&&x<geo.lx-40)spawnHeart(x,y);}
  requestAnimationFrame(beamLoop);}
if(!reduce)requestAnimationFrame(beamLoop);else $('beam').style.transform='rotate(-6deg)';

/* painted sky + sea, with finger brush */
const c=$('paint'),ctx=c.getContext('2d');let W,H,HZ,parts=[],t=0;
const skyCols=['#D8EAE8','#FCF9F0','#B7CBE8','#9DB8E0','#F2C230','#E9F1EE'];
const seaCols=['#8FD0CB','#3E86A8','#B9E3DF','#FCF9F0','#5FAFC0','#22418A'];
const touchCols=['#F2C230','#D9566C','#3F64B8','#C9892B'];
function spawn(){const sea=Math.random()<.5;const y=sea?HZ+Math.random()*(H-HZ):Math.random()*HZ;const r=Math.random();const pal=sea?seaCols:skyCols;
  const idx=sea?(r<.35?0:r<.55?1:r<.72?2:r<.86?3:r<.96?4:5):(r<.32?0:r<.55?1:r<.72?2:r<.85?3:r<.93?4:5);
  return {x:Math.random()*W,y,sea,life:50+Math.random()*150,col:pal[idx],lw:sea?1.6+Math.random()*3:1.2+Math.random()*2.6};}
function paintBg(a){ctx.globalAlpha=a;const g=ctx.createLinearGradient(0,0,0,HZ);g.addColorStop(0,'#E4EFF1');g.addColorStop(1,'#F6F3E4');ctx.fillStyle=g;ctx.fillRect(0,0,W,HZ);
  const s=ctx.createLinearGradient(0,HZ,0,H);s.addColorStop(0,'#BFE5E0');s.addColorStop(1,'#7FC2C4');ctx.fillStyle=s;ctx.fillRect(0,HZ,W,H-HZ);ctx.globalAlpha=1;}
function size(){const dpr=Math.min(devicePixelRatio||1,2);W=stage.clientWidth;H=stage.clientHeight;HZ=H*HZR;c.width=W*dpr;c.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  paintBg(1);parts=Array.from({length:Math.round(Math.min(520,W*H/1300))},spawn);}
function angle(p){
  if(p.sea){const depth=(p.y-HZ)/(H-HZ);return Math.sin(p.x*.012+t*1.2+p.y*.05)*(.25+depth*.35)+Math.sin(t*.4)*.05;}
  let a=Math.sin(p.x*.0042+t*.25)*Math.cos(p.y*.005-t*.18)*Math.PI*1.1;
  for(const [cx,cy,r] of [[W*.06,H*.3,Math.min(W,H)*.22],[W*.6,H*.26,Math.min(W,H)*.3]]){const dx=p.x-cx,dy=p.y-cy,w=Math.exp(-(dx*dx+dy*dy)/(2*r*r));a=a*(1-w)+(Math.atan2(dy,dx)+Math.PI/2+.2)*w;}
  return a;}
function frame(){t+=.006;paintBg(.04);ctx.lineCap='round';
  for(const p of parts){const a=angle(p);const sp=p.touch?2:p.sea?1.5:1.2;const nx=p.x+Math.cos(a)*sp,ny=p.y+Math.sin(a)*sp;
    ctx.globalAlpha=p.touch?.7:p.sea?.5:.4;ctx.strokeStyle=p.col;ctx.lineWidth=p.lw;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(nx,ny);ctx.stroke();p.x=nx;p.y=ny;
    const crossed=!p.touch&&(p.sea?p.y<HZ+2:p.y>HZ-2);
    if(--p.life<0||p.x<-5||p.x>W+5||p.y<-5||p.y>H+5||crossed){if(p.touch)p.dead=true;else Object.assign(p,spawn());}}
  parts=parts.filter(p=>!p.dead);
  ctx.globalAlpha=.55;ctx.strokeStyle='#FCF9F0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,HZ);for(let x=0;x<=W;x+=12)ctx.lineTo(x,HZ+Math.sin(x*.05+t*3)*1.2);ctx.stroke();ctx.globalAlpha=1;
  if(!reduce)requestAnimationFrame(frame);}
let lastAdd=0;
c.addEventListener('pointermove',e=>{if(reduce)return;const n=performance.now();if(n-lastAdd<16)return;lastAdd=n;
  for(let i=0;i<3;i++){const sea=e.clientY>HZ;parts.push({x:e.clientX+(Math.random()-.5)*14,y:e.clientY+(Math.random()-.5)*14,sea,life:40+Math.random()*40,col:touchCols[Math.floor(Math.random()*4)],lw:2+Math.random()*3,touch:true});}
  if(parts.length>900)parts.splice(0,parts.length-900);},{passive:true});
size();if(reduce){for(let i=0;i<220;i++)frame();}else requestAnimationFrame(frame);
