var apiBasePath = "../../api/v1";
var reviewsApp = angular.module('reviewsControllers', []);

reviewsApp.controller('ReviewListCtrl', function ($scope, $http) {
  $http.get(apiBasePath + "/reviews?expand=true").success(function(data) {
    $scope.reviews = data;
    $scope.reviewsLength = data.length;
  });

});

reviewsApp.controller('ReviewDetailCtrl', function ($scope, $http, $location, $routeParams) {
  $http.get(apiBasePath + "/reviews/" + $routeParams.review_id + "?expand=true").success(function(data) {
    if (0 === data.length) {
      window.location.href = '/web/pages/examples/404.html';
      return;
    }

    var review = data;
    $scope.reviewDetail = review;

    for (var i = 0 ; i < review.changes.length; i++) {
      var change = review.changes[i];

      ReviewInterfaceClient.createDiffBoxWithInlineComments(i, StringUtils.b64_to_utf8(change.udiff), change.comments);
    }

  });

  $scope.id = $routeParams.review_id;
  $scope.getReviewStatusClass = ReviewInterfaceClient.getReviewStatusClass;

});

var StringUtils = (function () {
    var constr = function () {
        // the constructor
    };

    constr.utf8_to_b64 = function (str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    };

    constr.b64_to_utf8 = function (str) {
        return decodeURIComponent(escape(window.atob(str)));
    };

    return constr;
})();

var ReviewInterfaceClient = (function () {
    var constr = function () {
        // the constructor
    };

    constr.getReviewStatusClass = function(reviewStatus) {
      if (reviewStatus == 'open') return "fa-circle-o";
      if (reviewStatus == 'rejected') return "fa-times-circle text-red";
      if (reviewStatus == 'accepted') return "fa-check-circle text-green";

      return "";
    };

    constr.createDiffBoxWithInlineComments = function (diffId, uDiffString, comments) {
      var diffArray = uDiffString.split(/\u21B5/g)||[];

      $("#diff-boxes").append(_createDiffBoxString(diffId, diffArray));

      _registerInlineCommentClickListener(diffId, diffArray);

      if (comments) {
        for (var i = 0; i < comments.length; i++) {
          var comment = comments[i].comment;
          $(_createInlineCommentBoxString(comment._id,comment.text, comment.author.refId, comment.modificationDate)).insertAfter('#diff'+diffId+'-' + comment.change.line);
        }
      }
    };

    this._insertInlineCommentFormAfterLine = function (diffId, line) {
      return function () {
        $('.inline-comment-form').hide();
        $('.inline-comment-form-textarea').val('');
        $('.inline-comment-form').insertAfter('#diff'+diffId+'-' + line);
        $('.inline-comment-form').show();
      };
    };

    this._registerInlineCommentClickListener = function (diffId, diffArray) {
      for (var i = 1; i < diffArray.length -3; i++) {
        $('#diff'+diffId+'-' + i).click(_insertInlineCommentFormAfterLine(diffId, i));
      }
    };

    this._createDiffBoxString = function (diffId, diffArray) {
      var diffLines = "";

      for (var i = 1; i < diffArray.length -3; i++) {
        var mode = "";
        if (diffArray[i+2].startsWith("-"))
          mode = "1";
        if (diffArray[i+2].startsWith("+"))
          mode = "2";
        var l = i -1;
        diffLines += "<div id='diff"+diffId+"-"+l+"' class='diff"+ mode +"'>"+ diffArray[i + 2] + "</div>";
      }

      return "<div class='row'> \
              <div class='col-md-12'> \
              <div class='box'> \
              <div class='box-header with-border'> \
              <h3 class='box-title'>"+ diffArray[0] +"</h3> \
              </div> \
              <div class='box-body'> \
              <div class='diff-div'> \
              <div> \
              "+diffLines+" \
              </div> \
              </div> \
              </div> \
              </div> \
              </div> \
              </div>";

    };

    this._createInlineCommentBoxString = function (commentId, commentText, author, creationDate) {
        return '<div id="inline-comment-'+commentId+'" class="box"> \
                <div class="box-header with-border"> \
                <span><b>'+author+'</b> added a note at '+creationDate+'</span> \
                <div class="box-tools pull-right"> \
                <button class="btn btn-box-tool" data-widget="collapse"><i class="fa fa-pencil"></i></button> \
                <button class="btn btn-box-tool" data-widget="remove"><i class="fa fa-times"></i></button> \
                </div> \
                </div><!-- /.box-header --> \
                <div class="box-body"> \
                '+commentText+' \
                </div> \
                </div><!-- /.box -->';
    };

    return constr;
})();
