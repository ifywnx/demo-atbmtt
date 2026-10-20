/*
 * MEDSEAL — Educational demonstration only.
 * Genuine Web Crypto API: SHA-256 and RSA-PSS-2048 with SHA-256.
 * All keys and signed records stay in the current browser session.
 */
'use strict';

const $ = (id) => document.getElementById(id);
const textEncoder = new TextEncoder();
const FIELD_IDS = ['recordId', 'visitDate', 'patient', 'doctor', 'diagnosis', 'medicine', 'dosage'];
const INITIAL = Object.freeze({
  recordId: 'BN-2026-0158',
  visitDate: '2026-10-16',
  patient: 'Nguyễn Minh Anh',
  doctor: 'BS. Trần Minh',
  diagnosis: 'Viêm họng cấp',
  medicine: 'Amoxicillin 500 mg',
  dosage: '1 viên/lần'
});

let keyPair = null;
let signed = null;
let lastVerification = null;
const revisionHistory = [];
let calculationId = 0;
let toastTimer = null;
const entries = [];
let busy = false;

function readForm() {
  const record = {};
  for (const id of FIELD_IDS) record[id] = $(id).value.normalize('NFC').trim();
  return record;
}
function canonicalize(record) {
  // Deterministic representation: sorted top-level keys, Unicode NFC, UTF-8.
  const sorted = {};
  for (const key of Object.keys(record).sort()) {
    if (typeof record[key] !== 'string') throw new Error('Trường dữ liệu không hợp lệ.');
    sorted[key] = record[key].normalize('NFC');
  }
  return JSON.stringify(sorted);
}
function bytesFor(record) { return textEncoder.encode(canonicalize(record)); }
function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function digestHex(bytes) { return bytesToHex(await crypto.subtle.digest('SHA-256', bytes)); }
function bytesToBase64(bytes) {
  // The signature length is only 256 bytes for RSA-2048.
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function formatTime(iso) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));
}
function setLabel(id, value, cls) {
  const el = $(id);
  el.textContent = value;
  if (cls) el.className = cls;
}
function toast(message, isError = false) {
  const element = $('toast');
  element.textContent = message;
  element.className = 'toast' + (isError ? ' error' : '') + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 3200);
}
function logEvent(title, desc, type = 'info') {
  entries.unshift({ title, desc, type, when: new Date() });
  if (entries.length > 35) entries.pop();
  renderLogs();
}
function renderLogs() {
  const container = $('logs');
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = 'Chưa có sự kiện.';
    container.append(empty);
    return;
  }
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'log-row ' + entry.type;
    const dot = document.createElement('span');
    dot.className = 'log-dot';
    const body = document.createElement('div');
    body.className = 'log-row-body';
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const desc = document.createElement('p');
    desc.textContent = entry.desc;
    body.append(title, desc);
    const time = document.createElement('time');
    time.textContent = entry.when.toLocaleTimeString('vi-VN', { hour12: false });
    row.append(dot, body, time);
    container.append(row);
  }
}
function setVerdict(kind, title, desc) {
  $('verdict').className = 'verdict ' + kind;
  const symbol = $('verdict').querySelector('.verdict-symbol use');
  symbol.setAttribute('href', kind === 'good' ? '#i-check' : kind === 'bad' ? '#i-x' : '#i-info');
  setLabel('verdictTitle', title);
  setLabel('verdictDesc', desc);
  const formTag = $('formTag');
  if (kind === 'good') {
    formTag.className = 'pill success'; formTag.textContent = 'ĐÃ XÁC MINH';
  } else if (kind === 'bad') {
    formTag.className = 'pill danger'; formTag.textContent = 'PHÁT HIỆN SỬA ĐỔI';
  } else if (signed) {
    formTag.className = 'pill neutral'; formTag.textContent = 'ĐÃ KÝ / CHỜ KIỂM TRA';
  } else {
    formTag.className = 'pill neutral'; formTag.textContent = 'CHƯA KÝ';
  }
}
function updateButtons() {
  const hasKeys = !!keyPair;
  const hasSigned = !!signed;
  $('signBtn').disabled = !hasKeys || busy;
  $('verifyBtn').disabled = !hasKeys || !hasSigned || busy;
  $('restoreBtn').disabled = !hasSigned || busy;
  $('doseAttackBtn').disabled = !hasSigned || busy;
  $('medicineAttackBtn').disabled = !hasSigned || busy;
  $('signatureAttackBtn').disabled = !hasSigned || busy;
  $('copyHashBtn').disabled = !hasSigned;
  $('exportBtn').disabled = !hasSigned || busy;
  $('testBtn').disabled = !hasKeys || busy;
}
function resetVerificationDisplay() {
  lastVerification = null;
  setLabel('hashResult', 'Chưa kiểm tra', 'result-wait');
  setLabel('sigResult', 'Chưa kiểm tra', 'result-wait');
  setLabel('hashComparison', 'CHƯA KIỂM TRA', 'comparison');
  if (signed) {
    setVerdict('progress', 'Hồ sơ đang chờ xác minh', 'Nhấn “Kiểm tra tính toàn vẹn” để đối chiếu với chữ ký đã lưu.');
    setLabel('metricStatus', 'Chờ xác minh');
    setLabel('metricDetail', 'Chữ ký đã được tạo');
  }
}
async function updateLiveHash() {
  const seq = ++calculationId;
  try {
    const current = readForm();
    $('canonicalPreview').textContent = canonicalize(signed ? { ...current, signedAt: signed.record.signedAt } : current);
    const hash = await digestHex(bytesFor(signed ? { ...current, signedAt: signed.record.signedAt } : current));
    if (seq !== calculationId) return;
    $('currentHash').textContent = hash;
    $('currentHash').classList.remove('muted');
    if (signed) {
      const same = hash === signed.hash;
      setLabel('hashComparison', same ? 'HASH TRÙNG KHỚP' : 'HASH KHÁC NHAU', 'comparison ' + (same ? 'same' : 'diff'));
    }
  } catch (error) {
    if (seq === calculationId) $('currentHash').textContent = 'Không thể tính hash: ' + error.message;
  }
}
function validated() {
  if (!$('recordForm').reportValidity()) return false;
  return true;
}

async function signRecord(event) {
  event.preventDefault();
  if (!keyPair || busy || !validated()) return;
  busy = true; updateButtons();
  try {
    const record = { ...readForm(), signedAt: new Date().toISOString() };
    const bytes = bytesFor(record);
    const [hash, signature] = await Promise.all([
      digestHex(bytes),
      crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keyPair.privateKey, bytes)
    ]);
    signed = {
      record: Object.freeze(record),
      hash,
      originalSignature: new Uint8Array(signature),
      storedSignature: new Uint8Array(signature)
    };
    revisionHistory.push({
      version: revisionHistory.length + 1,
      record: { ...record },
      hashSha256: hash,
      signatureBase64: bytesToBase64(signature),
      signedAt: record.signedAt
    });
    $('savedHash').textContent = hash;
    $('savedHash').classList.remove('muted');
    $('signedAt').textContent = 'Đã ký: ' + formatTime(record.signedAt);
    resetVerificationDisplay();
    logEvent('Ký hồ sơ thành công', 'Chuẩn hóa JSON → SHA-256 → RSA-PSS 2048-bit. Đã lưu bản gốc, hash và chữ ký.', 'ok');
    toast('Đã ký hồ sơ bằng RSA-PSS. Bây giờ hãy kiểm tra hoặc mô phỏng sửa dữ liệu.');
    await updateLiveHash();
    window.dispatchEvent(new CustomEvent('medseal:signed', {
      detail: { version: revisionHistory.length, record: { ...record }, hash }
    }));
    return true;
  } catch (error) {
    logEvent('Lỗi ký hồ sơ', error.message, 'error');
    toast('Không thể ký hồ sơ: ' + error.message, true);
    return false;
  } finally {
    busy = false; updateButtons();
  }
}

async function verifyRecord() {
  if (!signed || !keyPair || busy) return;
  busy = true; updateButtons();
  try {
    const record = { ...readForm(), signedAt: signed.record.signedAt };
    const bytes = bytesFor(record);
    const [freshHash, signatureValid] = await Promise.all([
      digestHex(bytes),
      crypto.subtle.verify(
        { name: 'RSA-PSS', saltLength: 32 },
        keyPair.publicKey,
        signed.storedSignature,
        bytes
      )
    ]);
    const hashValid = freshHash === signed.hash;
    const valid = hashValid && signatureValid;
    lastVerification = { hashValid, signatureValid, valid, verifiedAt: new Date().toISOString() };
    setLabel('hashResult', hashValid ? 'KHỚP ✓' : 'KHÔNG KHỚP ✕', hashValid ? 'result-good' : 'result-bad');
    setLabel('sigResult', signatureValid ? 'HỢP LỆ ✓' : 'KHÔNG HỢP LỆ ✕', signatureValid ? 'result-good' : 'result-bad');
    if (valid) {
      setVerdict('good', 'Hồ sơ toàn vẹn · Chữ ký hợp lệ', 'SHA-256 trùng khớp và RSA-PSS xác minh thành công bằng Public Key.');
      setLabel('metricStatus', 'An toàn ✓');
      setLabel('metricDetail', 'Nội dung và chữ ký hợp lệ');
      logEvent('Xác minh thành công', 'Hash khớp; chữ ký RSA-PSS hợp lệ. Không phát hiện sửa đổi sau khi ký.', 'ok');
      toast('Xác minh thành công! Hồ sơ chưa bị thay đổi sau khi ký.');
    } else {
      const reason = !hashValid
        ? 'Nội dung hiện tại khác bản đã ký. Mã SHA-256 thay đổi và chữ ký không còn xác minh được.'
        : 'Nội dung không đổi, nhưng chữ ký số đã bị can thiệp hoặc không hợp lệ.';
      setVerdict('bad', 'PHÁT HIỆN CAN THIỆP DỮ LIỆU', reason);
      setLabel('metricStatus', 'Bất thường ✕');
      setLabel('metricDetail', !hashValid ? 'Dữ liệu đã thay đổi' : 'Chữ ký đã bị thay đổi');
      logEvent('Phát hiện can thiệp', 'Hash: ' + (hashValid ? 'khớp' : 'khác') + ' · RSA-PSS: ' + (signatureValid ? 'hợp lệ' : 'không hợp lệ'), 'error');
      toast('Cảnh báo: hồ sơ hoặc chữ ký đã bị chỉnh sửa!', true);
    }
    await updateLiveHash();
    window.dispatchEvent(new CustomEvent('medseal:verified', {
      detail: { ...lastVerification, version: revisionHistory.length }
    }));
    return valid;
  } catch (error) {
    logEvent('Lỗi xác minh', error.message, 'error');
    toast('Không thể xác minh: ' + error.message, true);
    return false;
  } finally {
    busy = false; updateButtons();
  }
}

function requireSigned() {
  if (!signed) {
    toast('Hãy ký hồ sơ trước khi mô phỏng tấn công.', true);
    return false;
  }
  return true;
}
function attackDose() {
  if (!requireSigned()) return;
  const originalDose = signed.record.dosage;
  $('dosage').value = '4 viên/lần';
  resetVerificationDisplay(); updateLiveHash();
  logEvent('Tấn công: thay đổi liều thuốc', 'Liều đã ký: ' + originalDose + ' → liều hiện tại: 4 viên/lần. Giữ nguyên hash và chữ ký đã lưu.', 'warn');
  toast('Đã sửa liều thuốc. Nhấn “Kiểm tra tính toàn vẹn” để phát hiện.');
}
function attackMedicine() {
  if (!requireSigned()) return;
  const original = signed.record.medicine;
  $('medicine').value = 'Azithromycin 500 mg';
  resetVerificationDisplay(); updateLiveHash();
  logEvent('Tấn công: sửa tên thuốc', 'Thuốc đã ký: ' + original + ' → thuốc hiện tại: Azithromycin 500 mg. Ví dụ minh họa, không phải chỉ định y tế.', 'warn');
  toast('Đã sửa tên thuốc. Hãy chạy xác minh chữ ký.');
}
function attackSignature() {
  if (!requireSigned()) return;
  // Tamper only signature bytes, not the record: hash stays equal, RSA verify fails.
  signed.storedSignature = new Uint8Array(signed.originalSignature);
  signed.storedSignature[0] ^= 1;
  resetVerificationDisplay(); updateLiveHash();
  logEvent('Tấn công: giả mạo chữ ký', 'Đã thay đổi 1 bit trong chữ ký RSA-PSS được lưu. Dữ liệu bệnh án không đổi.', 'warn');
  toast('Đã can thiệp chữ ký. Hash có thể khớp nhưng RSA-PSS sẽ báo sai.');
}
function restoreOriginal() {
  if (!requireSigned()) return;
  for (const id of FIELD_IDS) $(id).value = signed.record[id];
  signed.storedSignature = new Uint8Array(signed.originalSignature);
  resetVerificationDisplay(); updateLiveHash();
  logEvent('Khôi phục bản gốc', 'Đã đưa dữ liệu và chữ ký về đúng phiên bản được bác sĩ ký.', 'ok');
  toast('Đã khôi phục. Bấm xác minh để kiểm tra lại.');
}
function markManualEdit() {
  if (signed) resetVerificationDisplay();
  updateLiveHash();
}
async function copyHash() {
  if (!signed) return;
  try {
    await navigator.clipboard.writeText(signed.hash);
    toast('Đã sao chép SHA-256 của hồ sơ đã ký.');
  } catch (_) {
    toast('Không sao chép được. Hãy chọn chuỗi hash để sao chép thủ công.', true);
  }
}
async function exportEvidence() {
  if (!signed || !keyPair) return;
  try {
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const record = { ...readForm(), signedAt: signed.record.signedAt };
    const data = {
      schema: 'medseal.educational-demo.v1',
      version: revisionHistory.length,
      revisions: revisionHistory.map(item => ({ ...item, record: { ...item.record } })),
      warning: 'Dữ liệu giả lập. Không dùng làm chứng từ y tế hoặc triển khai bệnh viện.',
      algorithm: { digest: 'SHA-256', signature: 'RSA-PSS', modulusLength: 2048, saltLength: 32, encoding: 'UTF-8', canonicalization: 'JSON keys sorted lexicographically; Unicode NFC; compact JSON' },
      signedRecord: signed.record,
      originalHashSha256: signed.hash,
      signatureBase64: bytesToBase64(signed.storedSignature),
      publicKeyJwk: publicKey,
      inspectedRecord: record,
      inspectedHashSha256: await digestHex(bytesFor(record)),
      lastVerification
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'medseal-bang-chung-' + signed.record.recordId.replace(/[^a-zA-Z0-9_-]/g, '-') + '.json';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    logEvent('Xuất bằng chứng', 'Đã tải JSON gồm hồ sơ đã ký, hash, chữ ký RSA-PSS và khóa công khai. Không có Private Key.', 'ok');
    toast('Đã xuất JSON. Chỉ chứa khóa công khai, không chứa khóa bí mật.');
  } catch (error) {
    toast('Lỗi xuất bằng chứng: ' + error.message, true);
  }
}
async function selfTest() {
  if (!keyPair || busy) return;
  busy = true; updateButtons();
  try {
    const sample = { test: '1 viên/lần' };
    const changed = { test: '4 viên/lần' };
    const sampleBytes = bytesFor(sample);
    const changedBytes = bytesFor(changed);
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, keyPair.privateKey, sampleBytes));
    const correct = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, keyPair.publicKey, signature, sampleBytes);
    const tamperedData = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, keyPair.publicKey, signature, changedBytes);
    const tamperedSignature = Uint8Array.from(signature);
    tamperedSignature[0] ^= 1;
    const invalidSignature = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, keyPair.publicKey, tamperedSignature, sampleBytes);
    const digestsDiffer = (await digestHex(sampleBytes)) !== (await digestHex(changedBytes));
    const results = [correct, !tamperedData, !invalidSignature, digestsDiffer];
    const passed = results.filter(Boolean).length;
    logEvent('Kiểm thử mật mã: ' + passed + '/4 đạt', '1. Ký đúng: ' + (correct ? 'PASS' : 'FAIL') + ' · 2. Sửa dữ liệu: ' + (!tamperedData ? 'PASS' : 'FAIL') + ' · 3. Sửa chữ ký: ' + (!invalidSignature ? 'PASS' : 'FAIL') + ' · 4. Hash đổi: ' + (digestsDiffer ? 'PASS' : 'FAIL'), passed === 4 ? 'ok' : 'error');
    toast('Kết quả tự kiểm thử: ' + passed + '/4 phép thử đạt.', passed !== 4);
  } catch (error) {
    logEvent('Lỗi tự kiểm thử', error.message, 'error');
    toast('Kiểm thử thất bại: ' + error.message, true);
  } finally {
    busy = false; updateButtons();
  }
}

async function initialize() {
  updateButtons();
  renderLogs();
  await updateLiveHash();
  if (!window.isSecureContext || !crypto || !crypto.subtle) {
    const msg = 'Web Crypto yêu cầu HTTPS hoặc localhost. Hãy mở https://demo-atbmtt.vercel.app/';
    $('keySidebar').textContent = 'Không thể khởi tạo khóa';
    setLabel('publicKeyResult', 'Chưa hỗ trợ', 'result-bad');
    setVerdict('bad', 'Không thể dùng Web Crypto', msg);
    logEvent('Môi trường chưa an toàn', msg, 'error');
    return;
  }
  try {
    logEvent('Khởi tạo phiên demo', 'Đang tạo cặp khóa RSA-PSS 2048-bit bằng Web Crypto API.');
    keyPair = await crypto.subtle.generateKey(
      { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const fingerprint = await digestHex(spki);
    $('keyFingerprint').textContent = fingerprint;
    $('keySidebar').textContent = 'Đã tạo khóa · Chỉ trên thiết bị';
    setLabel('publicKeyResult', 'SẴN SÀNG ✓', 'result-good');
    logEvent('Sinh khóa thành công', 'RSA 2048-bit, khóa bí mật không thể xuất, Public Key fingerprint: ' + fingerprint.slice(0, 16) + '…', 'ok');
  } catch (error) {
    $('keySidebar').textContent = 'Khởi tạo khóa thất bại';
    setLabel('publicKeyResult', 'THẤT BẠI', 'result-bad');
    setVerdict('bad', 'Lỗi tạo khóa RSA', error.message);
    logEvent('Lỗi tạo khóa RSA', error.message, 'error');
  } finally {
    updateButtons();
  }
}

// Public bridge for classroom presentation and cross-device read-only verification.
// Only exports public data and signed records. The non-exportable private key is never exposed.
window.MedSealDemo = Object.freeze({
  async sign() { return Boolean(await signRecord({ preventDefault() {} })); },
  async verify() { return Boolean(await verifyRecord()); },
  tamperDose() { if (!signed || busy) return false; attackDose(); return true; },
  restore() { if (!signed || busy) return false; restoreOriginal(); return true; },
  resetSample() {
    if (busy) return false;
    for (const id of FIELD_IDS) $(id).value = INITIAL[id];
    if (signed) resetVerificationDisplay();
    updateLiveHash();
    $('recordForm').dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  ready() { return Boolean(keyPair && !busy); },
  signed() { return Boolean(signed); },
  history() { return revisionHistory.map(item => ({ ...item, record: { ...item.record } })); },
  verification() { return lastVerification ? { ...lastVerification } : null; },
  fingerprint() { return $('keyFingerprint').textContent; },
  async exportPackage() {
    if (!signed || !keyPair) throw new Error('Chưa ký bệnh án.');
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    return {
      schema: 'medseal.signed-prescription.v2',
      description: 'Đơn thuốc giả lập để xác minh công khai. Không chứa Private Key.',
      algorithm: { hash: 'SHA-256', signature: 'RSA-PSS', saltLength: 32, modulusLength: 2048, canonicalization: 'Sorted JSON keys / Unicode NFC / UTF-8' },
      signedRecord: { ...signed.record },
      originalHashSha256: signed.hash,
      signatureBase64: bytesToBase64(signed.originalSignature),
      publicKeyJwk,
      version: revisionHistory.length,
      revisions: revisionHistory.map(item => ({ ...item, record: { ...item.record } }))
    };
  }
});

$('recordForm').addEventListener('submit', signRecord);
$('recordForm').addEventListener('input', markManualEdit);
$('verifyBtn').addEventListener('click', verifyRecord);
$('restoreBtn').addEventListener('click', restoreOriginal);
$('doseAttackBtn').addEventListener('click', attackDose);
$('medicineAttackBtn').addEventListener('click', attackMedicine);
$('signatureAttackBtn').addEventListener('click', attackSignature);
$('copyHashBtn').addEventListener('click', copyHash);
$('exportBtn').addEventListener('click', exportEvidence);
$('testBtn').addEventListener('click', selfTest);
$('clearLogBtn').addEventListener('click', () => { entries.length = 0; renderLogs(); toast('Đã xóa nhật ký hiển thị trong phiên.'); });
document.querySelectorAll('.side-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.side-nav a').forEach((el) => el.classList.remove('active'));
    link.classList.add('active');
  });
});
initialize();