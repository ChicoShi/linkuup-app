const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({type='member',secret='1-'+ 'b'.repeat(32),network=false,httpError=false}={}){
 let ctor;const calls=[];const config={ws_secret:'1-'+'a'.repeat(32)};
 const context={angular:{module:()=>({service(n,f){ctor=f;}})},window:{LUP_CONFIG:config},console:{log(){}},sprintf:()=>''};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../js/service/lup-auth-service.js','utf8'),context);
 const ws={disconnect(){calls.push('disconnect');},withConnection(){calls.push('connect:'+config.ws_secret);return network?Promise.reject('network'):Promise.resolve();}};
 const req={sendGWF(module,method,data,verb){calls.push(module+'.'+method);if(module==='Login')return httpError?Promise.reject('http'):Promise.resolve({data:{error:'form rejected'}});return Promise.resolve({data:{data:{user:{user_type:type,user_id:type==='member'?'7':'0'},secret}}});}};
 return {s:new ctor({reject:v=>Promise.reject(v)},null,null,ws,null,req),calls,config};
}
test('Login verifies rotated HTTP session before reconnecting; password never sent as a WS frame',async()=>{
 const {s,calls}=setup();const user=JSON.parse(await s.login('qa','synthetic'));
 assert.equal(user.user_type,'member');assert.deepEqual(calls,['Login.Form','Websocket.GetSecret','disconnect','connect:1-'+'b'.repeat(32)]);
});
test('Wrong password or unaccepted cookie cannot reconnect or report a login',async()=>{
 for(const options of [{type:'ghost'},{secret:'1-'+'a'.repeat(32)},{secret:'GDO_like_16_byte'}]){
  const {s,calls}=setup(options);await assert.rejects(s.login('qa','wrong'));assert.equal(calls.includes('disconnect'),false);
 }
});
test('HTTP failure never tries to reconnect',async()=>{const {s,calls}=setup({httpError:true});await assert.rejects(s.login('qa','synthetic'));assert.deepEqual(calls,['Login.Form']);});
test('WS failure after HTTP authentication is not reported as a completed login',async()=>{const {s}=setup({network:true});await assert.rejects(s.login('qa','synthetic'),e=>e==='network');});
test('Confirmed HTTP logout succeeds without waiting for unavailable WS',async()=>{const {s,calls}=setup({type:'ghost',network:true});assert.equal(JSON.parse(await s.logout()).user_type,'ghost');assert.deepEqual(calls,['Login.Logout','Websocket.GetSecret','disconnect']);});
