'use strict';
angular.module('LUP').
service('LoadingSrvc', function($q, $timeout) {
	
	var LoadingSrvc = this;
	
	LoadingSrvc.TASKS = {};
	LoadingSrvc.WATCHDOGS = {};
	LoadingSrvc.MAX_VISIBLE_MS = 8000;

	LoadingSrvc.watchTask = function(task) {
		if (LoadingSrvc.WATCHDOGS[task]) {
			$timeout.cancel(LoadingSrvc.WATCHDOGS[task]);
		}
		// The global spinner is a visual hint, never an application lock. Older
		// optional requests (gallery, third-party widgets, GPS) can stall; they
		// must not cover the entire app forever.
		LoadingSrvc.WATCHDOGS[task] = $timeout(function() {
			console.warn('LoadingSrvc: releasing stalled task', task);
			LoadingSrvc.stopTask(task);
		}, LoadingSrvc.MAX_VISIBLE_MS);
	};

	LoadingSrvc.clearWatchdog = function(task) {
		if (LoadingSrvc.WATCHDOGS[task]) {
			$timeout.cancel(LoadingSrvc.WATCHDOGS[task]);
			delete LoadingSrvc.WATCHDOGS[task];
		}
	};
	
	LoadingSrvc.addTask = function(task) {
		console.log('LoadingSrvc.addTask()', task);
		LoadingSrvc.TASKS[task] = LoadingSrvc.TASKS[task] || 0;
		LoadingSrvc.TASKS[task] += 1;
		LoadingSrvc.watchTask(task);
	};
	
	LoadingSrvc.removeTask = function(task) {
		console.log('LoadingSrvc.removeTask()', task);
		LoadingSrvc.TASKS[task] = LoadingSrvc.TASKS[task] || 0;
		LoadingSrvc.TASKS[task] -= 1;
		if (LoadingSrvc.TASKS[task] < 0) {
			LoadingSrvc.TASKS[task] = 0;
		}
		if (LoadingSrvc.TASKS[task] === 0) {
			LoadingSrvc.clearWatchdog(task);
		}
	};
	
	LoadingSrvc.stopTask = function(task) {
		console.log('LoadingSrvc.stopTask()', task);
		LoadingSrvc.TASKS[task] = 0;
		LoadingSrvc.clearWatchdog(task);
	};
	
	LoadingSrvc.stopTasks = function() {
		console.log('LoadingSrvc.stopTasks()');
		for (var task in LoadingSrvc.WATCHDOGS) {
			LoadingSrvc.clearWatchdog(task);
		}
		LoadingSrvc.TASKS = {};
	};
	
	LoadingSrvc.countTasks = function() {
		var count = 0;
		var tasks = LoadingSrvc.TASKS;
		for (var task in tasks) {
			if (tasks.hasOwnProperty(task)) {
				count += tasks[task];
			}
		}
		return count;
	};
	
	LoadingSrvc.isLoading = function() {
		var result = LoadingSrvc.countTasks() > 0;
		if (result) {
			console.log('LoadingSrvc.isLoading()', LoadingSrvc.TASKS);
		}
		return result;
	};

	return LoadingSrvc;
});
