var reviewsApp = angular.module('reviewsApp', ['ngRoute',
  'reviewsControllers']);

  reviewsApp.config(['$routeProvider',
    function($routeProvider) {
      $routeProvider.
        when('/', {
          templateUrl: '../pages/reviews/partials/main.html',
          controller: 'ReviewListCtrl'
        }).
        when('/queries/all', {
          templateUrl: '../pages/reviews/partials/all.html',
          controller: 'ReviewListCtrl'
        }).
        when('/reviews/:review_id', {
          templateUrl: '../pages/reviews/partials/review.html',
          controller: 'ReviewListCtrl'
        }).
        otherwise({
          redirectTo: '/'
        });
    }]);
