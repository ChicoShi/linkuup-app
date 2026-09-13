"use strict";
angular.module('LUP').config(function($routeProvider) {
 $routeProvider.when('/course/:id', {
  templateUrl:'js/pages/course/lup-course.html?v='+window.LUP_BUILD,
  controller:'CourseCtrl', params:{authCheck:true}
 });
}).controller('CourseCtrl', function($scope, $routeParams, $q, UserSrvc, CourseSrvc, RoomSrvc) {
 var initialized=false, destroyed=false, requestSerial=0;
 $scope.data.title='TITLE_COURSE';
 $scope.data.courseUser=null;
 $scope.data.course=[];
 $scope.data.courseLoading=false;
 $scope.data.courseError=false;
 $scope.journeyFilter='all';
 $scope.journeyOrder='frequent';
 $scope.journey=window.LupCourseSummary([]);

 $scope.visitVisual=function(visit) {
  var category=String(visit && visit.room && visit.room.category ? visit.room.category() : '');
  var visuals={
   '2':'apartment', '3':'local_bar', '4':'sports_bar', '5':'local_cafe',
   '11':'nightlife', '12':'theater_comedy', '13':'sports_soccer',
   '14':'restaurant', '15':'park', '16':'school', '17':'account_balance', '18':'local_hospital'
  };
  return visuals[category] || 'place';
 };
 $scope.updateJourney=function() {
  $scope.journey=window.LupCourseSummary($scope.data.course,$scope.journeyFilter,$scope.journeyOrder);
 };
 $scope.selectJourneyFilter=function(filter) {$scope.journeyFilter=filter;$scope.updateJourney();};
 $scope.selectJourneyOrder=function(order) {$scope.journeyOrder=order;$scope.updateJourney();};
 $scope.openJourneyRoom=function(visit) {
  if(visit && visit.room && visit.room.name()) $scope.gotoRoom(visit.room);
 };
 $scope.init=function() {
  if(initialized || !$scope.data.authenticated) return;
  initialized=true;
  $scope.loadCourses();
 };
 $scope.loadCourses=function() {
  var serial=++requestSerial;
  $scope.data.courseLoading=true;
  $scope.data.courseError=false;
  $scope.data.course=[];
  $scope.updateJourney();
  return UserSrvc.withUser($routeParams.id).then(function(user) {
   if(destroyed || serial!==requestSerial) return null;
   $scope.data.courseUser=user;
   return CourseSrvc.getCourse(user);
  }).then(function(message) {
   if(!message || destroyed || serial!==requestSerial) return null;
   var visits=[];
   while(message.LENGTH-message.INDEX>=12) {
    var id=message.read32(), count=message.read32(), last=message.read32();
    if(id>0 && count>0) visits.push({roomId:id,visit_count:count,visit_last:last});
   }
   if(message.hasMore()) throw new Error('Incomplete visit record');
   return $q.all(visits.map(function(visit) {
    return RoomSrvc.withRoom(visit.roomId).then(function(room) {
     visit.room=room;return visit;
    },function() {
     // An unavailable old place must not hide all other permitted visits.
     visit.room=null;return visit;
    });
   }));
  }).then(function(visits) {
   if(destroyed || serial!==requestSerial) return;
   $scope.data.course=visits || [];
   $scope.data.courseLoading=false;
   $scope.updateJourney();
  },function() {
   if(destroyed || serial!==requestSerial) return;
   $scope.data.courseLoading=false;
   $scope.data.courseError=true;
  });
 };
 $scope.$on('$destroy',function(){destroyed=true;requestSerial++;});
 $scope.$on('lup-inited',$scope.init);
 $scope.$on('$viewContentLoaded',$scope.init);
});
