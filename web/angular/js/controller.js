var v1Api_reviewsPath = "../../api/v1/reviews";
var reviewsApp = angular.module('reviewsApp', []);

reviewsApp.controller('ReviewListCtrl', function ($scope, $http) {
  $scope.phones = [
    {'name': 'Nexus S',
     'snippet': 'Fast just got faster with Nexus S.'},
    {'name': 'Motorola XOOM™ with Wi-Fi',
     'snippet': 'The Next, Next Generation tablet.'},
    {'name': 'MOTOROLA XOOM™',
     'snippet': 'The Next, Next Generation tablet.'}
  ];

  $http.get(v1Api_reviewsPath).success(function(data) {
    $scope.reviews = data;
    $scope.reviewsLength = data.length;
  });

});
