const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/controller/lup-ctrl.js'), 'utf8');
function setup() {
  const requests = [], routes = [];
  const scope = {data:{authenticated:true}, $on(){}};
  vm.runInNewContext(source.slice(source.indexOf('    $scope.gastroNav = null;'), source.indexOf('    $scope.openLocationGastro = function()')), {
    $scope:scope, $q:{when:Promise.resolve.bind(Promise)}, location:{hostname:'app.localhost'},
    angular:{noop(){}}, fetch(){return new Promise((resolve,reject)=>requests.push({resolve,reject}));}
  });
  scope.gotoOperatorApplication=()=>routes.push('application');
  scope.openLocationGastro=()=>routes.push('manage');
  return {scope,requests,routes};
}
function respond(req,venues){req.resolve({ok:true,json:async()=>({venues})});}
test('initial/loading state never routes approved operator to application; success enables management',async()=>{
  const {scope,requests,routes}=setup();
  const pending=scope.openGastroEntry();
  assert.equal(scope.gastroVenuesState,'loading'); scope.openGastroEntry();
  assert.equal(requests.length,1); assert.deepEqual(routes,[]);
  respond(requests[0],[{id:1,name:'Venue'}]); await pending;
  assert.equal(scope.gastroVenuesState,'ready'); scope.openGastroEntry(); assert.deepEqual(routes,['manage']);
});
test('network error offers retry, not application; confirmed empty result permits application',async()=>{
  const {scope,requests,routes}=setup(); const first=scope.openGastroEntry();
  requests[0].reject(new Error('offline')); await first;
  assert.equal(scope.gastroVenuesState,'error'); assert.deepEqual(routes,[]);
  const retry=scope.openGastroEntry(); respond(requests[1],[]); await retry;
  assert.deepEqual(routes,[]); scope.openGastroEntry(); assert.deepEqual(routes,['application']);
});
test('old response cannot overwrite newer result',async()=>{
  const {scope,requests}=setup(); const old=scope.refreshGastroVenues(); const newer=scope.refreshGastroVenues();
  respond(requests[1],[{id:2}]); await newer; respond(requests[0],[]); await old;
  assert.equal(scope.gastroVenuesState,'ready');assert.equal(scope.gastroVenues[0].id,2);
});
test('logout invalidates pending response without claiming absence of approval',async()=>{
  const {scope,requests,routes}=setup(); const pending=scope.refreshGastroVenues();
  scope.data.authenticated=false;await scope.refreshGastroVenues();respond(requests[0],[{id:1}]);await pending;
  assert.equal(scope.gastroVenuesState,'unavailable');scope.openGastroEntry();assert.deepEqual(routes,[]);
});
test('malformed response is an error, not confirmed empty',async()=>{
  const {scope,requests}=setup();const pending=scope.openGastroEntry();respond(requests[0],null);await pending;
  assert.equal(scope.gastroVenuesState,'error');
});
