"use strict";
/* Pure presentation of persisted visit counts; no inferred favourites or points. */
function LupCourseSummary(visits, filter, order) {
 var records=(visits || []).filter(function(visit) {
  return Number(visit.roomId)>0 && Number(visit.visit_count)>0;
 });
 var bars=records.filter(function(visit) {
  return visit.room && ['3','4','11'].indexOf(String(visit.room.category()))>=0;
 });
 function byFrequency(a,b) {
  return b.visit_count-a.visit_count || b.visit_last-a.visit_last || a.roomId-b.roomId;
 }
 var frequent=records.slice().sort(byFrequency);
 var frequentBars=bars.slice().sort(byFrequency);
 var items=(filter==='bars' ? bars : records).slice();
 items.sort(order==='recent' ? function(a,b) {
  return b.visit_last-a.visit_last || byFrequency(a,b);
 } : byFrequency);
 return {
  places:records.length,
  visits:records.reduce(function(total,visit){return total+Number(visit.visit_count);},0),
  bars:bars.length,
  items:items,
  featured:frequentBars[0] || frequent[0] || null,
  featuredIsBar:frequentBars.length>0
 };
}
if(typeof window!=='undefined') window.LupCourseSummary=LupCourseSummary;
if(typeof module!=='undefined' && module.exports) module.exports=LupCourseSummary;
