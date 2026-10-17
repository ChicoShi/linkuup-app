const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup() {
  let ctor; const sockets = [], sent = [], events = [];
  const q = {resolve: v => Promise.resolve(v), reject: e => Promise.reject(e), defer() {
    let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;});
    return {promise,resolve,reject};
  }};
  function Message() {return {CMD:0,SYNC:0,cmd(n){this.CMD=n;return this;},sync(){this.SYNC=1;return this;},writeString(){return this;},binaryBuffer(){return this.CMD;}};}
  const context = {angular:{module:()=>({service(n,f){ctor=f;}})},window:{addEventListener(){}},
    LUP_CONFIG:{ws_url:'wss://test/ws/',ws_secret:'test-only'},console:{log(){},error(){}},sprintf:()=>'',
    GWS_Message:Message,GWF_USER:{update(){}},setInterval:()=>1,
    WebSocket:class {constructor(){sockets.push(this);}send(frame){sent.push(frame);}close(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/service/lup-websocket-service.js'),'utf8'),context);
  const service = new ctor(q,{$evalAsync:f=>f(),$broadcast:e=>events.push(e)},
    {showError(){},websocketMaybeJSONError(){}},{addTask(){},stopTask(){}});
  return {service,sockets,sent,events};
}
test('Language and notification frames wait for confirmed authentication', async()=>{
  const {service:s,sockets,sent,events}=setup();
  const connected=s.connect();sockets[0].onopen();
  assert.deepEqual(sent,[1]);
  assert.equal(s.withConnection(),connected);
  assert.equal(s.connect(),connected);
  const language=s.sendBinary({CMD:0x0109,SYNC:0,binaryBuffer:()=>0x0109});
  const notification=s.sendBinary({CMD:0x1143,SYNC:0,binaryBuffer:()=>0x1143});
  assert.deepEqual(sent,[1]);
  s.SYNC_MSGS[1].resolve('{}');
  await Promise.all([connected,language,notification]);
  assert.deepEqual(sent,[1,0x0109,0x1143]);
  assert.equal(events.filter(e=>e==='gws-ws-open').length,1);
});
test('Authentication failure rejects waiting commands without sending them',async()=>{
  const {service:s,sockets,sent,events}=setup();
  const connection=s.connect();sockets[0].onopen();
  const command=s.sendBinary({CMD:0x0109,SYNC:0,binaryBuffer:()=>0x0109});
  const results=Promise.allSettled([connection,command]);
  s.SYNC_MSGS[1].reject('invalid session');
  assert.ok((await results).every(r=>r.status==='rejected'));
  assert.deepEqual(sent,[1]);assert.equal(s.connected(),false);
  assert.equal(events.includes('gws-ws-open'),false);
});
test('Close during authentication rejects the connection and pending commands',async()=>{
  const {service:s,sockets,sent}=setup();
  const connection=s.connect();sockets[0].onopen();
  const command=s.sendBinary({CMD:0x0109,SYNC:0,binaryBuffer:()=>0x0109});
  const results=Promise.allSettled([connection,command]);sockets[0].onclose();
  assert.ok((await results).every(r=>r.status==='rejected'));
  assert.deepEqual(sent,[1]);
});

test('A delayed close from the old socket cannot close the reconnected transport',async()=>{
  const {service:s,sockets}=setup();
  const first=s.connect();sockets[0].onopen();s.SYNC_MSGS[1].resolve('{}');await first;
  sockets[0].onclose();assert.equal(s.connected(),false);
  const next=s.withConnection();sockets[1].onopen();
  sockets[0].onclose();
  assert.equal(s.SOCKET,sockets[1]);
  s.SYNC_MSGS[1].resolve('{}');await next;assert.equal(s.connected(),true);
});

test('Disconnect rejects an outstanding server response instead of keeping the UI pending',async()=>{
  const {service:s,sockets}=setup();
  const ready=s.connect();sockets[0].onopen();s.SYNC_MSGS[1].resolve('{}');await ready;
  const request=s.sendBinary({CMD:0x1103,SYNC:2,binaryBuffer:()=>0x1103});
  const rejected=assert.rejects(request,e=>e==='err_websocket_connection');
  sockets[0].onclose();await rejected;assert.equal(s.connected(),false);
});
