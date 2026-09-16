const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup(overrides = {}) {
 let ctor;
 const chain = {config() {return chain;}, controller(name, fn) {ctor = fn; return chain;}};
 const element = {off() {return element;}, on() {return element;}};
 const context = vm.createContext({console: {log() {}}, window: {matchMedia: () => ({matches: true})},
  angular: {module: () => chain, element: () => element}});
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/pages/locations/lup-locations.js'), 'utf8'), context);
 const scope = {data: {}, $on() {}};
 const deps = {$scope: scope, $timeout() {}, PositionSrvc: {hasPosition: () => false}, LoadingSrvc: {addTask() {}}};
 const args = ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(x => x.trim());
 Object.assign(deps, overrides);
 ctor(...args.map(x => deps[x] || {}));
 return scope;
}

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
