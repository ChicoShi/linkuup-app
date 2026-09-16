/* One short deliberate horizontal gesture advances exactly one card. */
(function(root) {
 'use strict';
 function Gesture(){this.cancel();}
 Gesture.prototype.start=function(x,y){this.x=x;this.y=y;this.dx=0;this.axis=null;this.horizontal=false;};
 Gesture.prototype.move=function(x,y){
  if(this.x===null)return false;
  this.dx=x-this.x;var dy=y-this.y;
  if(!this.axis&&Math.max(Math.abs(this.dx),Math.abs(dy))>10)this.axis=Math.abs(this.dx)>Math.abs(dy)?'x':'y';
  this.horizontal=this.axis==='x';return this.horizontal;
 };
 Gesture.prototype.step=function(){return this.horizontal&&Math.abs(this.dx)>=28?(this.dx<0?1:-1):0;};
 Gesture.prototype.end=function(){var dragged=this.horizontal;this.cancel();return dragged;};
 Gesture.prototype.cancel=function(){this.x=null;this.y=null;this.dx=0;this.axis=null;this.horizontal=false;};
 root.LupLocationGesture=Gesture;
})(typeof window==='undefined'?globalThis:window);
