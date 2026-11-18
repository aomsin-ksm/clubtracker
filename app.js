(function(){
'use strict';
var SESS='lumina.session', THEME='lumina.theme';
/* URL ของ Apps Script Web App ที่ผูกกับชีตบัญชีผู้ใช้ (ได้มาจากขั้นตอน Deploy) */
var ACCOUNTS_API='https://script.google.com/macros/s/AKfycbw7BwmfyqfRsGbVcy2idp6-iahW26SfqNxishJ615O43FOZGMEQka2guYYDUT4GV6d2xw/exec';
/* OAuth Client ID จาก Google Cloud Console (ลงท้ายด้วย .apps.googleusercontent.com) ต้องตรงกับใน Code.gs */
var GOOGLE_CLIENT_ID='272476596276-5b3umo1qd6983aioftrui6reso4i23cv.apps.googleusercontent.com';
var $=function(s,r){return (r||document).querySelector(s)};
var mem={};
function lsGet(k){try{var v=localStorage.getItem(k);if(v!==null)return v}catch(e){}return mem[k]===undefined?null:mem[k]}
function lsSet(k,v){mem[k]=v;try{localStorage.setItem(k,v)}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function baht(n){var s=Math.round(Math.abs(n)).toLocaleString('en-US');return (n<0?'-':'')+'฿'+s}
function pad(n,w){return String(n).padStart(w,'0')}
function isoOf(d){return d.getFullYear()+'-'+pad(d.getMonth()+1,2)+'-'+pad(d.getDate(),2)}
function todayISO(){return isoOf(new Date())}
function dt(iso){var p=String(iso).split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function fmtDate(iso){if(!iso)return '-';return dt(iso).toLocaleDateString('th-TH-u-ca-gregory',{day:'numeric',month:'short',year:'numeric'})}
function fmtShort(iso){return dt(iso).toLocaleDateString('th-TH-u-ca-gregory',{day:'numeric',month:'short'})}
function dayDiff(iso){return Math.round((dt(iso)-dt(todayISO()))/864e5)}
function byDate(a,b){return a.date<b.date?-1:a.date>b.date?1:a.eventId<b.eventId?-1:1}

/* ---------- data ---------- */
/* ข้อมูลกิจกรรม/สมาชิก/งบ/การเข้าร่วม อ่านอย่างเดียวจาก Google Sheets
   บัญชีผู้ใช้อยู่ในชีตบัญชีแยกต่างหาก ตรวจรหัสผ่านผ่าน Apps Script (ACCOUNTS_API) ไม่เก็บบัญชีในเบราว์เซอร์ */
var db={members:[],events:[],attendance:[],budget:[]};
var loaded=false;
/* ล้างบัญชีแบบเก่าที่เคยเก็บใน localStorage */
try{localStorage.removeItem('lumina.accounts.v1')}catch(e){}
function memberById(id){return db.members.find(function(m){return m.memberId===id})}
function findMemberCI(id){id=id.trim().toLowerCase();return db.members.find(function(m){return m.memberId.toLowerCase()===id})}
function eventById(id){return db.events.find(function(e){return e.eventId===id})}
function used(id){return db.budget.filter(function(t){return t.eventId===id}).reduce(function(s,t){return s+(+t.amount||0)},0)}
function present(id){return db.attendance.filter(function(a){return a.eventId===id&&a.status==='Present'}).length}
function totals(){var all=db.events.reduce(function(s,e){return s+(+e.budget||0)},0);var u=db.events.reduce(function(s,e){return s+used(e.eventId)},0);return {all:all,used:u,rem:all-u,pct:all?u/all*100:0}}
function session(){try{var o=JSON.parse(lsGet(SESS)||'null');return o&&o.memberId?o:null}catch(e){return null}}
function currentUser(){var o=session();if(!o)return null;var m=memberById(o.memberId);return m||{memberId:o.memberId,firstName:o.firstName||o.memberId,lastName:o.lastName||'',position:o.position||'Member',email:o.email||''}}
function fullName(m){return m.firstName+' '+m.lastName}

/* ---------- icons ---------- */
var I={
  sun:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg class="ic" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
  bell:'<svg class="ic" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg>',
  chev:'<svg class="ic" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  plus:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>',
  trash:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  menu:'<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  logo:'<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>'
};

/* ---------- ui helpers ---------- */
function toast(msg,kind){var t=document.createElement('div');t.className='toast'+(kind?' '+kind:'');t.textContent=msg;$('#toasts').appendChild(t);setTimeout(function(){t.remove()},3200)}
function effTheme(){var t=document.documentElement.dataset.theme;if(t)return t;return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function setTheme(t){document.documentElement.dataset.theme=t;lsSet(THEME,t);render(true)}
(function(){var t=lsGet(THEME);if(t==='light'||t==='dark')document.documentElement.dataset.theme=t})();

function notifications(){
  var out=[];
  /* แจ้งเตือนทุกกิจกรรมให้สมาชิกทุกคนในชมรม */
  db.events.slice().sort(byDate).forEach(function(e){
    var d=dayDiff(e.date),u=used(e.eventId),b=+e.budget||0;
    if(d===0)out.push({k:'warn',t:'วันนี้มีกิจกรรม '+e.name+' ที่ '+e.location});
    else if(d>0&&d<=3)out.push({k:'info',t:e.name+' อีก '+d+' วัน ('+fmtShort(e.date)+')'});
    if(u>b)out.push({k:'bad',t:e.name+' ใช้งบเกิน '+baht(u-b)});
    else if(b>0&&u/b>=.8)out.push({k:'warn',t:e.name+' ใช้งบไปแล้ว '+(u/b*100).toFixed(0)+'%'});
  });
  return out;
}
/* เก็บรายการแจ้งเตือนที่ผู้ใช้แต่ละคนเปิดอ่านแล้ว (ใช้ข้อความแจ้งเตือนเป็นตัวระบุ)
   ถ้าข้อความเปลี่ยน เช่น จำนวนวันหรือ % งบเปลี่ยน จะนับเป็นการแจ้งเตือนใหม่ */
function seenKey(){var o=session();return 'lumina.seen.'+(o?o.memberId:'guest')}
function seenList(){try{var a=JSON.parse(lsGet(seenKey())||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function unseenCount(n){var s=seenList();return n.filter(function(x){return s.indexOf(x.t)<0}).length}
function markSeen(){lsSet(seenKey(),JSON.stringify(notifications().map(function(x){return x.t})))}
function topbar(title,back,side){
  var n=notifications(),un=unseenCount(n),th=effTheme();
  return '<header class="top"><div class="top-l">'+
    (side?'<button class="btn icon menu-btn" data-act="menu" aria-label="เมนู" type="button">'+I.menu+'</button>':'')+
    (back?'<a class="btn soft" href="'+back.href+'">‹ '+esc(back.label)+'</a>':'')+'</div>'+
    '<h1 class="ttl">'+esc(title)+'</h1><div class="top-r">'+
    '<div class="seg" role="group" aria-label="ธีม"><button data-act="theme" data-v="light" aria-pressed="'+(th==='light')+'" aria-label="โหมดสว่าง" type="button">'+I.sun+'</button><button data-act="theme" data-v="dark" aria-pressed="'+(th==='dark')+'" aria-label="โหมดมืด" type="button">'+I.moon+'</button></div>'+
    '<div class="bellwrap"><button class="btn icon bellbtn" data-act="bell" aria-label="การแจ้งเตือน" aria-expanded="false" type="button">'+I.bell+(un?'<span class="badge">'+un+'</span>':'')+'</button>'+
    '<div class="bellpanel" hidden><h3>การแจ้งเตือน</h3>'+(n.length?n.map(function(x){return '<div class="note '+x.k+'"><i></i><span>'+esc(x.t)+'</span></div>'}).join(''):'<div class="note"><i></i><span>ยังไม่มีการแจ้งเตือน</span></div>')+'</div></div>'+
    '</div></header>';
}

/* ---------- charts ---------- */
function donut(pct){
  var r=52,c=2*Math.PI*r,p=Math.max(0,Math.min(pct,100)),cls=pct>100?'bad':pct>=90?'warn':'';
  return '<div class="donut '+cls+'" role="img" aria-label="ใช้งบไปแล้ว '+pct.toFixed(1)+' เปอร์เซ็นต์"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="trk" cx="70" cy="70" r="'+r+'"/><circle class="val" cx="70" cy="70" r="'+r+'" stroke-dasharray="'+(p/100*c).toFixed(2)+' '+c.toFixed(2)+'" transform="rotate(-90 70 70)"/></svg><div class="dn"><b class="num">'+pct.toFixed(1)+'%</b><span>ใช้ไปแล้ว</span></div></div>';
}
function budgetCard(u,all,title){
  var rem=all-u,pct=all?u/all*100:0;
  return '<section class="card"><h2>'+(title||'Budget')+'</h2><div class="budget-body"><dl class="bl">'+
    '<div><dt>All budgets<span>งบประมาณทั้งหมด</span></dt><dd class="num">'+baht(all)+'</dd></div>'+
    '<div><dt>Used budgets<span>งบที่ใช้ไป</span></dt><dd class="num">'+baht(u)+'</dd></div>'+
    '<div><dt>Remained budgets<span>งบคงเหลือ</span></dt><dd class="num'+(rem<0?' neg':'')+'">'+baht(rem)+'</dd></div></dl>'+donut(pct)+'</div></section>';
}
function wrapLabel(s){
  var words=String(s).split(/\s+/),lines=[''],i;
  for(i=0;i<words.length;i++){var cur=lines[lines.length-1];if((cur+' '+words[i]).trim().length<=13)lines[lines.length-1]=(cur+' '+words[i]).trim();else lines.push(words[i])}
  if(lines.length>2){lines=lines.slice(0,2);lines[1]=lines[1].slice(0,12)+'…'}
  return lines.map(function(l){return l.length>13?l.slice(0,12)+'…':l});
}
function attChart(){
  var evs=db.events.slice().sort(byDate);
  if(!evs.length)return '<div class="empty">ยังไม่มีกิจกรรม</div>';
  var vals=evs.map(function(e){return {e:e,n:present(e.eventId),has:db.attendance.some(function(a){return a.eventId===e.eventId})}});
  var max=Math.max.apply(null,vals.map(function(v){return v.n}));
  var step=max>30?10:5,yMax=Math.max(5,Math.ceil(max/step)*step);
  var slot=84,L=44,T=26,B=64,plotH=170,W=L+evs.length*slot+8,H=T+plotH+B;
  var y=function(v){return T+plotH-v/yMax*plotH};
  var s='<svg viewBox="0 0 '+W+' '+H+'" style="min-width:'+Math.min(W,560)+'px;width:100%;height:auto" role="img" aria-label="จำนวนผู้เข้าร่วมแต่ละกิจกรรม">';
  s+='<text class="ax" x="'+(L-34)+'" y="14">คน</text>';
  for(var v=0;v<=yMax;v+=step){s+='<line class="gl" x1="'+L+'" x2="'+(W-4)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="ax" x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v+'</text>'}
  vals.forEach(function(o,i){
    var cx=L+i*slot+slot/2,h=o.n/yMax*plotH,lines=wrapLabel(o.e.name);
    s+='<a href="#event-'+esc(o.e.eventId)+'" class="bar-hit"><title>'+esc(o.e.name)+': '+(o.has?o.n+' คน':'ยังไม่มีข้อมูลการเข้าร่วม')+'</title>';
    if(o.has&&o.n>0)s+='<rect class="bar" x="'+(cx-20)+'" y="'+y(o.n)+'" width="40" height="'+h+'" rx="3"/><text class="axv" x="'+cx+'" y="'+(y(o.n)-6)+'" text-anchor="middle">'+o.n+'</text>';
    else s+='<rect class="bar zero" x="'+(cx-20)+'" y="'+(T+plotH-14)+'" width="40" height="14" rx="3"/><text class="ax" x="'+cx+'" y="'+(T+plotH-20)+'" text-anchor="middle">'+(o.has?'0':'ยังไม่มีข้อมูล')+'</text>';
    lines.forEach(function(l,k){s+='<text class="ax" x="'+cx+'" y="'+(T+plotH+18+k*13)+'" text-anchor="middle">'+esc(l)+'</text>'});
    s+='<text class="ax" x="'+cx+'" y="'+(T+plotH+18+2*13+4)+'" text-anchor="middle" style="opacity:.75">'+fmtShort(o.e.date)+'</text></a>';
  });
  return s+'</svg>';
}

/* ---------- views ---------- */
var prefillId='';
function loginView(){
  return '<div class="wrap"><div class="auth"><section class="authcard"><div style="display:grid;gap:16px">'+
    '<div class="apphead"><div class="logo">'+I.logo+'</div><h1>Club Tracker</h1><p>ติดตามงบประมาณ การเข้าร่วมกิจกรรม และรายชื่อสมาชิกของชมรมในที่เดียว</p></div>'+
    '<div id="gbtn" style="display:flex;justify-content:center;min-height:44px"></div>'+
    '<p class="err" id="li-err" role="alert" style="text-align:center"></p>'+
    '<p class="hint" id="li-hint" style="text-align:center">'+HINT.login+'</p>'+
    '<a class="btn block" href="#register">ยังไม่มีบัญชี? สร้างบัญชีใหม่</a></div></section></div></div>';
}
var HINT={login:'เข้าสู่ระบบด้วยบัญชี Google ที่ลงทะเบียนไว้'};
var POSITIONS=['Member','President','Vice President','Secretary','Treasurer','Operations Head'];
function registerView(){
  return '<div class="wrap"><div class="auth"><section class="authcard"><form data-form="register" novalidate>'+
    '<div class="apphead"><div class="logo">'+I.logo+'</div><h1>สร้างบัญชีใหม่</h1><p>ระบบจะออกรหัสสมาชิกให้อัตโนมัติ แล้วใช้อีเมลนี้เข้าสู่ระบบด้วย Google</p></div>'+
    '<label class="f" for="rg-fn">ชื่อ<input class="in" id="rg-fn" autocomplete="given-name"></label>'+
    '<label class="f" for="rg-ln">นามสกุล<input class="in" id="rg-ln" autocomplete="family-name"></label>'+
    '<label class="f" for="rg-pos">ตำแหน่ง<select class="in" id="rg-pos">'+POSITIONS.map(function(p){return '<option>'+esc(p)+'</option>'}).join('')+'</select></label>'+
    '<label class="f" for="rg-email">อีเมล (บัญชี Google ที่จะใช้ล็อกอิน)<input class="in" id="rg-email" type="email" autocomplete="email" placeholder="name@gmail.com"></label>'+
    '<p class="err" id="rg-err" role="alert"></p>'+
    '<div class="actions"><button class="btn primary block" type="submit">สร้างบัญชี</button><a class="btn block" href="#login">มีบัญชีแล้ว? เข้าสู่ระบบ</a></div></form></section></div></div>';
}
function dashView(u){
  var t=totals();
  var side='<aside class="side" id="side"><div class="brand"><span class="logo"><svg viewBox="0 0 24 24">'+I.logo.replace(/^<svg[^>]*>|<\/svg>$/g,'')+'</svg></span>Club Tracker</div>'+
    '<div class="me"><div class="id"><span class="avatar">'+esc(u.firstName.charAt(0))+'</span><span>'+esc(u.memberId)+'</span></div><dl>'+
    '<div><dt>ชื่อจริง</dt><dd>'+esc(u.firstName)+'</dd></div><div><dt>นามสกุล</dt><dd>'+esc(u.lastName)+'</dd></div><div><dt>role</dt><dd>'+esc(u.position)+'</dd></div><div><dt>email</dt><dd>'+esc(u.email)+'</dd></div></dl></div>'+
    '<nav class="nav" aria-label="เมนูหลัก"><a href="#events">กิจกรรมทั้งหมด'+I.chev+'</a><a href="#members">สมาชิกทั้งหมด'+I.chev+'</a></nav>'+
    '<div class="sidefoot"><button class="btn" data-act="logout" type="button" style="background:var(--bad-soft);color:var(--bad);border-color:transparent">Log out</button></div></aside>';
  var main='<main style="min-width:0">'+topbar('Dashboard',null,true)+
    '<div class="grid-dash"><div class="stack">'+
    '<a class="card tile" href="#members"><span class="k">Members</span><span class="v num">'+db.members.length+'</span><span class="s">จำนวนสมาชิก</span></a>'+
    '<a class="card tile" href="#events"><span class="k">Events</span><span class="v num">'+db.events.length+'</span><span class="s">จำนวนกิจกรรมที่มีอยู่ใน database</span></a></div>'+
    budgetCard(t.used,t.all,'Budget')+'</div>'+
    '<section class="card"><h2>Attendance<span>จำนวนผู้เข้าร่วมแต่ละกิจกรรม</span></h2><div class="chartwrap">'+attChart()+'</div></section></main>';
  return '<div class="wrap"><div class="shell">'+side+main+'</div></div>';
}
function statusPill(e){var d=dayDiff(e.date);return d<0?'<span class="pill done">จบแล้ว</span>':d===0?'<span class="pill">วันนี้</span>':'<span class="pill">อีก '+d+' วัน</span>'}
function eventsView(){
  var evs=db.events.slice().sort(byDate);
  var rows=evs.map(function(e){
    var u=used(e.eventId),b=+e.budget||0,p=b?u/b*100:0,cls=p>100?'bad':p>=90?'warn':'';
    return '<a class="erow" href="#event-'+esc(e.eventId)+'"><div><div class="t">'+esc(e.name)+statusPill(e)+(p>100?'<span class="pill bad">เกินงบ</span>':'')+'</div><div class="m">'+fmtDate(e.date)+' · '+esc(e.location)+'</div></div>'+
      '<div class="mini '+cls+'"><div class="num">'+baht(u)+' / '+baht(b)+'</div><div class="track"><div class="fill" style="width:'+Math.min(p,100)+'%"></div></div></div>'+
      '<div class="att"><b class="num">'+present(e.eventId)+'</b>คนเข้าร่วม</div></a>';
  }).join('');
  return '<div class="wrap">'+topbar('Event',{href:'#dashboard',label:'dashboard'})+
    '<div class="list">'+(rows||'<div class="card empty">ยังไม่มีกิจกรรม</div>')+'</div></div>';
}
function eventView(e){
  var u=used(e.eventId);
  var tx=db.budget.filter(function(t){return t.eventId===e.eventId}).sort(function(a,b){return a.date<b.date?-1:1});
  var has=db.attendance.some(function(a){return a.eventId===e.eventId});
  var people=db.attendance.filter(function(a){return a.eventId===e.eventId&&a.status==='Present'})
    .map(function(a){return memberById(a.memberId)}).filter(Boolean)
    .sort(function(a,b){return a.memberId<b.memberId?-1:1});
  var txRows=tx.map(function(t){return '<tr><td>'+esc(t.item)+'</td><td>'+fmtDate(t.date)+'</td><td class="r num">'+baht(t.amount)+'</td></tr>'}).join('');
  var rows=people.map(function(m){return '<div class="arow"><div class="n">'+esc(fullName(m))+'<small>'+esc(m.memberId)+' · '+esc(m.position)+'</small></div></div>'}).join('');
  return '<div class="wrap">'+topbar(e.name+' ('+e.eventId+')',{href:'#events',label:'back'})+
    '<div class="detail"><div class="info"><div class="box"><span>date</span><b class="num">'+fmtDate(e.date)+'</b></div><div class="box"><span>location</span><b>'+esc(e.location)+'</b></div><div class="box"><span>Member</span><b class="num">'+(has?people.length+' คน':'ยังไม่มีข้อมูล')+'</b></div></div>'+
    budgetCard(u,+e.budget||0,'Budget')+'</div>'+
    '<section class="card sec"><div class="sec-h"><h2>สมาชิกที่เข้าร่วม<span>'+(has?people.length+' คน':'')+'</span></h2></div>'+
    (rows?'<div class="attgrid">'+rows+'</div>':'<div class="empty">ยังไม่มีข้อมูลการเข้าร่วมของกิจกรรมนี้</div>')+'</section>'+
    '<section class="card sec"><div class="sec-h"><h2>รายการค่าใช้จ่าย<span>'+tx.length+' รายการ</span></h2></div>'+
    '<div class="tablewrap"><table><thead><tr><th>รายการ</th><th>วันที่</th><th class="r">จำนวนเงิน</th></tr></thead><tbody>'+(txRows||'<tr><td colspan="3" class="empty">ยังไม่มีรายการค่าใช้จ่าย</td></tr>')+'</tbody></table></div></section></div>';
}
function membersView(q){
  q=(q||'').toLowerCase();
  var list=db.members.slice().sort(function(a,b){return a.memberId<b.memberId?-1:1}).filter(function(m){return !q||(m.memberId+' '+fullName(m)+' '+m.position+' '+m.email).toLowerCase().indexOf(q)>-1});
  var recorded=db.events.filter(function(e){return db.attendance.some(function(a){return a.eventId===e.eventId})}).length;
  var rows=list.map(function(m){
    var p=db.attendance.filter(function(a){return a.memberId===m.memberId&&a.status==='Present'}).length;
    return '<tr><td class="num">'+esc(m.memberId)+'</td><td>'+esc(fullName(m))+'</td><td>'+esc(m.position)+'</td><td>'+esc(m.email)+'</td><td class="r num">'+p+' / '+recorded+'</td></td></tr>';
  }).join('');
  return '<div class="wrap">'+topbar('Members',{href:'#dashboard',label:'dashboard'})+
    '<div class="page-actions" style="justify-content:flex-start"><input class="in search" id="mq" placeholder="ค้นหาชื่อ รหัส หรือตำแหน่ง" value="'+esc(q)+'" aria-label="ค้นหาสมาชิก"></div>'+
    '<section class="card"><div class="tablewrap"><table><thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>Role</th><th>Email</th><th class="r">เข้าร่วม</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5" class="empty">ไม่พบสมาชิก</td></tr>')+'</tbody></table></div></section></div>';
}

/* ---------- Google Sheets (อ่านอย่างเดียว) ----------
   ดึงชีต members / events / attendance / budget จาก Google Sheets ที่แชร์แบบ "ทุกคนที่มีลิงก์ดูได้"
   ทุก REFRESH_MS มิลลิวินาที ถ้าดึงครั้งแรกไม่สำเร็จจะแสดงหน้าแจ้งข้อผิดพลาดพร้อมปุ่มลองใหม่ */
var SHEET_ID='1mxOoO9sLWwy8jxYUjvLtij7aJf27DErH7SQE1CuF5jk';
var REFRESH_MS=60000;
var sync={state:'loading',time:null},lastSig='';
function sheetUrl(n){return 'https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=out:csv&headers=1&sheet='+encodeURIComponent(n)}
function parseCSV(text){
  var rows=[],row=[],cur='',q=false,i,c;
  for(i=0;i<text.length;i++){
    c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;
    else if(c===','){row.push(cur);cur=''}
    else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}
    else if(c!=='\r')cur+=c;
  }
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows;
}
/* ชื่อหัวคอลัมน์ในชีตไม่ต้องตรงตัวพิมพ์เล็ก-ใหญ่ เช่น EventID, event_id, Event Id ใช้ได้หมด */
var HEADERS={memberid:'memberId',firstname:'firstName',lastname:'lastName',position:'position',email:'email',eventid:'eventId',name:'name',date:'date',location:'location',budget:'budget',recordid:'recordId',status:'status',transactionid:'transactionId',item:'item',amount:'amount'};
function uid(v){return String(v||'').trim().toUpperCase()}
/* สถานะที่นับว่า "มาเข้าร่วม" ถ้าไม่มีคอลัมน์ status เลย จะถือว่าทุกแถวคือคนที่มา */
var PRESENT=/^(present|yes|y|true|1|มา|เข้าร่วม|✓|✔)$/i;
function rowsOf(text){
  var r=parseCSV(text);if(!r.length)return [];
  var h=r[0].map(function(x){var k=x.trim(),c=k.toLowerCase().replace(/[\s_\-]/g,'');return HEADERS[c]||k});
  return r.slice(1).filter(function(x){return x.some(function(c){return c.trim()!==''})}).map(function(x){var o={};h.forEach(function(k,i){o[k]=(x[i]||'').trim()});return o});
}
function toNum(v){var n=parseFloat(String(v).replace(/,/g,''));return isNaN(n)?0:n}
function toISO(v){
  var s=String(v||'').trim(),m;
  if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){var a=+m[1],b=+m[2];var d=a>12?a:b,mo=a>12?b:a;return m[3]+'-'+pad(mo,2)+'-'+pad(d,2)}
  return '';
}
function fetchSheet(n){return fetch(sheetUrl(n),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error(n+' '+r.status);return r.text()}).then(function(t){if(/^\s*<(!doctype|html)/i.test(t))throw new Error('not csv');return rowsOf(t)})}
function updateSyncNote(){
  var el=$('#sync');if(!el){el=document.createElement('div');el.id='sync';document.body.appendChild(el)}
  el.className='sync '+sync.state;
  el.textContent=sync.state==='live'?'Google Sheets · อัปเดตล่าสุด '+sync.time.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
    :sync.state==='offline'?'เชื่อม Google Sheets ไม่ได้ แสดงข้อมูลที่โหลดไว้ล่าสุด':sync.state==='error'?'โหลดข้อมูลจาก Google Sheets ไม่สำเร็จ':'กำลังโหลดข้อมูลจาก Google Sheets…';
}
function syncData(){
  return Promise.all(['members','events','attendance','budget'].map(fetchSheet)).then(function(a){
    var members=a[0].filter(function(r){return r.memberId}).map(function(r){return {memberId:uid(r.memberId),firstName:r.firstName,lastName:r.lastName,position:r.position||'Member',email:r.email}});
    var events=a[1].filter(function(r){return r.eventId}).map(function(r){return {eventId:uid(r.eventId),name:r.name,date:toISO(r.date),location:r.location,budget:toNum(r.budget)}});
    var attendance=a[2].filter(function(r){return r.eventId&&r.memberId}).map(function(r){return {recordId:r.recordId,eventId:uid(r.eventId),memberId:uid(r.memberId),status:(r.status===undefined||PRESENT.test(r.status.trim()))?'Present':'Absent'}});
    var budget=a[3].filter(function(r){return r.eventId}).map(function(r){return {transactionId:r.transactionId,eventId:uid(r.eventId),item:r.item,amount:toNum(r.amount),date:toISO(r.date)}});
    var sig=JSON.stringify([members,events,attendance,budget]),changed=sig!==lastSig;lastSig=sig;
    db.members=members;db.events=events;db.attendance=attendance;db.budget=budget;
    loaded=true;sync={state:'live',time:new Date()};updateSyncNote();
    if(changed&&!/^(#(login|register)?)?$/.test(location.hash))render(true);
  }).catch(function(){sync={state:loaded?'offline':'error',time:null};updateSyncNote();if(!loaded)render(true)});
}

/* ---------- router ---------- */
var memberQuery='';
function statusView(){
  if(sync.state==='error')return '<div class="wrap"><div class="auth"><section class="authcard" style="text-align:center;display:grid;gap:14px"><h2>โหลดข้อมูลจาก Google Sheets ไม่สำเร็จ</h2><p class="hint">ตรวจสอบอินเทอร์เน็ต และให้ชีตแชร์แบบ “ทุกคนที่มีลิงก์ดูได้” จากนั้นกดลองใหม่</p><button class="btn primary" data-act="retry" type="button">ลองใหม่</button></section></div></div>';
  return '<div class="wrap"><div class="auth"><p class="hint" role="status">กำลังโหลดข้อมูลจาก Google Sheets…</p></div></div>';
}
function go(h){if(location.hash==='#'+h)render();else location.hash=h}
function render(keep){
  var h=(location.hash||'').slice(1)||'login',parts=h.split(/-(.+)/),name=parts[0],arg=parts[1],u=currentUser(),app=$('#app'),html;
  if(name==='register'&&u){go('dashboard');return}
  if(!loaded&&name!=='login'&&name!=='register'){app.innerHTML=statusView();return}
  if(name!=='login'&&name!=='register'&&!u){if(lsGet(SESS))lsSet(SESS,'');if(h!=='login'){go('login');return}name='login'}
  if((name==='login'||name==='register')&&u&&name==='login'&&!prefillId){/* stay on login if user navigates here */}
  var y=window.scrollY;
  if(name==='login')html=loginView();
  else if(name==='register')html=registerView();
  else if(name==='events')html=eventsView();
  else if(name==='members')html=membersView(memberQuery);
  else if(name==='event'){var e=eventById(arg);if(!e){go('events');return}html=eventView(e)}
  else html=dashView(u);
  app.innerHTML=html;
  if(name==='login')mountGoogle();
  document.title='Club Tracker';
  window.scrollTo(0,keep?y:0);
  if(name==='members'&&memberQuery){var mq=$('#mq');mq.focus();mq.setSelectionRange(mq.value.length,mq.value.length)}
}
window.addEventListener('hashchange',function(){if(location.hash!=='#members')memberQuery='';render()});

/* ---------- form: ล็อกอิน ---------- */
function val(id){return ($('#'+id).value||'').trim()}
function setErr(id,msg){$('#'+id).textContent=msg}

/* ---------- Log in with Google ---------- */
var gisReady=null,gisInit=false;
function loadGIS(){
  if(gisReady)return gisReady;
  gisReady=new Promise(function(ok,fail){
    var sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;
    sc.onload=ok;sc.onerror=function(){gisReady=null;fail(new Error('โหลด Google Sign-In ไม่ได้'))};
    document.head.appendChild(sc);
  });
  return gisReady;
}
function mountGoogle(){
  if(!GOOGLE_CLIENT_ID||!ACCOUNTS_API){setErr('li-err','ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID หรือ ACCOUNTS_API ใน app.js');return}
  loadGIS().then(function(){
    var el=$('#gbtn');if(!el)return;
    if(!gisInit){google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:onGoogle,auto_select:false,cancel_on_tap_outside:true});gisInit=true}
    google.accounts.id.renderButton(el,{theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'th',width:Math.min(320,el.clientWidth||320)});
  }).catch(function(e){console.error(e);setErr('li-err','โหลดปุ่ม Google ไม่ได้ ตรวจอินเทอร์เน็ตหรือปิดตัวบล็อกโฆษณาแล้วรีเฟรช')});
}
function onGoogle(resp){
  var hint=$('#li-hint');setErr('li-err','');if(hint)hint.textContent='กำลังตรวจสอบบัญชี…';
  fetch(ACCOUNTS_API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'google',credential:resp.credential})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(res){
      if(res&&res.ok&&res.user){lsSet(SESS,JSON.stringify(res.user));go('dashboard');return}
      var e=res&&res.error,msg=
        e==='not_registered'?'บัญชี '+(res.email||'Google นี้')+' ยังไม่ได้ลงทะเบียน กด "สร้างบัญชีใหม่" ด้านล่าง':
        e==='inactive'?'บัญชีนี้ถูกระงับการใช้งาน ติดต่อผู้ดูแลชมรม':
        e==='no_sheet'||e==='bad_headers'||e==='no_client_id'?'ระบบบัญชีตั้งค่าไม่ถูกต้อง แจ้งผู้ดูแลชมรม':
        'ยืนยันตัวตนกับ Google ไม่สำเร็จ ลองใหม่อีกครั้ง';
      setErr('li-err',msg);
    })
    .catch(function(e){console.error('ล็อกอินไม่สำเร็จ:',e);setErr('li-err','เชื่อมต่อระบบบัญชีไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่')})
    .then(function(){var h=$('#li-hint');if(h)h.textContent=HINT.login});
}
var EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function onSubmit(form){
  if(form.dataset.form!=='register')return;
  var fn=$('#rg-fn').value.trim(),ln=$('#rg-ln').value.trim(),pos=$('#rg-pos').value,email=$('#rg-email').value.trim().toLowerCase(),btn=form.querySelector('button[type=submit]');
  if(!fn||!ln||!email){setErr('rg-err','กรอกชื่อ นามสกุล และอีเมลให้ครบ');return}
  if(!EMAIL.test(email)){setErr('rg-err','รูปแบบอีเมลไม่ถูกต้อง');return}
  if(!ACCOUNTS_API){setErr('rg-err','ยังไม่ได้ตั้งค่า ACCOUNTS_API ใน app.js');return}
  setErr('rg-err','');btn.disabled=true;btn.textContent='กำลังสร้างบัญชี…';
  fetch(ACCOUNTS_API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'register',firstName:fn,lastName:ln,position:pos,email:email})})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(function(res){
      if(res&&res.ok){toast('สร้างบัญชีสำเร็จ รหัสสมาชิกของคุณคือ '+res.memberId+' เข้าสู่ระบบด้วย Google ได้เลย');syncData();go('login');return}
      var e=res&&res.error;
      setErr('rg-err',
        e==='email_exists'?'อีเมลนี้มีบัญชีอยู่แล้ว เข้าสู่ระบบได้เลย':
        e==='invalid'?'กรอกข้อมูลให้ครบและถูกต้อง':
        e==='busy'?'ระบบกำลังทำงานอยู่ ลองใหม่อีกครั้ง':
        'ระบบบัญชีตั้งค่าไม่ถูกต้อง แจ้งผู้ดูแลชมรม');
    })
    .catch(function(e){console.error('สร้างบัญชีไม่สำเร็จ:',e);setErr('rg-err','เชื่อมต่อระบบบัญชีไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่')})
    .then(function(){if(document.body.contains(btn)){btn.disabled=false;btn.textContent='สร้างบัญชี'}});
}
document.addEventListener('submit',function(e){var f=e.target.closest('form[data-form]');if(f){e.preventDefault();onSubmit(f)}});

/* ---------- actions ---------- */
document.addEventListener('click',function(e){
  if(!e.target.closest('.bellwrap')){var bp=$('.bellpanel');if(bp&&!bp.hidden){bp.hidden=true;var bb=$('.bellbtn');if(bb)bb.setAttribute('aria-expanded','false')}}
  var t=e.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act;
  if(a==='theme')setTheme(t.dataset.v);
  else if(a==='bell'){var p=$('.bellpanel');p.hidden=!p.hidden;t.setAttribute('aria-expanded',String(!p.hidden));if(!p.hidden){markSeen();var bg=t.querySelector('.badge');if(bg)bg.remove()}}
  else if(a==='retry'){sync={state:'loading',time:null};updateSyncNote();render(true);syncData()}
  else if(a==='menu')$('#side').classList.toggle('open');
  else if(a==='logout'){lsSet(SESS,'');try{google.accounts.id.disableAutoSelect()}catch(err){}go('login')}
});
document.addEventListener('input',function(e){if(e.target.id==='mq'){memberQuery=e.target.value;render(true)}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var bp=$('.bellpanel');if(bp)bp.hidden=true}});

render();
updateSyncNote();
syncData();
setInterval(syncData,REFRESH_MS);
})();
