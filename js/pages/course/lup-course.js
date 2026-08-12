"use strict";
angular.module('LUP').config(function($routeProvider) {
	$routeProvider.when('/course/:id', {
		templateUrl: 'js/pages/course/lup-course.html?v='+window.LUP_BUILD,
		controller: 'CourseCtrl',
		params: {
			authCheck: true,
		},
	});
}).controller('CourseCtrl', function($scope, $routeParams, $interval,
		UserSrvc, CourseSrvc, RoomSrvc, ErrorSrvc) {

	$scope.data.title = 'TITLE_COURSE';
	
	$scope.data.courseUser = GWF_User.ghost();
	$scope.data.course = [];
	$scope.data.courseStats = {places: 0, visits: 0, next: 5, remaining: 5};
	$scope.now = Date.now();

	$scope.visitVisual = function(visit) {
		var category = String(visit.room.category());
		var visuals = {
			'2': {icon:'apartment', class:'course-icon-city'},
			'3': {icon:'local_bar', class:'course-icon-bar'},
			'4': {icon:'sports_bar', class:'course-icon-bar'},
			'5': {icon:'local_cafe', class:'course-icon-cafe'},
			'11': {icon:'nightlife', class:'course-icon-club'},
			'12': {icon:'theater_comedy', class:'course-icon-culture'},
			'13': {icon:'sports_soccer', class:'course-icon-sport'},
			'14': {icon:'restaurant', class:'course-icon-food'},
			'15': {icon:'park', class:'course-icon-outdoors'},
			'16': {icon:'school', class:'course-icon-education'},
			'17': {icon:'account_balance', class:'course-icon-education'},
			'18': {icon:'local_hospital', class:'course-icon-health'},
		};
		return visuals[category] || {icon:'place', class:'course-icon-default'};
	};
	
	$scope.init = function() {
		console.log('CourseCtrl.init()', $routeParams.id);
		if ($scope.data.authenticated) {
			$scope.loadCourses($routeParams.id);
		}
	};
	
	$scope.loadCourses = function(userId) {
		console.log('CourseCtrl.loadCourses()', userId);
		$scope.data.courseUser = GWF_User.ghost();
		$scope.data.course = [];
		UserSrvc.withUser(userId).then($scope.loadedUser);
	};
	
	$scope.loadedUser = function(user) {
		console.log('CourseCtrl.loadedUser()', user);
		$scope.data.courseUser = user;
		CourseSrvc.getCourse(user).then(
				$scope.loadedCourse,
				ErrorSrvc.websocketMaybeJSONError);
	};
	
	$scope.loadedCourse = function(gwsMessage) {
		console.log('CourseCtrl.loadedCourse()', gwsMessage);
		while(gwsMessage.hasMore()) {
			var visit = {
				room: RoomSrvc.getOrCreate(gwsMessage.read32()),
				visit_count: gwsMessage.read32(),
				visit_last: gwsMessage.read32(),
			};
			$scope.data.course.push(visit);
		}
		$scope.updateCourseStats();
	};

	$scope.updateCourseStats = function() {
		var visits = $scope.data.course;
		var total = visits.reduce(function(sum, visit) {
			return sum + Math.max(0, Number(visit.visit_count) || 0);
		}, 0);
		var next = Math.max(5, (Math.floor(total / 5) + 1) * 5);
		$scope.data.courseStats = {
			places: visits.length,
			visits: total,
			next: next,
			remaining: next - total,
		};
	};

	$scope.visitTime = function(timestamp) {
		var seconds = Number(timestamp) || 0;
		if (!seconds) { return 'Zeitpunkt unbekannt'; }
		var minutes = Math.max(0, Math.floor(($scope.now - seconds * 1000) / 60000));
		if (minutes < 1) { return 'gerade eben'; }
		if (minutes < 60) { return 'vor ' + minutes + ' Min.'; }
		var hours = Math.floor(minutes / 60);
		if (hours < 24) { return 'vor ' + hours + ' Std.'; }
		var days = Math.floor(hours / 24);
		if (days === 1) { return 'gestern'; }
		if (days < 14) { return 'vor ' + days + ' Tagen'; }
		return 'vor längerer Zeit';
	};

	var clock = $interval(function() { $scope.now = Date.now(); }, 60000);
	$scope.$on('$destroy', function() { $interval.cancel(clock); });

	$scope.$on('lup-inited', $scope.init);
	$scope.$on('$viewContentLoaded', $scope.init);

});
