"use strict";
/** Purchase personal GPS tolerance in precise one-metre steps. */
angular.module('LUP').service('DistanceSrvc', function($mdDialog, ConfigSrvc, ErrorSrvc, WebsocketSrvc) {
	var DistanceSrvc = this;

	DistanceSrvc.open = function() {
		return $mdDialog.show({
			controller: DistanceDialogController,
			templateUrl: 'js/dialogs/lup-distance-dialog.html?v=' + window.LUP_BUILD,
			parent: angular.element(document.body),
			clickOutsideToClose: false,
		});
	};

	DistanceDialogController.$inject = ['$scope', '$mdDialog'];
	function DistanceDialogController($scope, $mdDialog) {
		$scope.data = {meters: 100, creditsPerKM: ConfigSrvc.toleranceCreditsKM(), buying: false};
		$scope.cancel = function() { $mdDialog.cancel(); };
		$scope.cost = function() {
			var meters = Math.max(1, Math.min(1000, Math.round(Number($scope.data.meters) || 1)));
			// Match the server rule exactly: no fractional Credits and never undercharge.
			return Math.ceil(meters * $scope.data.creditsPerKM / 1000);
		};
		$scope.update = function() {
			$scope.data.meters = Math.max(1, Math.min(1000, Math.round(Number($scope.data.meters) || 1)));
		};
		$scope.buy = function() {
			$scope.update();
			$scope.data.buying = true;
			var request = new GWS_Message().cmd(0x1168).sync().write16($scope.data.meters);
			return WebsocketSrvc.sendBinary(request).then(function(reply) {
				var credits = reply.read32(), boost = reply.readFloat();
				window.GWF_USER.update({user_credits: credits});
				$mdDialog.hide({meters: $scope.data.meters, credits: $scope.cost(), boost: boost});
			}, function(error) {
				$scope.data.buying = false;
				return ErrorSrvc.websocketError(error);
			});
		};
	}

	return DistanceSrvc;
});
