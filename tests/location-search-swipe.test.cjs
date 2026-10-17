const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm');
function setup(){
 let ctor;const events={},win={},listeners={},frames=[];
 const rail={clientWidth:390,scrollLeft:0,children:[0,1,2].map(i=>({offsetLeft:i*390,offsetWidth:390})),closest:()=>null,classList:{add(){},remove(){}},addEventListener:(k,v)=>listeners[k]=v,removeEventListener(){}};
 const scope={data:{authenticated:true,locationsInitialized:true},$on:(k,v)=>events[k]=v,$evalAsync:f=>f()};
 const chain={config(){return this},controller(n,f){ctor=f;return this}};
 const pending=[];const room=id=>({id:()=>id,category:()=>3});scope.data.rooms=[room(1),room(2),room(3)];scope.data.filteredRooms=scope.data.rooms;
 vm.runInNewContext(fs.readFileSync('js/pages/locations/lup-locations.js','utf8'),{console,angular:{module:()=>chain},document:{querySelectorAll:()=>[rail]},window:{requestAnimationFrame:f=>(frames.push(f),frames.length),cancelAnimationFrame(){},matchMedia:()=>({matches:true}),addEventListener:(k,f)=>win[k]=f,removeEventListener:k=>delete win[k]}});
 const deps={$scope:scope,$timeout:f=>f(),CategorySrvc:{withCategories:()=>Promise.resolve(),locationGroups:()=>[]},RoomSrvc:{searchRooms:q=>new Promise((resolve,reject)=>pending.push({q,resolve,reject}))},LoadingSrvc:{hasTask:()=>false}};
 const args=ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(s=>s.trim());ctor(...args.map(k=>deps[k]||{}));
 return {scope,events,win,listeners,rail,frames,pending,room};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('Search ignores stale replies, preserves nearby rooms, and recovers after failure',async()=>{
 const {scope:s,pending,room}=setup();s.data.locationQuery='Braun';s.searchLocations();s.data.locationQuery='Peine';s.searchLocations();pending[1].resolve([room(20)]);await settle();pending[0].resolve([room(10)]);await settle();assert.equal(s.data.filteredRooms[0].id(),20);assert.equal(s.data.rooms.length,3);
 s.clearLocationSearch();assert.equal(s.data.filteredRooms.length,3);assert.equal(s.data.searchActive,false);
 s.data.locationQuery='x';s.searchLocations();pending[2].reject(Error());await settle();assert.equal(s.data.searchError,true);s.clearLocationSearch();assert.equal(s.data.searchError,false);
});
test('Card follows horizontal drag before release and settles exactly one card',()=>{
 const x=setup();x.events['$viewContentLoaded']();
 while(x.frames.length)x.frames.shift()(0);
 const ev=(cx,cy=100)=>({isPrimary:true,pointerType:'touch',clientX:cx,clientY:cy,target:{closest:()=>null},preventDefault(){}});
 x.listeners.pointerdown(ev(250));x.win.pointermove(ev(180));assert.equal(x.rail.scrollLeft,70);
 x.win.pointerup(ev(180));while(x.frames.length)x.frames.shift()(1000);assert.equal(x.rail.scrollLeft,390);assert.equal(x.scope.data.currentRoomIndex,1);
});

test('Online/action button swipe navigates without clicking; tap and keyboard still activate',()=>{
 const x=setup();x.events['$viewContentLoaded']();while(x.frames.length)x.frames.shift()(0);
 const ev=(cx)=>({isPrimary:true,pointerType:'touch',clientX:cx,clientY:100,target:{closest:s=>s.includes('button')?{}:null},preventDefault(){}});
 x.listeners.pointerdown(ev(250));assert.ok(x.win.pointermove);
 x.win.pointermove(ev(180));x.win.pointerup(ev(180));while(x.frames.length)x.frames.shift()(1000);
 assert.equal(x.scope.data.currentRoomIndex,1);
 let blocked=0;const click={detail:1,preventDefault(){blocked++},stopImmediatePropagation(){blocked++}};
 x.listeners.click({...click,detail:0});assert.equal(blocked,0);
 x.listeners.click(click);assert.equal(blocked,2);
 blocked=0;x.listeners.pointerdown(ev(200));x.win.pointerup(ev(200));x.listeners.click(click);assert.equal(blocked,0);
});
test('Editable controls never start carousel gestures',()=>{
 const x=setup();x.events['$viewContentLoaded']();while(x.frames.length)x.frames.shift()(0);
 x.listeners.pointerdown({isPrimary:true,pointerType:'touch',target:{closest:()=>({})}});
 assert.equal(x.win.pointermove,undefined);
});
