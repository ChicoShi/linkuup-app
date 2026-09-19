const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(withViewport=true){
 const events={},style={},classes={},frames=[];
 const viewport={height:844,offsetTop:0,scale:1,addEventListener(n,f){events['viewport:'+n]=f}};
 const doc={activeElement:null,documentElement:{style:{setProperty(k,v){style[k]=v}},classList:{toggle(k,v){classes[k]=v}}},addEventListener(n,f){events['document:'+n]=f}};
 const win={innerHeight:844,innerWidth:390,visualViewport:withViewport?viewport:null,requestAnimationFrame(fn){frames.push(fn);return frames.length},addEventListener(n,f){events[n]=f}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/util/lup-viewport.js'),'utf8'),{window:win,document:doc});
 const flush=()=>{while(frames.length)frames.shift()()};flush();return{win,doc,viewport,events,style,classes,frames,flush};
}
test('Keyboard resize and Safari pan share one paint; pinch zoom does not reflow the chat',()=>{
 const x=setup();x.doc.activeElement={matches:()=>true};x.viewport.height=410.5;x.viewport.offsetTop=37.25;
 x.events['viewport:resize']();x.events['viewport:scroll']();assert.equal(x.frames.length,1);x.flush();
 assert.equal(x.style['--lup-viewport-height'],'410.5px');assert.equal(x.style['--lup-viewport-top'],'37.25px');assert.equal(x.classes['lup-soft-keyboard-open'],true);
 x.viewport.scale=2;x.viewport.height=200;x.events['viewport:resize']();x.flush();assert.equal(x.style['--lup-viewport-height'],'410.5px');
 x.viewport.scale=1;x.viewport.height=844;x.viewport.offsetTop=0;x.doc.activeElement=null;x.events['viewport:resize']();x.flush();assert.equal(x.classes['lup-soft-keyboard-open'],false);
});
test('Android layout resize and browsers without VisualViewport retain a visible composer',()=>{
 const x=setup(false);x.doc.activeElement={matches:()=>true};x.win.innerHeight=390;x.events.resize();x.flush();assert.equal(x.style['--lup-viewport-height'],'390px');assert.equal(x.classes['lup-soft-keyboard-open'],true);
 x.win.innerWidth=844;x.win.innerHeight=390;x.events.orientationchange();x.flush();assert.equal(x.classes['lup-soft-keyboard-open'],false);
});
test('Send preserves an active composer focus; other forms and disabled actions keep normal focus handling',()=>{
 const x=setup(),form={},button={form,disabled:false};let prevented=0;x.doc.activeElement={form,matches:()=>true};
 const event={target:{closest:()=>button},preventDefault(){prevented++}};
 x.events['document:pointerdown'](event);assert.equal(prevented,1);
 button.disabled=true;x.events['document:pointerdown'](event);assert.equal(prevented,1);
 button.disabled=false;button.form={};x.events['document:pointerdown'](event);assert.equal(prevented,1);
});
