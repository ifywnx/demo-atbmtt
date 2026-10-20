import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// Protocol-level smoke test for MEDSEAL SHA-256 + RSA-PSS 2048-bit.
// Run with: node tests/crypto-smoke.mjs (Node.js 20+).
const { subtle } = webcrypto;
const enc = new TextEncoder();
const bytes = record => enc.encode(JSON.stringify(Object.fromEntries(
  Object.keys(record).sort().map(key => [key, record[key].normalize('NFC')])
)));
const hex = b => Buffer.from(b).toString('hex');
const hash = async record => hex(await subtle.digest('SHA-256', bytes(record)));
const keyPair = await subtle.generateKey({
  name:'RSA-PSS', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'
},false,['sign','verify']);
const v1 = {
  recordId:'BN-2026-0158', visitDate:'2026-10-16', patient:'Nguyễn Minh Anh',
  doctor:'BS. Trần Minh', diagnosis:'Viêm họng cấp',
  medicine:'Amoxicillin 500 mg', dosage:'1 viên/lần',
  signedAt:'2026-10-20T10:00:00.000Z'
};
const signature = new Uint8Array(await subtle.sign({name:'RSA-PSS',saltLength:32},keyPair.privateKey,bytes(v1)));
const originalHash = await hash(v1);
const publicJwk = await subtle.exportKey('jwk',keyPair.publicKey);
const recipient = await subtle.importKey('jwk',publicJwk,{name:'RSA-PSS',hash:'SHA-256'},true,['verify']);
const verify = (record,sig=signature) => subtle.verify({name:'RSA-PSS',saltLength:32},recipient,sig,bytes(record));
assert.equal(await verify(v1),true);
console.log('PASS 1/7: Independent recipient verifies the signed record');
assert.equal(await hash(v1),originalHash);
console.log('PASS 2/7: SHA-256 matches stored evidence');
const attacked = {...v1,dosage:'4 viên/lần'};
assert.equal(await verify(attacked),false);
assert.notEqual(await hash(attacked),originalHash);
console.log('PASS 3/7: Tampered dosage fails signature and hash');
const fake = Uint8Array.from(signature);fake[0] ^= 1;
assert.equal(await verify(v1,fake),false);
assert.equal(await hash(v1),originalHash);
console.log('PASS 4/7: Signature tampering fails, hash unchanged');
const sourceSPKI = await subtle.exportKey('spki',keyPair.publicKey);
const recipientSPKI = await subtle.exportKey('spki',recipient);
assert.equal(hex(await subtle.digest('SHA-256',sourceSPKI)),
  hex(await subtle.digest('SHA-256',recipientSPKI)));
console.log('PASS 5/7: Public key fingerprints match across devices');
const v2 = {...v1,dosage:'2 viên/lần',signedAt:'2026-10-20T10:10:00.000Z'};
const v2Signature = new Uint8Array(await subtle.sign({name:'RSA-PSS',saltLength:32},keyPair.privateKey,bytes(v2)));
assert.equal(await verify(v2,v2Signature),true);
assert.equal(await verify(v1),true);
assert.equal(await verify(v2),false);
console.log('PASS 6/7: Re-signing creates a separate valid revision');
const decomposed = {...v1,patient:'Nguye\u0302\u0303n Minh Anh'};
assert.equal(await hash(decomposed),await hash(v1));
console.log('PASS 7/7: Unicode NFC canonicalization');
console.log('MEDSEAL: 7/7 protocol checks PASS');
