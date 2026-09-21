const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(){
 let ctor,connectionResolve,connectionReject;
 const handlers={},sent=[];
 const connection=new Promise((resolve,reject)=>{connectionResolve=resolve;connectionReject=reject;});
 const q={resolve:Promise.resolve.bind(Promise),reject:Promise.reject.bind(Promise),defer(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}};
 class Message{cmd(n){this.command=n;return this;}write32(n){this.room=n;return this;}writeFloat(){return this;}writeString(){return this;}}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/service/lup-chat-service.js'),'utf8'),{
  angular:{module:()=>({service(n,f){ctor=f;}})},console:{log(){}},window:{GWF_POSITION:{lat:52,lng:10}},GWS_Message:Message
 });
 const socket={withConnection:()=>connection,sendBinary:m=>{sent.push(m);return Promise.resolve();}};
 const chat=new ctor({$on:(n,f)=>{handlers[n]=f;},$broadcast(){}},q,{},socket,{},{},{});
 return {chat,handlers,sent,connectionResolve,connectionReject};
}
test('Returning to the same room waits for auth and sends a fresh join after disconnect',async()=>{
 const x=setup(),room={id:()=>42};x.chat.CHATROOM=room;
 x.handlers['gws-ws-disconnect']();assert.equal(x.chat.CHATROOM,null);
 const join=x.chat.join(room);assert.equal(x.sent.length,0);
 x.connectionResolve();await join;
 assert.equal(x.sent.length,1);assert.equal(x.sent[0].command,0x1103);assert.equal(x.sent[0].room,42);
});
test('Failed reconnect rejects join without faking membership',async()=>{
 const x=setup(),room={id:()=>42};
 const join=x.chat.join(room),rejected=assert.rejects(join,e=>e==='auth denied');
 x.connectionReject('auth denied');await rejected;
 assert.equal(x.sent.length,0);assert.equal(x.chat.CHATROOM,null);
});
test('A connected same-room request stays idempotent',async()=>{
 const x=setup(),room={id:()=>42};x.chat.CHATROOM=room;x.connectionResolve();
 await x.chat.join(room);assert.equal(x.sent.length,0);
});
