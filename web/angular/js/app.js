var reviewsApp = angular.module('reviewsApp', ['ngRoute',
  'reviewsControllers']);

  reviewsApp.config(['$routeProvider',
    function($routeProvider) {
      $routeProvider.
        when('/', {
          templateUrl: '../web/pages/reviews/partials/main.html',
          controller: 'ReviewListCtrl'
        }).
        when('/queries/all', {
          templateUrl: '../web/pages/reviews/partials/all.html',
          controller: 'ReviewListCtrl'
        }).
        when('/reviews/:review_id', {
          templateUrl: '../web/pages/reviews/partials/review.html',
          controller: 'ReviewDetailCtrl'
        }).
        otherwise({
          redirectTo: '/web'
        });
    }]);
