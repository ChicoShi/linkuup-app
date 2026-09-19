const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(overrides = {}, browser = {}) {
 let ctor;
 const chain = {config() {return chain;}, controller(name, fn) {ctor = fn; return chain;}};
 const element = {off() {return element;}, on() {return element;}};
 const context = vm.createContext({console: {log() {}, warn() {}}, window: {matchMedia: () => ({matches: true}), ...browser},
  angular: {module: () => chain, element: () => element}});
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/pages/locations/lup-locations.js'), 'utf8'), context);
 const scope = {data: {}, $on() {}};
 const deps = {$scope: scope, $timeout() {}, PositionSrvc: {hasPosition: () => false}, LoadingSrvc: {addTask() {}},
  RoomSrvc: {hasMoreRooms: () => false}, CategorySrvc: {
   withCategories: () => ({then: ready => ready()}),
   locationGroups: () => [{ids: ['5'], label: 'NAV_CAFE'}, {ids: ['11'], label: 'NAV_NIGHT'}]
  }};
 const args = ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(x => x.trim());
 Object.assign(deps, overrides);
 ctor(...args.map(x => deps[x] || {}));
 return deps.$scope;
}

function resetFixture(hasGPS = true) {
 const room = (id, distance, category = 5) => ({id: () => id, distance: () => distance,
  category: () => category, name: () => 'Ort ' + id, city: () => '', street: () => '',
  zip: () => '', categoryName: () => ''});
 const near = room(11, 50), far = room(22, 800), distant = room(33, 90000, 11);
 const requests = [], events = {}, timers = new Map(), frames = new Map();
 let serial = 0, now = 0;
 const later = (fn, ms = 0) => {timers.set(++serial, {fn, at: now + ms}); return serial;};
 later.cancel = id => timers.delete(id);
 const advance = ms => {
  const end = now + ms;
  for (let count = 0; count < 100; count++) {
   const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
   if (!next) break;
   timers.delete(next[0]); now = next[1].at; next[1].fn();
  }
  now = end;
 };
 const paint = () => {const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn());};
 const rail = {classList: {add() {}, remove() {}}, scrollLeft: 900,
  scrollTo({left}) {this.scrollLeft = left;}, querySelector: () => null};
 const jq = {length: 1, filter() {return jq;}, last() {return jq;}, get: () => rail, addClass() {}};
 const rooms = {hasMoreRooms: () => false, sortDistance: (a,b) => a.distance() - b.distance(), withRooms() {
  return new Promise((resolve, reject) => requests.push({resolve, reject}));
 }};
 const scope = setup({$scope: {data: {authenticated: true}, $on: (name, fn) => {
  const previous = events[name];
  events[name] = (...args) => {if (previous) previous(...args); fn(...args);};
 }},
  $timeout: later, RoomSrvc: rooms, PositionSrvc: {hasPosition: () => hasGPS},
  HelpSrvc: {showHelp() {}}, $translate: {instant: () => ''},
  LoadingSrvc: {addTask() {}, removeTask() {}, stopTask() {}}},
  {jQuery: () => jq, requestAnimationFrame: fn => {frames.set(++serial, fn); return serial;},
   cancelAnimationFrame: id => frames.delete(id), clearTimeout() {}});
 scope.initialiseRail = () => {};
 scope.data.rooms = scope.data.visibleRooms = [near, far];
 scope.data.currentRoom = far; scope.data.currentRoomIndex = 1;
 return {scope, near, far, distant, requests, events, rail, advance, paint, roomService: rooms};
}

test('First GPS result selects the nearest room; later refresh preserves a deliberate selection', () => {
 const {scope: s, near, far} = resetFixture();
 s.gotRooms([near, far]);
 assert.equal(s.data.currentRoom, near);
 assert.equal(s.data.currentRoomIndex, 0);
 s.focusRoom(1);
 s.gotRooms([near, far]);
 assert.equal(s.data.currentRoom, far);
 assert.equal(s.data.currentRoomIndex, 1);
});

test('Reset leaves the discovery catalogue and selects the first backend-ordered nearby result', async () => {
 const {scope: s, near, far, distant, requests, rail, advance, paint} = resetFixture();
 const catalogue = [distant, far, near];
 s.data.rooms = s.data.fullCatalogue = catalogue;
 s.data.visibleRooms = [distant]; s.data.currentRoom = distant;
 s.data.category = ['11'];
 const result = s.resetNavigator();
 assert.deepEqual(Array.from(s.data.category), []);
 assert.equal(requests.length, 1);
 const nearby = [near, far];
 requests[0].resolve(nearby); await result;
 advance(0); paint(); paint(); advance(200);
 assert.equal(s.data.rooms, nearby);
 assert.equal(s.data.currentRoom, near);
 assert.equal(s.data.currentRoomIndex, 0);
 assert.equal(rail.scrollLeft, 0);
 assert.equal(s.data.fullCatalogue, catalogue);
});

test('Repeated reset responses arriving out of order cannot undo the latest reset', async () => {
 const {scope: s, near, far, requests} = resetFixture();
 const old = s.resetNavigator(), latest = s.resetNavigator();
 requests[1].resolve([near, far]); await latest;
 requests[0].resolve([far, near]); await old;
 assert.equal(s.data.currentRoom, near);
 assert.deepEqual(Array.from(s.data.rooms), [near, far]);
});

test('A pending next catalogue page cannot replace the nearby list after reset', async () => {
 const {scope: s, near, far, distant, requests, roomService} = resetFixture();
 const catalogue = s.data.rooms = s.data.fullCatalogue = [distant, far, near];
 s.updateVisibleRooms();
 let resolvePage;
 const page = new Promise(resolve => {resolvePage = resolve;});
 roomService.hasMoreRooms = () => true;
 roomService.loadMoreRooms = () => page;
 s.loadMoreLocations();
 const reset = s.resetNavigator();
 const nearby = [near, far];
 requests[0].resolve(nearby); await reset;
 resolvePage(catalogue); await page; await Promise.resolve();
 assert.equal(s.data.rooms, nearby);
 assert.equal(s.data.currentRoom, near);
 assert.equal(s.data.loadingMoreLocations, false);
});

for (const action of ['category', 'search', 'swipe', 'destroy']) {
 test('Late reset response respects a subsequent ' + action, async () => {
  const {scope: s, near, far, distant, requests, events} = resetFixture();
  s.data.fullCatalogue = [near, far, distant];
  const result = s.resetNavigator();
  if (action === 'category') s.selectCategory(['11']);
  if (action === 'search') {s.data.searchvalue = '33'; s.searchLocation('33');}
  if (action === 'swipe') s.focusRoom(1);
  if (action === 'destroy') events.$destroy();
  const selected = s.data.currentRoom, rooms = s.data.rooms;
  requests[0].resolve([near]); await result;
  assert.equal(s.data.currentRoom, selected);
  assert.equal(s.data.rooms, rooms);
 });
}

test('No GPS resets the filter locally without issuing a nearby query', () => {
 const {scope: s, near, requests} = resetFixture(false);
 s.resetNavigator();
 assert.equal(requests.length, 0);
 assert.equal(s.data.currentRoom, near);
});

test('A failed reset keeps the available cards and can be retried', async () => {
 const {scope: s, near, far, requests} = resetFixture();
 const failed = s.resetNavigator(); requests[0].reject(new Error('offline')); await failed;
 assert.equal(s.data.currentRoom, near);
 const retry = s.resetNavigator(); requests[1].resolve([far]); await retry;
 assert.equal(s.data.currentRoom, far);
});

test('An old scheduled room restore cannot pull the rail away after reset finishes painting', () => {
 const {scope: s, near, far, events, advance, paint} = resetFixture(false);
 s.init(); advance(20);
 events['lup-rooms-resorted']({}, far.id());
 s.resetNavigator(); advance(0); paint(); paint(); advance(80);
 assert.equal(s.data.currentRoom, near);
 assert.equal(s.data.currentRoomIndex, 0);
});

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
 // A scroll callback from the old filtered list cannot undo a reset.
 s.selectCategory=()=>{};s.searchLocation=()=>{};
 s.resetNavigator();listeners.scroll();flush(frames);
 assert.equal(s.data.currentRoomIndex,0);
 flush(timers);flush(frames);flush(frames);
 assert.equal(left,0);assert.equal(s.data.currentRoomIndex,0);
 assert.equal(classes.has('location-rail-dragging'),false);
});

test('The discovery template uses backend categories and has working arrow, reset and GPS controls', () => {
 const s = setup();
 assert.deepEqual(s.navigatorCategories.map(group => group.ids), [['5'], ['11']]);
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
 s.data.currentRoom = b; s.data.currentRoomIndex = 1;
 s.data.searchvalue = 'missing'; s.resetNavigator();
 assert.equal(s.data.searchvalue, ''); assert.deepEqual(calls, [[], '']);
 assert.equal(s.data.currentRoom, a); assert.equal(s.data.currentRoomIndex, 0);
});

test('Repeated reset taps replace feedback; reduced motion and leaving the page stop it', () => {
 let reduced=false;const callbacks={},animations=[];
 const scope={data:{},$on:(name,fn)=>{(callbacks[name] ||= []).push(fn);}};
 const s=setup({$scope:scope},{matchMedia:()=>({matches:reduced})});
 s.selectCategory=()=>{};s.searchLocation=()=>{};
 const landmark={animate(){const a={cancelled:false,cancel(){this.cancelled=true;}};animations.push(a);return a;}};
 const button={querySelector:()=>landmark,parentElement:{querySelectorAll:()=>Array(5).fill(landmark)}};
 s.resetNavigator({currentTarget:button});assert.equal(animations.length,7);
 s.resetNavigator({currentTarget:button});assert.equal(animations.length,14);
 assert.ok(animations.slice(0,7).every(a=>a.cancelled));
 assert.equal(animations.filter(a=>!a.cancelled).length,7);
 reduced=true;s.resetNavigator({currentTarget:button});assert.ok(animations.every(a=>a.cancelled));
 assert.equal(animations.length,14);assert.equal(s.data.currentRoom,null);
 reduced=false;s.resetNavigator({currentTarget:button});callbacks['$destroy'].forEach(fn=>fn());
 assert.ok(animations.every(a=>a.cancelled));
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
