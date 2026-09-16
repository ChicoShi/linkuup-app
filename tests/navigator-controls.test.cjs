const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(overrides = {}, browser = {}) {
 let ctor;
 const chain = {config() {return chain;}, controller(name, fn) {ctor = fn; return chain;}};
 const element = {off() {return element;}, on() {return element;}};
 const context = vm.createContext({console: {log() {}}, window: {matchMedia: () => ({matches: true}), ...browser},
  angular: {module: () => chain, element: () => element}});
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/pages/locations/lup-locations.js'), 'utf8'), context);
 const scope = {data: {}, $on() {}};
 const deps = {$scope: scope, $timeout() {}, PositionSrvc: {hasPosition: () => false}, LoadingSrvc: {addTask() {}}};
 const args = ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(x => x.trim());
 Object.assign(deps, overrides);
 ctor(...args.map(x => deps[x] || {}));
 return deps.$scope;
}

test('Short drags glide one card before snap returns; GPS cannot interrupt, moves share one paint', () => {
 const frames=new Map(), timers=new Map(), events={}, classes=new Set(), listeners={};let serial=0,digests=0,writes=0,left=0;
 const request=fn=>{frames.set(++serial,fn);return serial;};
 const later=fn=>{timers.set(++serial,fn);return serial;};later.cancel=id=>timers.delete(id);
 const flush=q=>{const entries=[...q.values()];q.clear();entries.forEach(fn=>fn());};
 const rail={dataset:{},clientWidth:390,scrollWidth:780,style:{},
  closest:()=>true,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},
  addEventListener:(type,fn)=>{listeners[type]=fn;},getBoundingClientRect:()=>({left:0}),
  querySelector:selector=>rail.children.find(c=>selector.includes('"'+c.id+'"')),
  querySelectorAll:()=>rail.children,
  scrollTo({left:next,behavior}){if(behavior==='smooth'){rail.destination=next;}else{left=next;}}
 };
 Object.defineProperty(rail,'scrollLeft',{get:()=>left,set:v=>{left=v;writes++;if(listeners.scroll)listeners.scroll();}});
 rail.children=[1,2].map((id,index)=>({id,offsetWidth:390,style:{setProperty(){}},getAttribute:()=>String(id),getBoundingClientRect:()=>({left:index*390-left})}));
 const jq={length:1,filter(){return jq;},last(){return jq;},get(){return rail;}};
 const gestureContext=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/pages/locations/lup-location-gesture.js'),'utf8'),gestureContext);
 const s={data:{},$on:(name,fn)=>{events[name]=fn;},$evalAsync:fn=>{digests++;fn();}};
 setup({$scope:s,$timeout:later,LoadingSrvc:{removeTask(){}}},
  {jQuery:()=>jq,LupLocationGesture:gestureContext.window.LupLocationGesture,
   requestAnimationFrame:request,cancelAnimationFrame:id=>frames.delete(id),setTimeout:later,clearTimeout:id=>timers.delete(id),matchMedia:()=>({matches:false})});
 s.data.visibleRooms=s.data.rooms=[{id:()=>1},{id:()=>2}];s.data.currentRoom=s.data.rooms[0];s.data.currentRoomIndex=0;
 s.initialiseRail();flush(timers);flush(frames);
 const touch=(x,y=300)=>({touches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){}});
 listeners.touchstart(touch(220));listeners.touchmove(touch(208));listeners.touchmove(touch(202));listeners.touchmove(touch(196));
 assert.equal(writes,0);flush(frames);assert.equal(writes,1);assert.equal(left,24);assert.equal(digests,0);
 events['gwf-position-changed']();assert.equal(left,24);
 listeners.touchend();assert.equal(rail.destination,390);assert.ok(classes.has('location-rail-dragging'));assert.equal(left,24);
 rail.scrollLeft=390;listeners.scrollend();assert.equal(s.data.currentRoomIndex,1);assert.equal(classes.has('location-rail-dragging'),false);
 // Reverse short gesture, cancelled by a second touch, returns to this card.
 listeners.touchstart(touch(220));listeners.touchmove(touch(244));flush(frames);listeners.touchcancel();
 assert.equal(rail.destination,390);rail.scrollLeft=390;listeners.scrollend();assert.equal(s.data.currentRoomIndex,1);
 // Native vertical scrolling never requests the next location.
 listeners.touchstart(touch(220));listeners.touchmove(touch(224,350));listeners.touchend();assert.equal(s.data.currentRoomIndex,1);
});

test('The discovery template has working category, arrow, reset and GPS controls', () => {
 const s = setup();
 assert.equal(s.navigatorCategories.length, 5);
 assert.equal(s.navigatorHasGPS(), false);
 const a = {id: () => 1}, b = {id: () => 2};
 s.data.visibleRooms = [a, b]; s.data.currentRoomIndex = 0;
 s.stepNavigator(1); assert.equal(s.data.currentRoom, b);
 s.stepNavigator(1); assert.equal(s.data.currentRoomIndex, 1);
 s.stepNavigator(-1); assert.equal(s.data.currentRoom, a);
 s.stepNavigator(-1); assert.equal(s.data.currentRoomIndex, 0);
 const calls = [];
 s.selectCategory = ids => calls.push(Array.from(ids));
 s.searchLocation = value => calls.push(value);
 s.data.searchvalue = 'missing'; s.resetNavigator();
 assert.equal(s.data.searchvalue, ''); assert.deepEqual(calls, [[], '']);
});

test('Category filtering and address/name terms combine without accent or word-order failures', () => {
 const s = setup();
 const room = {category: () => 5, name: () => 'Café Élan', city: () => 'Braunschweig',
  street: () => 'Hauptstraße 4', zip: () => '38100', categoryName: () => 'Cafés'};
 s.data.rooms = [room]; s.data.searchvalue = 'BRAUNSCHWEIG elan hauptstrasse';
 s.data.category = ['5']; s.updateVisibleRooms(); assert.equal(s.data.visibleRooms[0], room);
 s.data.category = ['11']; s.updateVisibleRooms(); assert.equal(s.data.visibleRooms.length, 0);
 s.data.category = []; s.data.searchvalue = 'not present'; s.updateVisibleRooms();
 assert.equal(s.data.visibleRooms.length, 0);
});

test('Loading a different category selects its first visible card before any scroll event', () => {
 const s = setup();
 s.data.currentRoom = {id: () => 1}; s.data.currentRoomIndex = 0;
 s.data.category = ['11'];
 const club = {id: () => 2, category: () => 11, name: () => 'Club', city: () => '',
  street: () => '', zip: () => '', categoryName: () => 'Nachtleben'};
 s.gotRooms([club]);
 assert.equal(s.data.currentRoom, club); assert.equal(s.data.currentRoomIndex, 0);
});

test('One route/chat action chooses navigation outside and chat on site, including a range recheck', () => {
 let timer, atPlace = false, routes = 0, joins = 0, prevented = 0;
 const s = setup({$timeout: fn => {timer = fn; return 1;}});
 s.requestLocation = () => { routes++; };
 s.gotoChat = () => { joins++; };
 const room = {id: () => 5, inChatRange: () => atPlace};
 const event = {preventDefault() {prevented++;}, stopPropagation() {}};
 s.routeOrChat(room, event);
 assert.equal(routes, 1); assert.equal(joins, 0); assert.equal(prevented, 0);
 atPlace = true; s.routeOrChat(room, event);
 assert.equal(prevented, 1); assert.equal(routes, 1);
 atPlace = false; timer(); // GPS can change during the short visual response.
 assert.equal(joins, 0);
 atPlace = true; s.routeOrChat(room, event); timer();
 assert.equal(joins, 1); assert.equal(s.data.doorOpeningRoomId, null);
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
