const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let constructor;
const config = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'config/lup-app-config.example.js'), 'utf8'), config);
assert.equal(config.LUP_CONFIG.positionPatch, null);
const env = {
  angular: {module: () => ({service: (_, fn) => {constructor = fn;}})},
  window: {LUP_DEBUG_POSITION: [51.2, 10.4], LUP_CONFIG: {positionInterval: null}},
  console: {log() {}, error() {}},
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/service/lup-position-service.js'), 'utf8'), env);
const service = new constructor({}, {$broadcast() {}}, {}, {});
assert.equal(service.CURRENT.state.val, service.UNKNOWN, 'Legacy global cannot silently simulate GPS');
service.setReal(50, 10);
assert.equal(service.CURRENT.state.val, service.KNOWN);
assert.equal(service.CURRENT.lat, 50);
service.startPatching(51.2, 10.4);
assert.equal(service.CURRENT.state.val, service.PATCHED);
assert.equal(service.CURRENT.lat, 51.2);
service.setReal(49, 9);
assert.equal(service.CURRENT.lat, 51.2, 'Explicit patch remains distinct from actual GPS');
service.stopPatching();
assert.equal(service.CURRENT.state.val, service.KNOWN);
assert.equal(service.CURRENT.lat, 49, 'Disabling patch restores actual GPS');
console.log('OK: safe example default, no legacy override, explicit patch and actual GPS restoration');
