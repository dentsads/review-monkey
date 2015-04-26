var apiBasePath = "../../api/v1";
var reviewsApp = angular.module('reviewsControllers', []);

reviewsApp.controller('ReviewListCtrl', function ($scope, $http) {
  $http.get(apiBasePath + "/reviews").success(function(data) {
    $scope.reviews = data;
    $scope.reviewsLength = data.length;
  });

});

reviewsApp.controller('ReviewDetailCtrl', function ($scope, $http, $routeParams) {
  $http.get(apiBasePath + "/reviews/" + $routeParams.review_id).success(function(data) {
    $scope.review = data;
  });

});
