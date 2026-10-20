/* MEDSEAL advanced classroom mode: independent WebCrypto checks, playback, revision log */
'use strict';
const el = id => document.getElementById(id);
const api = window.MedSealDemo;
const utf8 = new TextEncoder();
const fields = ['recordId','visitDate','patient','doctor','diagnosis','medicine','dosage','signedAt'];
const maxBytes = 128 * 1024;
let portable = null;
let activeRun = 0, running = false, paused = false;
function label(id,value) { el(id).textContent=String(value); }
function toHex(bytes) { return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function canonical(record){
  if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Bệnh án phải là một đối tượng JSON.');
  const keys=Object.keys(record);
  if(keys.length!==fields.length||fields.some(k=>!keys.includes(k)))throw Error('Bệnh án phải có đúng tám trường được ký.');
  const sorted={};
  for(const key of keys.sort()){
    const value=record[key];
    if(typeof value!=='string'||!value.trim()||value.length>400)throw Error('Trường không hợp lệ: '+key);
    sorted[key]=value.normalize('NFC');
  }
  return utf8.encode(JSON.stringify(sorted));
}
function decodeSignature(value){
  if(typeof value!=='string'||value.length>800)throw Error('Chữ ký Base64 không hợp lệ.');
  const bytes=Uint8Array.from(atob(value),ch=>ch.charCodeAt(0));
  if(bytes.length!==256)throw Error('Chữ ký không đúng độ dài RSA 2048-bit.');
  return bytes;
}
async function independentVerify(pkg,currentRecord){
  if(pkg?.schema!=='medseal.signed-prescription.v2')throw Error('Sai định dạng hồ sơ. Cần gói MEDSEAL v2.');
  if(pkg.algorithm?.signature!=='RSA-PSS'||pkg.algorithm?.hash!=='SHA-256'||
     pkg.algorithm?.saltLength!==32||pkg.algorithm?.modulusLength!==2048)throw Error('Cấu hình thuật toán không đúng.');
  canonical(pkg.signedRecord);
  const data=canonical(currentRecord);
  if(typeof pkg.originalHashSha256!=='string'||!/^[0-9a-f]{64}$/.test(pkg.originalHashSha256))throw Error('SHA-256 lưu trong hồ sơ sai định dạng.');
  const hash=toHex(await crypto.subtle.digest('SHA-256',data));
  const hashValid=hash===pkg.originalHashSha256;
  const signature=decodeSignature(pkg.signatureBase64);
  const jwk=pkg.publicKeyJwk;
  if(!jwk||jwk.kty!=='RSA'||typeof jwk.n!=='string'||typeof jwk.e!=='string')throw Error('Public Key không hợp lệ.');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSA-PSS',hash:'SHA-256'},false,['verify']);
  const signatureValid=await crypto.subtle.verify({name:'RSA-PSS',saltLength:32},key,signature,data);
  // Independent public-key fingerprint: compare this with the doctor's
  // display over a separate trusted channel before trusting signer identity.
  const spki=await crypto.subtle.exportKey('spki',key);
  const fingerprint=toHex(await crypto.subtle.digest('SHA-256',spki));
  return {hashValid,signatureValid,valid:hashValid&&signatureValid,fingerprint};
}
function result(type,title,description){
  const node=el('pharmaResult');
  node.className='pharma-result '+type;
  node.querySelector('use').setAttribute('href',type==='good'?'#i-check':type==='bad'?'#i-alert':'#i-info');
  node.querySelector('strong').textContent=title;
  node.querySelector('span').textContent=description;
}
function download(payload){
  const filename='medseal-'+payload.signedRecord.recordId.replace(/[^a-z0-9_-]/gi,'-')+'-v'+payload.version+'.json';
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function exportSigned(){
  const btn=el('doctorExportBtn');btn.disabled=true;
  try{download(await api.exportPackage());}
  catch(e){result('bad','Không thể xuất file',e.message);}
  finally{refresh();}
}
async function importFile(file){
  if(!file)return;
  portable=null;label('pharmaFingerprint','Chưa có');el('pharmaDose').disabled=true;el('pharmaVerifyBtn').disabled=true;
  result('waiting','Đang đọc hồ sơ','Đang kiểm tra cấu trúc và chữ ký được gửi từ máy bác sĩ.');
  try{
    if(file.size>maxBytes||file.size<10)throw Error('Tệp JSON phải nhỏ hơn 128 KB.');
    const pkg=JSON.parse(await file.text());
    const check=await independentVerify(pkg,pkg.signedRecord);
    portable=pkg;el('pharmaDose').value=pkg.signedRecord.dosage;
    label('pharmaFingerprint',check.fingerprint);
    el('pharmaDose').disabled=false;el('pharmaVerifyBtn').disabled=false;
    result(check.valid?'good':'bad',
      check.valid?'Gói hồ sơ hợp lệ khi nhận':'Gói hồ sơ không hợp lệ',
      'Mã '+pkg.signedRecord.recordId+' · V'+pkg.version+' · Có thể sửa liều nhận được để thử tấn công.');
  }catch(e){result('bad','Không thể nhập hồ sơ',e.message);}
  finally{el('importPrescription').value='';refresh();}
}
async function verifyPharmacist(){
  if(!portable)return;
  const button=el('pharmaVerifyBtn');button.disabled=true;
  result('waiting','Đang xác minh bằng Public Key…','Tính hash và kiểm tra RSA-PSS trực tiếp trên máy dược sĩ.');
  try{
    const candidate={...portable.signedRecord,dosage:el('pharmaDose').value.trim()};
    const r=await independentVerify(portable,candidate);
    if(r.valid){
      result('good','HỢP LỆ · TOÀN VẸN','Hash khớp và chữ ký RSA-PSS hợp lệ. Cần PKI để chứng nhận danh tính bác sĩ.');
    }else{
      result('bad','PHÁT HIỆN CAN THIỆP','SHA-256 '+(r.hashValid?'khớp':'không khớp')+' · RSA-PSS '+(r.signatureValid?'hợp lệ':'không hợp lệ')+'.');
    }
  }catch(e){result('bad','Không thể xác minh',e.message);}
  finally{button.disabled=false;}
}
function versionNode(item,latest){
  const row=document.createElement('div');row.className='revision-row'+(latest?' latest':'');
  const counter=document.createElement('div');counter.className='revision-counter';counter.textContent='V'+item.version;
  const details=document.createElement('div');details.className='revision-info';
  const title=document.createElement('strong');title.textContent=item.record.medicine+' · '+item.record.dosage;
  const meta=document.createElement('span');
  meta.textContent=new Date(item.signedAt).toLocaleString('vi-VN')+' · SHA-256 '+item.hashSha256.slice(0,12)+'…'+(latest?' · Mới nhất':'');
  details.append(title,meta);
  const check=document.createElement('button');check.type='button';check.textContent='Kiểm tra V'+item.version;
  check.addEventListener('click',async()=>{
    check.disabled=true;
    try{
      const pkg=await api.exportPackage();
      const r=await independentVerify({...pkg,signedRecord:item.record,originalHashSha256:item.hashSha256,signatureBase64:item.signatureBase64},item.record);
      check.textContent=r.valid?'HỢP LỆ ✓':'KHÔNG HỢP LỆ ✕';
      check.style.color=r.valid?'#07996f':'#c93a4e';
    }catch(e){check.textContent='LỖI XÁC MINH';check.title=e.message;}
    finally{setTimeout(()=>{check.textContent='Kiểm tra V'+item.version;check.style.color='';check.disabled=false;},3000);}
  });
  row.append(counter,details,check);return row;
}
function renderHistory(){
  const records=api.history();
  const list=el('revisionList');list.replaceChildren();
  if(!records.length){const none=document.createElement('div');none.className='history-empty';none.textContent='Chưa có phiên bản. Hãy ký hồ sơ đầu tiên.';list.append(none);}
  else for(const record of [...records].reverse())list.append(versionNode(record,record.version===records.length));
  const latest=records[records.length-1];
  label('doctorFileTitle',latest?latest.record.recordId+' · '+latest.record.patient:'Chưa có hồ sơ phát hành');
  label('doctorVersionLabel',latest?'Phiên bản V'+latest.version+' · Liều '+latest.record.dosage:'Cần tạo chữ ký số trước');
  refresh();
}
function refresh(){
  const ready=!!api?.ready(),signed=!!api?.signed();
  el('doctorExportBtn').disabled=!ready||!signed;
  el('createRevisionBtn').disabled=!ready||!signed;
  el('autoStartBtn').disabled=!ready||running;
  el('autoPauseBtn').disabled=!running;
  el('autoStopBtn').disabled=!running;
}
async function createRevision(){
  if(!api.ready()||!api.signed())return;
  el('createRevisionBtn').disabled=true;
  const before=api.history().length;
  const ok=await api.sign();
  if(ok&&api.history().length>before){
    renderHistory();
    label('autoStatus','Đã ký phiên bản V'+api.history().length+' mới bằng RSA-PSS.');
  }
  refresh();
}
function progress(phase,msg){
  el('autoProgress').style.width=String(phase*25)+'%';
  label('autoStatus',msg);
}
async function waitFor(ms,token){
  while(ms>0){
    if(token!==activeRun)throw Error('ABORTED');
    await new Promise(resolve=>setTimeout(resolve,80));
    if(!paused)ms-=80;
  }
  if(token!==activeRun)throw Error('ABORTED');
}
function stop(){
  activeRun++;running=false;paused=false;
  el('autoPauseBtn').innerHTML='<svg class="ico"><use href="#i-pause"/></svg> Tạm dừng';
  progress(0,'Đã dừng. Có thể chạy lại từ đầu.');
  refresh();
}
async function start(){
  if(running||!api.ready())return;
  const token=++activeRun;running=true;paused=false;refresh();
  try{
    progress(0,'Cảnh 1/4 · Bác sĩ đang ký hồ sơ mẫu...');
    api.resetSample();
    if(!await api.sign())throw Error('Không thể ký hồ sơ mẫu.');
    if(token!==activeRun)return;
    renderHistory();progress(1,'Cảnh 1/4 · Đã tạo chữ ký số SHA-256 + RSA-PSS.');
    await waitFor(1650,token);
    progress(1,'Cảnh 2/4 · Đang xác minh hồ sơ gốc...');
    if(!await api.verify() || !api.verification()?.hashValid || !api.verification()?.signatureValid)
      throw Error('Bệnh án gốc chưa vượt qua đủ hai phép kiểm tra.');
    if(token!==activeRun)return;
    progress(2,'Cảnh 2/4 · Hồ sơ còn nguyên vẹn, chữ ký hợp lệ.');
    await waitFor(1650,token);
    progress(2,'Cảnh 3/4 · Sửa liều từ 1 viên/lần thành 4 viên/lần...');
    if(!api.tamperDose())throw Error('Không thể mô phỏng sửa dữ liệu.');
    progress(3,'Cảnh 3/4 · Dữ liệu khác nhưng giữ nguyên chữ ký.');
    await waitFor(1700,token);
    progress(3,'Cảnh 4/4 · Đang phát hiện dấu hiệu can thiệp...');
    const valid=await api.verify();
    if(token!==activeRun)return;
    const evidence=api.verification();
    if(valid || !evidence || evidence.valid!==false || evidence.hashValid!==false || evidence.signatureValid!==false)
      throw Error('Bước kiểm tra chưa chứng minh được dữ liệu đã bị sửa; không đưa ra kết luận giả định.');
    progress(4,'HOÀN TẤT · Phát hiện sửa liều thuốc sau ký.');
    el('so-sanh').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){if(e.message!=='ABORTED')label('autoStatus','Lỗi demo: '+e.message);}
  finally{if(token===activeRun){running=false;paused=false;refresh();}}
}
function togglePause(){
  if(!running)return;
  paused=!paused;
  el('autoPauseBtn').innerHTML=paused?
    '<svg class="ico"><use href="#i-play"/></svg> Tiếp tục':
    '<svg class="ico"><use href="#i-pause"/></svg> Tạm dừng';
  label('autoStatus',paused?'Đang tạm dừng · Nhấn Tiếp tục để xem bước tiếp theo.':'Đang tiếp tục trình diễn...');
}
el('doctorExportBtn').addEventListener('click',exportSigned);
el('importPrescription').addEventListener('change',e=>importFile(e.target.files?.[0]));
el('pharmaDose').addEventListener('input',()=>{if(portable)result('waiting','Chưa xác minh thay đổi','Dược sĩ cần kiểm tra lại SHA-256 và RSA-PSS.');});
el('pharmaVerifyBtn').addEventListener('click',verifyPharmacist);
el('createRevisionBtn').addEventListener('click',createRevision);
el('autoStartBtn').addEventListener('click',start);
el('autoPauseBtn').addEventListener('click',togglePause);
el('autoStopBtn').addEventListener('click',stop);
window.addEventListener('medseal:signed',renderHistory);
window.addEventListener('medseal:verified',refresh);
const observer=new MutationObserver(refresh);
observer.observe(el('signBtn'),{attributes:true,attributeFilter:['disabled']});
observer.observe(el('savedHash'),{childList:true,subtree:true});
observer.observe(el('publicKeyResult'),{childList:true,subtree:true});
renderHistory();
