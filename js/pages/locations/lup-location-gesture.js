/* One short deliberate horizontal gesture advances exactly one card. */
(function(root) {
 'use strict';
 function Gesture(){this.cancel();}
 Gesture.prototype.start=function(x,y){this.x=x;this.y=y;this.dx=0;this.axis=null;this.horizontal=false;};
 Gesture.prototype.move=function(x,y){
  if(this.x===null)return false;
  this.dx=x-this.x;var dy=y-this.y;
  if(!this.axis&&Math.max(Math.abs(this.dx),Math.abs(dy))>8)this.axis=Math.abs(this.dx)>Math.abs(dy)?'x':'y';
  this.horizontal=this.axis==='x';return this.horizontal;
 };
 Gesture.prototype.step=function(){return this.horizontal&&Math.abs(this.dx)>=24?(this.dx<0?1:-1):0;};
 Gesture.prototype.end=function(){var dragged=this.horizontal;this.cancel();return dragged;};
 Gesture.prototype.cancel=function(){this.x=null;this.y=null;this.dx=0;this.axis=null;this.horizontal=false;};
 root.LupLocationGesture=Gesture;
})(typeof window==='undefined'?globalThis:window);

/* A shared scene seen through a clear lens. This deliberately does not rely on
 * backdrop-filter:url(SVG), which Safari cannot render consistently. The page
 * and lens sample the SAME vector field, at different magnifications. Text and
 * controls are never cloned, blurred or distorted. No per-frame layout reads. */
(function(root) {
 'use strict';
 function DiscoveryGlass(rail) {
  var surface=rail.closest('.navigator-view').querySelector('md-content.greybg');
  var field=surface.querySelector('.profile-ambient-map');
  var cards=[],frame=0,dead=false,sceneWidth=0;
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 850" preserveAspectRatio="none">'+
   '<defs><linearGradient id="base" x2=".3" y2="1"><stop stop-color="#15243b"/><stop offset="1" stop-color="#101a2b"/></linearGradient>'+
   '<radialGradient id="light"><stop stop-color="#62c7ed" stop-opacity=".17"/><stop offset="1" stop-color="#62c7ed" stop-opacity="0"/></radialGradient></defs>'+
   '<path fill="url(#base)" d="M0 0h400v850H0z"/><ellipse cx="70" cy="490" rx="205" ry="220" fill="url(#light)"/>'+
   '<ellipse cx="400" cy="720" rx="220" ry="210" fill="url(#light)"/>'+
   '<g fill="none" stroke="#93c7e4" stroke-width=".8" stroke-opacity=".19">'+
   '<path d="M-60 420C75 287 150 536 460 260M-70 454C160 343 173 644 470 486M-60 726C160 547 287 829 455 644"/>'+
   '<ellipse cx="135" cy="102" rx="235" ry="105" transform="rotate(-22 135 102)"/></g>'+
   '<g fill="#bceafb"><circle cx="48" cy="385" r="2" opacity=".55"/><circle cx="335" cy="553" r="2.6" opacity=".55"/><circle cx="92" cy="675" r="1.5" opacity=".4"/></g></svg>';
  var image='url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  var world=function() {
   var el=document.createElement('span');el.className='nav-lens-world';el.style.backgroundImage=image;
   var signal=document.createElement('span');signal.className='nav-lens-signal';
   signal.style.animationDelay=-(performance.now()%18000)+'ms';el.appendChild(signal);return el;
  };
  var scenery=world();scenery.classList.add('nav-glass-field');field.appendChild(scenery);
  surface.classList.add('has-discovery-lens');
  this.paint=function() {
   cards.forEach(function(c) {
    var x=c.left-rail.scrollLeft;
    if(x+c.width<0||x>sceneWidth)return;
    // Center is 5.5% larger; the curved 7px edge bends the field more strongly.
    c.layers.forEach(function(layer,i) {
     var scale=i?1.16:1.055;
     layer.style.transform='translate3d('+(-x*scale+(1-scale)*c.width/2).toFixed(2)+'px,'+
      (-c.top*scale+(1-scale)*c.height/2).toFixed(2)+'px,0) scale('+scale+')';
    });
   });
  };
  var self=this;
  var measure=function() {
   frame=0;if(dead)return;
   var origin=field.getBoundingClientRect(),width=surface.clientWidth,height=field.clientHeight;
   sceneWidth=width;
   var elements=Array.prototype.slice.call(rail.querySelectorAll('.nav-place:not(.ng-leave)'));
   var previous=cards.map(function(c){return c.card;});
   previous.forEach(function(card){if(elements.indexOf(card)<0)resize.unobserve(card);});
   // Read once, then write; scroll frames update only transforms on two lenses.
   cards=elements.map(function(card) {
    var r=card.getBoundingClientRect();
    return {card:card,left:r.left-origin.left+rail.scrollLeft,top:r.top-origin.top,width:r.width,height:r.height};
   });
   scenery.style.width=width+'px';scenery.style.height=height+'px';
   cards.forEach(function(c) {
    var lens=c.card.querySelector('.nav-glass-lens');
    if(!lens){
     lens=document.createElement('span');lens.className='nav-glass-lens';lens.setAttribute('aria-hidden','true');
     lens.appendChild(world());var rim=document.createElement('span');rim.className='nav-lens-rim';rim.appendChild(world());lens.appendChild(rim);
     c.card.insertBefore(lens,c.card.firstChild);
    }
    if(previous.indexOf(c.card)<0)resize.observe(c.card);
    c.layers=Array.prototype.slice.call(lens.querySelectorAll('.nav-lens-world'));
    c.layers.forEach(function(layer){layer.style.width=width+'px';layer.style.height=height+'px';});
   });
   self.paint();
  };
  var schedule=function(){if(!frame&&!dead)frame=requestAnimationFrame(measure);};
  var resize=new ResizeObserver(schedule);resize.observe(surface);
  var mutation=new MutationObserver(function(records){
   if(records.some(function(r){return Array.prototype.some.call(Array.from(r.addedNodes).concat(Array.from(r.removedNodes)),function(n){return n.nodeType===1&&(n.matches('.nav-place,.lup-room-slide-outer')||n.querySelector('.nav-place'));});}))schedule();
  });
  mutation.observe(rail,{childList:true,subtree:true});
  schedule();
  this.destroy=function(){
   dead=true;resize.disconnect();mutation.disconnect();cancelAnimationFrame(frame);
   scenery.remove();surface.classList.remove('has-discovery-lens');
   cards.forEach(function(c){var lens=c.card.querySelector('.nav-glass-lens');if(lens)lens.remove();});
  };
 }
 root.LupDiscoveryGlass=DiscoveryGlass;
})(typeof window==='undefined'?globalThis:window);
