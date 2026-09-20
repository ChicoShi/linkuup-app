const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
 let ctor, serial=0;
 const timers=[], digests=[], frames=new Map(), handlers={}, listeners={};
 const rooms=[1,2,3].map(id=>({id:()=>id,category:()=>1}));
 const rail={clientWidth:390,scrollLeft:0,closest:()=>null,
  children:rooms.map((room,i)=>({offsetWidth:390,offsetLeft:i*390})),
  addEventListener:(n,f)=>listeners[n]=f,removeEventListener(){}};
 const scope={data:{authenticated:true,locationsInitialized:true,rooms,filteredRooms:rooms,currentRoomIndex:2,selectedRoomId:'3'},
  $on:(n,f)=>handlers[n]=f,$evalAsync:f=>digests.push(f)};
 const chain={config(){return chain},controller(n,f){ctor=f;return chain}};
 const browser={requestAnimationFrame:f=>{frames.set(++serial,f);return serial},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:true}),removeEventListener(){}};
 vm.runInNewContext(fs.readFileSync('js/pages/locations/lup-locations.js','utf8'),{window:browser,document:{querySelectorAll:()=>[rail]},console:{log(){},warn(){}},angular:{module:()=>chain}});
 const deps={$scope:scope,$timeout:f=>timers.push(f),CategorySrvc:{withCategories:()=>Promise.resolve(),locationGroups:()=>[]},LoadingSrvc:{hasTask:()=>true}};
 ctor(...ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(x=>deps[x.trim()]||{}));
 const flush=q=>{let f=q instanceof Map?[...q.values()]:q.splice(0);if(q instanceof Map)q.clear();f.forEach(fn=>fn())};
 scope.init();flush(timers);
 return {scope,rail,frames,timers,digests,listeners,handlers,flush};
}
test('Reset wins over a pending return-navigation scroll restore',()=>{
 const s=setup();assert.equal(s.rail.scrollLeft,780);
 s.scope.resetCategories();s.flush(s.timers);s.flush(s.frames);
 assert.equal(s.rail.scrollLeft,0);assert.equal(s.scope.data.selectedRoomId,'1');assert.equal(s.scope.data.currentRoomIndex,0);
});
test('Reset wins over a scroll selection already queued for Angular',()=>{
 const s=setup();s.flush(s.frames);s.rail.scrollLeft=390;s.listeners.scroll();s.flush(s.frames);
 assert.equal(s.digests.length,1);s.scope.resetCategories();s.flush(s.digests);s.flush(s.timers);
 assert.equal(s.scope.data.currentRoomIndex,0);assert.equal(s.scope.data.selectedRoomId,'1');assert.equal(s.rail.scrollLeft,0);
});

test('GPS updates preserve the selected card and request no reload',()=>{
 const s=setup();s.flush(s.frames);
 s.scope.loadFirstPage=()=>assert.fail('unexpected first-page request');
 s.scope.loadNextPage=()=>assert.fail('unexpected pagination');
 s.handlers['gwf-position-changed']();
 assert.equal(s.scope.data.selectedRoomId,'3');assert.equal(s.rail.scrollLeft,780);
});
test('Normal scroll selection still updates after reset has settled',()=>{
 const s=setup();s.scope.resetCategories();s.flush(s.timers);s.flush(s.frames);
 s.rail.scrollLeft=390;s.listeners.scroll();s.flush(s.frames);s.flush(s.digests);
 assert.equal(s.scope.data.selectedRoomId,'2');assert.equal(s.scope.data.currentRoomIndex,1);
});
