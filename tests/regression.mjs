// Run with: node tests/regression.mjs — no npm dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import '../js/storage-sync.js';
import * as utils from '../js/utils.js';
import { StorageManager } from '../js/StorageManager.js';
import { PomodoroTimer } from '../js/PomodoroTimer.js';
import { validateBackup } from '../js/BackupValidator.js';
const { merge, clone } = globalThis.CanopyPersistence;
const memory = new Map();
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
globalThis.document = { getElementById: () => null };
const base = [{id:'n', content:'old', z:1, position:{x:0,y:0}}];
const remote = [{...base[0],content:'new'}];
assert.equal(merge(base,[{...base[0],z:2}],remote)[0].content,'new');
assert.equal(merge(base,[{...base[0],z:2}],remote)[0].z,2);
assert.deepEqual(merge(base,[{...base[0],z:2}],[]),[], 'stale edits must not resurrect deleted notes');
assert.equal(merge(base,[],remote).length,0);
assert.equal(merge([], [{id:'a'}], [{id:'b'}]).length,2);

let queue = Promise.resolve();
Object.defineProperty(globalThis, 'navigator', {value:{locks:{request: (_name, task) => {
  const next = queue.then(task); queue = next.catch(()=>{}); return next;
}}}, configurable:true});
let data = {desktop_tab_data:{items:[]}};
let fail = false;
globalThis.chrome = {runtime:{lastError:null},storage:{local:{
  get(keys,cb) { queueMicrotask(()=>cb(clone(Object.fromEntries(keys.filter(k=>k in data).map(k=>[k,data[k]]))))); },
  set(values,cb) { queueMicrotask(()=>{
    if(fail) chrome.runtime.lastError={message:'QUOTA_BYTES exceeded'};
    else Object.assign(data,clone(values));
    cb(); chrome.runtime.lastError=null;
  }); }
}}};
const a = new StorageManager(), b = new StorageManager();
await a.loadData(); await b.loadData();
a.data.items.push({id:'a'}); b.data.items.push({id:'b'});
assert.deepEqual(await Promise.all([a.saveData(),b.saveData()]),[true,true]);
assert.equal(data.desktop_tab_data.items.length,2);
fail = true; a.data.items.push({id:'c'});
const oldError=console.error; console.error=()=>{};
assert.equal(await a.saveData(),false); fail=false;
assert.equal(await a.saveData(),true); console.error=oldError;
assert.ok(data.desktop_tab_data.items.some(i=>i.id==='c'));

const timer = new PomodoroTimer(); timer._render=()=>{};
timer._setPhaseTime(); timer._remaining=1111; timer._pause();
const restored = new PomodoroTimer(); restored._loadConfig();
assert.equal(restored._restoreRunningState(),true); assert.equal(restored._remaining,1111);
timer.reset(); const reset = new PomodoroTimer(); reset._loadConfig(); reset._restoreRunningState();
assert.equal(reset._remaining,1500);

const backup = {app:'canopy',version:2,chromeStorage:{desktop_tab_data:{items:[]}},localStorage:{}};
validateBackup(backup);
assert.throws(()=>validateBackup({...backup,chromeStorage:{...backup.chromeStorage,canopy_sticky_notes:{bad:true}}}));
assert.throws(()=>validateBackup({...backup,localStorage:{pomodoro_config:'null'}}));
validateBackup({...backup,chromeStorage:{...backup.chromeStorage,audio_config:JSON.stringify({music:{tracks:[{name:'Track',url:'https://example.com/song.mp3'}]}})}});

let source=readFileSync(new URL('../js/app.js',import.meta.url),'utf8').replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm,'');
source=source.slice(0,source.indexOf('// ─── Start'))+'\nglobalThis.App=CanopyApp;';
const context=vm.createContext({...utils,console,URL}); vm.runInContext(source,context);
const app=Object.create(context.App.prototype);
const imported=app._sanitizeImportedData({items:[{id:'broken"id',type:'shortcut',url:'https://example.com'}]});
assert.match(imported.items[0].id,/^[a-zA-Z0-9_-]+$/);
console.log('PASS: merge conflicts, deletions, concurrent saves, quota retry, Pomodoro pause/reset, backup validation, imported IDs');
