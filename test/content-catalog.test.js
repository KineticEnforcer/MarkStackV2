'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {catalog,updateSection,revision}=require('../lib/content-catalog');
test('section settings preserve Markdown body and unrelated frontmatter',()=>{
 const original='---\ntitle: Old\norder: 7\nhidden: false\nauthor: KineticEnforcer\ncustom:\n  nested: yes\n---\n# Keep this body\n\nExact text.\n';
 const out=updateSection(original,{title:'New title',order:2,hidden:true});
 assert.ok(out.endsWith('# Keep this body\n\nExact text.\n'));assert.ok(out.includes('author: KineticEnforcer\ncustom:\n  nested: yes'));assert.ok(out.includes('title: New title'));assert.ok(!out.includes('title: Old'));assert.notEqual(revision(out),revision(original));
});
test('section settings reject wrong types, long titles and executable frontmatter',()=>{
 for(const x of [{title:'',order:0,hidden:false},{title:'x'.repeat(121),order:0,hidden:false},{title:'x',order:0.5,hidden:false},{title:'x',order:0,hidden:'yes'}])assert.throws(()=>updateSection('',x));
 assert.throws(()=>updateSection('---js\nprocess.exit()\n---\n',{title:'Safe',order:0,hidden:false}),/Unsupported/);
});
test('catalog describes real pages and sections without following symbolic links',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'catalog-'));
 try {fs.mkdirSync(path.join(dir,'it'));fs.writeFileSync(path.join(dir,'it/_index.md'),'---\ntitle: Tech Notes\norder: 3\nhidden: true\n---\nbody');fs.writeFileSync(path.join(dir,'it/guide.md'),'---\ntitle: A Guide\n---\n');fs.symlinkSync(os.tmpdir(),path.join(dir,'escape'));const c=catalog(dir,[{name:'it-guy',role:'editor',sections:['it']}]);assert.equal(c.sections.length,1);assert.equal(c.sections[0].pageCount,2);assert.deepEqual(c.sections[0].editors,['it-guy']);assert.equal(c.sections[0].url,'/tech-notes/');assert.equal(c.pages.find(p=>p.path==='it/guide.md').url,'/tech-notes/a-guide');assert.equal(c.sections[0].hidden,true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('complex frontmatter fails safely instead of dropping quoted unrelated keys',()=>{
 const original='---\ntitle: Old\n"custom-key": keep\n---\nBody stays\n';
 assert.throws(()=>updateSection(original,{title:'New',order:1,hidden:false}),/safely/);
});
