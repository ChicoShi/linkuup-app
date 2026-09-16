const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup() {
 let ctor;
 const chain = {config() {return chain;}, controller(name, fn) {ctor = fn; return chain;}};
 const element = {off() {return element;}, on() {return element;}};
 const context = vm.createContext({console: {log() {}}, window: {matchMedia: () => ({matches: true})},
  angular: {module: () => chain, element: () => element}});
 vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/pages/locations/lup-locations.js'), 'utf8'), context);
 const scope = {data: {}, $on() {}};
 const deps = {$scope: scope, $timeout() {}, PositionSrvc: {hasPosition: () => false}, LoadingSrvc: {addTask() {}}};
 const args = ctor.toString().match(/function\(([^)]*)\)/)[1].split(',').map(x => x.trim());
 ctor(...args.map(x => deps[x] || {}));
 return scope;
}

test('The discovery template has working category, arrow, reset and GPS controls', () => {
 const s = setup();
 assert.equal(s.navigatorCategories.length, 6);
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
