/* Decorative event reflections. Native scroll and swipe actions own input. */
(function() {
 'use strict';
 angular.module('LUP').directive('lupGlassScroll', function() {
  return {
   restrict:'A',
   link:function(scope, element) {
    var host=element[0], frame=null, destroyed=false;
    var motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    function paint() {
     frame=null;
     if (destroyed || motion.matches) return;
     var scroller=host.querySelector('.md-virtual-repeat-scroller');
     var cards=host.querySelectorAll('.place-event-card');
     var viewport=(scroller || host).getBoundingClientRect();
     // Read all positions before writing styles; only virtualized rows exist.
     var positions=Array.prototype.map.call(cards,function(card) {
      var box=card.getBoundingClientRect();
      return {card:card, offset:motion.matches ? 0 : Math.max(-1,Math.min(1,
       (box.top+box.height/2-viewport.top-viewport.height/2)/Math.max(1,viewport.height/2)))};
     });
     positions.forEach(function(item) {
      item.card.style.setProperty('--glass-x',(item.offset*52).toFixed(2)+'px');
      item.card.style.setProperty('--glass-y',(-item.offset*28).toFixed(2)+'px');
      item.card.style.setProperty('--glass-roll',(item.offset*4).toFixed(2)+'deg');
     });
    }
    function schedule() {
     if (!destroyed && frame===null) frame=window.requestAnimationFrame(paint);
    }
    // Capture is necessary: scroll does not bubble from the virtual scroller.
    host.addEventListener('scroll',schedule,{capture:true,passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    if (motion.addEventListener) motion.addEventListener('change',schedule);
    else motion.addListener(schedule);
    var observer=new MutationObserver(schedule);
    observer.observe(host,{childList:true,subtree:true});
    schedule();
    scope.$on('$destroy',function() {
     destroyed=true;
     host.removeEventListener('scroll',schedule,true);
     window.removeEventListener('resize',schedule);
     if (motion.removeEventListener) motion.removeEventListener('change',schedule);
     else motion.removeListener(schedule);
     observer.disconnect();
     if (frame!==null) window.cancelAnimationFrame(frame);
    });
   }
  };
 });
})();
