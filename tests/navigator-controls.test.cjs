const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(overrides = {}, browser = {}) {
 let ctor,serial=0;
 const events={},listeners={},timers=[],frames=new Map();
 const rail={clientWidth:390,scrollWidth:1170,scrollLeft:0,closest:()=>null,
  children:[0,1,2].map(i=>({offsetWidth:390,offsetLeft:i*390})),
  classList:{add(){},remove(){}},addEventListener:(n,f)=>listeners[n]=f,removeEventListener(){}};
 const chain={config(){return chain;},controller(name,fn){ctor=fn;return chain;}};
 const scope={data:{authenticated:true,locationsInitialized:true},$on:(n,f)=>events[n]=f,$evalAsync:f=>f()};
 const room=(id,cat=1)=>({id:()=>id,category:()=>cat});
 scope.data.rooms=scope.data.filteredRooms=[room(1),room(2),room(3)];
 const context=vm.createContext({console:{log(){},warn(){}},document:{querySelectorAll:()=>[rail]},
  window:{matchMedia:()=>({matches:true}),requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id),removeEventListener(){},...browser},
  angular:{module:()=>chain}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/pages/locations/lup-locations.js'),'utf8'),context);
 const deps={$scope:scope,$timeout:f=>timers.push(f),PositionSrvc:{hasPosition:()=>false},
  CategorySrvc:{withCategories:()=>Promise.resolve(),locationGroups:()=>[]},LoadingSrvc:{hasTask:()=>true},...overrides};
 ctor(...ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(x=>deps[x.trim()]||{}));
 const flush=()=>{timers.splice(0).forEach(f=>f());for(let rounds=0;frames.size&&rounds<10;rounds++){const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(1000));}};
 return {s:deps.$scope,room,events,listeners,rail,flush};
}
const settle=()=>new Promise(r=>setImmediate(r));

test('Keyboard browsing stays within the rail and requests another page only at its end',()=>{
 const {s,listeners,rail,flush}=setup();let next=0,prevented=0;s.loadNextPage=()=>next++;
 s.init();flush();
 const key=(key,target=rail)=>listeners.keydown({key,target,preventDefault(){prevented++;}});
 key('ArrowRight',{});flush();assert.equal(s.data.currentRoomIndex,0);assert.equal(prevented,0);
 key('ArrowLeft');flush();assert.equal(rail.scrollLeft,0);
 key('ArrowRight');flush();assert.equal(s.data.currentRoomIndex,1);assert.equal(rail.scrollLeft,390);
 key('ArrowRight');flush();assert.equal(s.data.currentRoomIndex,2);assert.equal(rail.scrollLeft,780);
 const before=next;key('ArrowRight');flush();assert.equal(s.data.currentRoomIndex,2);assert.equal(next,before+1);
});

test('Navigator categories come from available backend groups and retry after load failure',async()=>{
 let calls=0;const groups=[{ids:[],label:'empty'},{ids:[5],label:'Cafe'}];
 const {s}=setup({CategorySrvc:{withCategories:()=>++calls===1?Promise.reject(Error('offline')):Promise.resolve(),locationGroups:()=>groups}});
 s.loadCategories();await settle();assert.equal(s.data.navigatorCategories.length,0);
 s.loadCategories();await settle();assert.equal(s.data.navigatorCategories.length,1);assert.equal(s.data.navigatorCategories[0],groups[1]);
 s.loadCategories();assert.equal(calls,2);
});

test('Reset clears category selection, cancels old feedback, and respects reduced motion and teardown',()=>{
 let reduced=false;const animations=[];const {s,events}=setup({}, {matchMedia:()=>({matches:reduced})});
 const landmark={animate(){const a={cancelled:false,cancel(){this.cancelled=true;}};animations.push(a);return a;}};
 const button={querySelector:()=>landmark,closest:()=>({querySelectorAll:()=>Array(5).fill(landmark)})};
 s.data.categoryIds=['5'];s.resetCategories({currentTarget:button});assert.equal(s.data.categoryIds.length,0);assert.equal(animations.length,7);
 s.resetCategories({currentTarget:button});assert.equal(animations.length,14);assert.ok(animations.slice(0,7).every(a=>a.cancelled));
 reduced=true;s.resetCategories({currentTarget:button});assert.ok(animations.every(a=>a.cancelled));assert.equal(animations.length,14);
 reduced=false;s.resetCategories({currentTarget:button});events['$destroy']();assert.ok(animations.every(a=>a.cancelled));
});

test('Category selection filters current search results without changing nearby data or fetching pages',async()=>{
 const {s}=setup({LoadingSrvc:{hasTask:()=>false},RoomSrvc:{searchRooms:()=>Promise.resolve([roomResult(9,5),roomResult(10,11)]),loadRoomsPage:()=>assert.fail('search must not request nearby pages')}});
 function roomResult(id,category){return {id:()=>id,category:()=>category};}
 s.data.locationQuery='Café';s.searchLocations();await settle();
 s.selectCategory([5]);assert.deepEqual(Array.from(s.data.filteredRooms,r=>r.id()),[9]);assert.equal(s.data.rooms.length,3);assert.equal(s.data.selectedRoomId,'9');
 s.selectCategory([5]);assert.equal(s.data.filteredRooms.length,2);assert.equal(s.isCategoryActive([]),true);
 s.clearLocationSearch();assert.equal(s.data.filteredRooms.length,3);assert.equal(s.data.searchActive,false);
});

test('Selecting another category resets to its first matching card and can request more matches',()=>{
 const {s,room}=setup();s.data.rooms=[room(1,5),room(2,11),room(3,11)];let minimum;
 s.loadNextPage=n=>minimum=n;s.data.currentRoomIndex=2;s.data.selectedRoomId='3';s.selectCategory([11]);
 assert.equal(s.data.currentRoomIndex,0);assert.equal(s.data.selectedRoomId,'2');assert.equal(minimum,10);assert.equal(s.isCategoryActive(['11']),true);
 s.resetCategories();assert.equal(s.data.selectedRoomId,'1');assert.equal(s.data.filteredRooms.length,3);
});

test('Opening a room preserves return selection; map route and chat remain separate range-aware controls',()=>{
 const {s}=setup();let opened;const room=s.data.filteredRooms[1];s.gotoRoom=r=>opened=r;s.openRoom(room);
 assert.equal(opened,room);assert.equal(s.data.currentRoomIndex,1);assert.equal(s.data.selectedRoomId,'2');
 const mapRoom={lat:()=>52.27,lng:()=>10.53,street:()=>'',zip:()=>'',city:()=>''};
 assert.ok(s.mapsHref(mapRoom).endsWith('destination=52.27%2C10.53'));
 const html=fs.readFileSync(path.join(__dirname,'../js/pages/locations/lup-locations.html'),'utf8');
 assert.match(html,/ng-if="room.inChatRange\(\)" ng-click="gotoChat\(room\)"/);
 assert.match(html,/ng-if="!room.inChatRange\(\)" ng-href="\{\{mapsHref\(room\)\}\}"/);
});

test('Presence shows up to 20 faces but keeps the real total, animates changes and cleans up', () => {
 let directive, update, destroy, stopped = false, reduced = false, cancelled = 0;
 const animations = [];
 const angular = {module: () => ({directive(name, factory) { if (name === 'lupPresence') directive = factory(); }})};
 const context = vm.createContext({angular, window: {matchMedia: () => ({get matches() {return reduced;}})}});
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/directives/lup-avatar.js'), 'utf8'), context);
 const s = {$watchCollection(get, callback) { update = callback; return () => {stopped = true;}; },
  $on(name, callback) {destroy = callback;}};
 const element = [{querySelector: () => ({animate(frames) {animations.push(frames);return {cancel() {cancelled++;}};}})}];
 directive.link(s, element);
 const users = n => Array.from({length: n}, (_,i) => ({id: () => i + 1}));
 update(users(8));
 assert.equal(s.faces.length, 8); assert.equal(s.stackStyle['--presence-overlap'], '0');
 assert.equal(animations.length, 0); // Initial room payload is not an arrival.
 update(users(9)); assert.equal(animations.length, 1);
 assert.ok(Number(s.stackStyle['--presence-overlap']) > 0);
 update(users(20)); assert.equal(s.faces.length, 20);
 assert.equal(s.stackStyle['--presence-overlap'], '0.45');
 update(users(103)); assert.equal(s.faces.length, 20); assert.equal(s.count, 103);
 const before = animations.length; update(users(103)); assert.equal(animations.length, before);
 reduced = true; update(users(102)); assert.equal(animations.length, before);
 update([]); assert.equal(s.count, 0); assert.equal(s.faces.length, 0);
 destroy(); assert.equal(stopped, true); assert.ok(cancelled > 0);
});

test('Presence keeps identity on refresh, retires only departed faces and cancels a pop on re-entry', () => {
 let directive, update, destroy, next = 0; const timers = new Map();
 const later = fn => {const id=++next;timers.set(id, () => {timers.delete(id);fn();}); return id;}; later.cancel = id => timers.delete(id);
 const angular = {module: () => ({directive(name, factory) {if (name === 'lupPresence') directive = factory({}, later);}})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/directives/lup-avatar.js'), 'utf8'),
  {angular, window: {matchMedia: () => ({matches: false})}});
 const scope = {ngRoom: {id: () => 1}, $watchCollection(get, cb) {update = cb;return () => {};}, $on(name, cb) {destroy = cb;}};
 directive.link(scope, [{querySelector: () => null}]);
 const user = id => ({id: () => id});
 update([user(1), user(2), user(3)]); const original = scope.renderedFaces.slice();
 update([user(1), user(2), user(3)]);
 assert.ok(scope.renderedFaces.every((face, i) => face === original[i])); assert.equal(timers.size, 0);
 update([user(1), user(3)]);
 assert.equal(scope.count, 2); assert.equal(original[1].leaving, true); assert.equal(timers.size, 1);
 update([user(1), user(2), user(3)]);
 assert.equal(original[1].leaving, false); assert.equal(timers.size, 0);
 update([user(1), user(3)]); const finish = [...timers.values()][0]; finish();
 assert.deepEqual(Array.from(scope.renderedFaces, face => face.key), ['1', '3']);
 update([user(1)]); scope.ngRoom = {id: () => 2}; update([user(4)]);
 assert.equal(timers.size, 0); assert.deepEqual(Array.from(scope.renderedFaces, face => face.key), ['4']);
 destroy(); assert.equal(timers.size, 0);
});
