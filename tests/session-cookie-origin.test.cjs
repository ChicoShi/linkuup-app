const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/controller/lup-ctrl.js'),'utf8');
const code=source.match(/\$scope\.setCookie = function\(cookie, name\) \{[\s\S]*?\n\t\};/)[0];
function writes(server){const result=[];const context={$scope:{},URL,window:{location:{href:'http://app.localhost/#!/login',origin:'http://app.localhost'}},LUP_CONFIG:{server,server_domain:'app.localhost'},document:{set cookie(v){result.push(v)}}};vm.runInNewContext(code,context);context.$scope.setCookie('synthetic-session','GDO');return result;}
test('same-origin bootstrap removes legacy domain cookie without rewriting the HTTP session',()=>{assert.deepEqual(writes('/backend/'),['GDO=; Max-Age=0; path=/; domain=app.localhost']);});
test('separate backend origin retains existing cross-origin bootstrap behaviour',()=>{assert.deepEqual(writes('https://backend.example.test/'),['GDO=synthetic-session; path=/; domain=app.localhost']);});
