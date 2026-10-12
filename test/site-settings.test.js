'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const store=require('../lib/site-settings');
test('settings validate values, omit unknown/server-only keys and overlay defaults',()=>{
 assert.deepEqual(store.validate({siteTitle:'Example',allowRawHtml:true,password:'secret',showHero:false}),{siteTitle:'Example',showHero:false});
 for(const x of [{siteTitle:''},{headerTitle:'x'.repeat(81)},{siteUrl:'javascript:alert(1)'},{siteUrl:'https://user:pass@example.com'},{showHero:'true'},{siteSubtitle:[]}])assert.throws(()=>store.validate(x),/Invalid/);
 assert.equal(store.validate({siteUrl:'https://example.com/'}).siteUrl,'https://example.com');
});
test('settings write atomically with revision checks and do not expose unsafe stored keys',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'settings-'));try{
 const rev=store.write(dir,{siteTitle:'New title',showHero:false,allowRawHtml:true},'missing');assert.notEqual(rev,'missing');assert.equal(store.read(dir).siteTitle,'New title');assert.ok(!JSON.stringify(store.read(dir)).includes('allowRawHtml'));assert.equal(fs.statSync(path.join(dir,store.FILE)).mode&0o777,0o640);assert.throws(()=>store.write(dir,{siteTitle:'Lost'},'missing'),/changed/);assert.equal(store.read(dir).siteTitle,'New title');assert.equal(store.effective({headerTitle:'Base'},dir).headerTitle,'Base');assert.equal(store.effective({siteTitle:'Only title'},dir).headerTitle,'Only title');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('malicious text remains data and damaged overrides fail closed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'settings-'));try{store.write(dir,{siteTitle:'<script>alert(1)</script>'},'missing');assert.equal(store.read(dir).siteTitle,'<script>alert(1)</script>');fs.writeFileSync(path.join(dir,store.FILE),'not json');assert.throws(()=>store.read(dir));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
