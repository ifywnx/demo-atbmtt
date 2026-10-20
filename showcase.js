/*
 * MEDSEAL — Presentation dashboard powered by actual Web Crypto results.
 * Read-only observer of app.js: no fabricated hashes, signatures or verification.
 */
'use strict';

const $ui = id => document.getElementById(id);
const form = $ui('recordForm');
const fields = ['recordId','visitDate','patient','doctor','diagnosis','medicine','dosage'];
const state = {
  original:null, pending:null, signedHash:null,
  cleanVerified:false, attacked:false, detected:false,
  signatureAltered:false, verdictSeen:'idle', raf:0, noticeTimer:null
};
const missionNodes = new Map([...document.querySelectorAll('[data-mission]')].map(node=>[node.dataset.mission,node]));

function snapshot(){return Object.fromEntries(fields.map(id=>[id,$ui(id).value.normalize('NFC').trim()]));}
function equalRecord(a,b){return a && fields.every(key=>a[key]===b[key]);}
function setContent(id,value){
  const el=$ui(id);if(el && el.textContent!==String(value))el.textContent=String(value);
}
function shaHash(value){return /^[0-9a-f]{64}$/.test((value||'').trim());}
function abbreviate(value){
  value=(value||'').trim();
  return shaHash(value)?value.slice(0,17)+'…'+value.slice(-15):'Chưa tạo';
}
function setModeClass(el,prefix,suffix){
  const next=prefix+(suffix?' '+suffix:'');
  if(el.className!==next)el.className=next;
}
function story(name,mode){
  const node=missionNodes.get(name);
  if(!node)return;
  for(const cls of ['is-active','is-complete','is-error'])node.classList.remove(cls);
  if(mode!=='idle')node.classList.add('is-'+mode);
  node.setAttribute('aria-label',node.querySelector('strong').textContent+' - '+({
    active:'Đang thực hiện',complete:'Đã hoàn thành',error:'Phát hiện lỗi',idle:'Chưa thực hiện'
  }[mode]));
}
function revealNotice(ok,title,desc){
  const note=$ui('showcaseNotice');
  setContent('showcaseNoticeTitle',title);
  setContent('showcaseNoticeDesc',desc);
  note.className='showcase-notice is-visible '+(ok?'is-good':'is-bad');
  note.querySelector('#showcaseNoticeIcon use').setAttribute('href',ok?'#i-check':'#i-alert');
  clearTimeout(state.noticeTimer);
  state.noticeTimer=setTimeout(()=>note.classList.remove('is-visible'),4200);
}
function sync(){
  const record=snapshot();
  const saved=$ui('savedHash').textContent.trim();
  const current=$ui('currentHash').textContent.trim();
  const signed=shaHash(saved);
  const keyReady=$ui('publicKeyResult').textContent.includes('SẴN SÀNG');
  if(signed && saved!==state.signedHash){
    state.signedHash=saved;
    state.original=state.pending||{...record};
    state.pending=null;
    state.cleanVerified=false;
    state.attacked=false;
    state.detected=false;
    state.signatureAltered=false;
  }
  if(!signed){state.signedHash=null;state.original=null;state.pending=null;}
  const v=$ui('verdict');
  const valid=v.classList.contains('good');
  const invalid=v.classList.contains('bad');
  const modified=Boolean(signed && state.original && !equalRecord(state.original,record));
  const tampered=Boolean(signed && (modified||state.signatureAltered));
  const matching=Boolean(signed && shaHash(current) && saved===current);
  if(valid)state.cleanVerified=true;
  if(invalid && signed)state.detected=true;
  if(tampered)state.attacked=true;

  $ui('quickSignBtn').disabled=!keyReady||$ui('signBtn').disabled;
  $ui('quickVerifyBtn').disabled=$ui('verifyBtn').disabled;
  $ui('quickAttackBtn').disabled=$ui('doseAttackBtn').disabled;
  $ui('compareVerifyBtn').disabled=$ui('verifyBtn').disabled;
  story('sign',signed?'complete':'active');
  story('verify',state.cleanVerified?'complete':signed?'active':'idle');
  story('tamper',state.attacked?'complete':state.cleanVerified?'active':'idle');
  story('detect',state.detected?'complete':state.attacked?'active':'idle');

  const message=invalid?'Đã phát hiện can thiệp'
    :valid?'Toàn vẹn · Chữ ký hợp lệ'
    :tampered?'Phát hiện khác biệt · Chờ xác minh'
    :signed?'Đã ký · Chờ kiểm tra'
    :keyReady?'Sẵn sàng bắt đầu':'Đang khởi tạo khóa RSA…';
  setContent('missionStatusText',message);
  const tone=invalid||tampered?'warn':valid?'good':null;
  if(tone)$ui('missionState').setAttribute('data-tone',tone);
  else $ui('missionState').removeAttribute('data-tone');
  const hero=document.querySelector('.hero-showcase');
  hero.classList.toggle('demo-safe',valid);
  hero.classList.toggle('demo-alert',invalid);
  $ui('metricStatus').setAttribute('data-tone',invalid?'bad':valid?'good':'neutral');

  const original=state.original;
  setContent('originalPatient',original?original.patient:'Chưa có dữ liệu ký');
  setContent('originalId',original?original.recordId:'—');
  setContent('originalMedicine',original?original.medicine:'—');
  setContent('originalDose',original?original.dosage:'—');
  setContent('originalMiniHash',abbreviate(saved));
  setContent('currentPatientView',record.patient);
  setContent('currentIdView',record.recordId);
  setContent('currentMedicineView',record.medicine);
  setContent('currentDoseView',record.dosage);
  setContent('currentMiniHash',abbreviate(current));
  $ui('currentMedicineView').classList.toggle('is-changed',!!original&&record.medicine!==original.medicine);
  $ui('currentDoseView').classList.toggle('is-changed',!!original&&record.dosage!==original.dosage);

  setModeClass($ui('so-sanh'),'compare-stage',invalid?'is-alert':valid?'is-safe':'');
  $ui('compareBadge').className='compare-badge '+(
    invalid?'is-alert':valid?'is-safe':tampered?'is-alert':signed?'is-check':'is-idle'
  );
  setContent('compareBadge',
    invalid?'CẢNH BÁO CAN THIỆP':valid?'ĐÃ XÁC MINH':tampered?'THAY ĐỔI CHƯA XÁC MINH':signed?'ĐÃ KÝ SỐ':'CHƯA CÓ BẰNG CHỨNG'
  );
  setModeClass($ui('compareVerdict'),'compare-verdict',invalid?'is-alert':valid?'is-safe':'');
  let title,desc,icon='#i-info';
  if(invalid){
    title='PHÁT HIỆN CAN THIỆP BỆNH ÁN';
    desc=matching?'Hash khớp nhưng chữ ký RSA-PSS đã bị can thiệp.':'SHA-256 không khớp bản đã ký; chữ ký RSA-PSS không hợp lệ.';
    icon='#i-alert';
  }else if(valid){
    title='XÁC MINH THÀNH CÔNG · HỒ SƠ TOÀN VẸN';
    desc='Nội dung hiện tại khớp với phiên bản đã ký và RSA-PSS xác minh thành công.';
    icon='#i-check';
  }else if(tampered){
    title='ĐÃ PHÁT HIỆN DẤU HIỆU KHÁC BIỆT';
    desc=state.signatureAltered?'Chữ ký đã thay đổi; cần xác minh bằng khóa công khai.':'Dữ liệu khác bản đã ký; nhấn xác minh để đưa ra kết luận mật mã.';
    icon='#i-alert';
  }else if(signed){
    title='BỆNH ÁN ĐÃ KÝ · CHỜ XÁC MINH';
    desc='Nhấn “Xác minh ngay” để kiểm tra cả SHA-256 lẫn RSA-PSS.';
  }else{
    title='Đang chờ chữ ký đầu tiên';
    desc='Ký bệnh án trước, sau đó thử thay đổi liều thuốc để xem sự khác biệt.';
  }
  setContent('compareVerdictTitle',title);
  setContent('compareVerdictDesc',desc);
  $ui('compareVerdict').querySelector(':scope > svg use').setAttribute('href',icon);

  const kind=valid?'good':invalid?'bad':'idle';
  if(kind!==state.verdictSeen){
    state.verdictSeen=kind;
    if(kind==='good'||kind==='bad'){
      revealNotice(kind==='good',kind==='good'?'INTEGRITY VERIFIED':'TAMPERING DETECTED',
        kind==='good'?'SHA-256 khớp · RSA-PSS hợp lệ':matching?'Chữ ký RSA-PSS không hợp lệ':'Hash thay đổi · Chữ ký bị vô hiệu');
      v.classList.remove('moment-pop','moment-bad');
      void v.offsetWidth;
      v.classList.add(kind==='good'?'moment-pop':'moment-bad');
    }
  }
}
function queueSync(){
  if(state.raf)return;
  state.raf=requestAnimationFrame(()=>{state.raf=0;sync();});
}
function scrollTo(id){
  $ui(id).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
// Keep the original form as the single authoritative signing workflow.
form.addEventListener('submit',()=>{
  if(form.checkValidity())state.pending=snapshot();
},true);
form.addEventListener('input',queueSync);
form.addEventListener('change',queueSync);
$ui('quickSignBtn').addEventListener('click',()=>{
  if($ui('quickSignBtn').disabled)return;
  form.requestSubmit();scrollTo('ho-so');
});
$ui('quickVerifyBtn').addEventListener('click',()=>{
  if($ui('quickVerifyBtn').disabled)return;
  $ui('verifyBtn').click();scrollTo('ho-so');
});
$ui('compareVerifyBtn').addEventListener('click',()=>{
  if(!$ui('compareVerifyBtn').disabled)$ui('verifyBtn').click();
});
$ui('quickAttackBtn').addEventListener('click',()=>{
  if($ui('quickAttackBtn').disabled)return;
  $ui('doseAttackBtn').click();state.attacked=true;scrollTo('so-sanh');queueSync();
});
for(const id of ['doseAttackBtn','medicineAttackBtn']){
  $ui(id).addEventListener('click',()=>{state.attacked=true;queueSync();});
}
$ui('signatureAttackBtn').addEventListener('click',()=>{
  state.signatureAltered=true;state.attacked=true;queueSync();
});
$ui('restoreBtn').addEventListener('click',()=>{
  state.signatureAltered=false;queueSync();
});
$ui('showcaseNoticeClose').addEventListener('click',()=>{
  clearTimeout(state.noticeTimer);
  $ui('showcaseNotice').classList.remove('is-visible');
});
$ui('presentBtn').addEventListener('click',async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    else document.body.classList.toggle('presentation-mode');
  }catch(_){
    document.body.classList.toggle('presentation-mode');
  }
  setContent('presentLabel',document.body.classList.contains('presentation-mode')?'Thoát trình chiếu':'Trình chiếu');
});
document.addEventListener('fullscreenchange',()=>{
  const active=!!document.fullscreenElement;
  document.body.classList.toggle('presentation-mode',active);
  setContent('presentLabel',active?'Thoát trình chiếu':'Trình chiếu');
  $ui('presentBtn').setAttribute('aria-pressed',String(active));
});
const observer=new MutationObserver(queueSync);
for(const [node,settings] of [
  [$ui('savedHash'),{childList:true,subtree:true,characterData:true}],
  [$ui('currentHash'),{childList:true,subtree:true,characterData:true}],
  [$ui('publicKeyResult'),{childList:true,subtree:true,characterData:true}],
  [$ui('verdict'),{attributes:true,attributeFilter:['class']}],
  [$ui('signBtn'),{attributes:true,attributeFilter:['disabled']}],
  [$ui('verifyBtn'),{attributes:true,attributeFilter:['disabled']}]
])observer.observe(node,settings);

if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const targets=document.querySelectorAll('.hero-showcase,.mission-board,.section-heading,.workspace,.attack-grid,.compare-stage,.lower-grid');
  const revealObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){
      entry.target.classList.add('motion-visible');
      revealObserver.unobserve(entry.target);
    }
  },{threshold:.08});
  targets.forEach(node=>{node.classList.add('motion-reveal');revealObserver.observe(node);});
  requestAnimationFrame(()=>document.body.classList.add('motion-ready'));
}
sync();
