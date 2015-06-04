var apiBasePath = "../../api/v1";
var PAGE_NOT_FOUND_HTML = "/web/pages/examples/404.html";
var DEFAULT_AVATAR = "dist/img/avatar5.png";

var reviewsApp = angular.module('reviewsControllers', []);

reviewsApp.controller('ReviewListCtrl', function ($scope, $http) {
  $http.get(apiBasePath + "/reviews?expand=true").success(function(data, status, headers) {
    $scope.reviews = data;
    $scope.reviewsLength = data.length;
  });

  $scope.getReviewStatusClass = ReviewInterfaceClient.getReviewStatusClass;
});

reviewsApp.controller('ReviewDetailCtrl', function ($scope, $http, $location, $routeParams, $compile) {
  $http.get(apiBasePath + "/reviews/" + $routeParams.review_id + "?expand=true").success(function(data) {
    if (0 === data.length) {
      window.location.href = PAGE_NOT_FOUND_HTML;
      return;
    }

    var review = data;
    $scope.reviewDetail = review;

    for (var i = 0 ; i < review.changes.length; i++) {
      var change = review.changes[i];

      ReviewInterfaceClient.createDiffBoxWithInlineComments(change.id, StringUtils.b64_to_utf8(change.udiff), change.comments)($scope, $compile);
    }

  });

  $scope.id = $routeParams.review_id;
  $scope.getReviewStatusClass = ReviewInterfaceClient.getReviewStatusClass;

});

reviewsApp.controller('UserCtrl', function ($scope, $http) {
  $http.get(apiBasePath + "/identity").success(function(data) {
    $scope.getAvatarPicture = ReviewInterfaceClient.getAvatarPicture;
    $scope.author = data;
  });

});

reviewsApp.controller('CommentPostController', ['$scope', '$http', function ($scope, $http) {
  $scope.submit = function() {
    var commentText = $('#inline-comment-form-clone').find("textarea").val();
    var lineId = $('#inline-comment-form-clone').prev().attr("id");
    var line = parseInt(lineId.substring(lineId.lastIndexOf("_")+1));
    var changeId = lineId.substring(lineId.indexOf("_")+1,lineId.lastIndexOf("_"));

    var newComment = {};
    newComment.text = commentText;
    newComment.review = {'refId': $scope.reviewDetail._id};
    newComment.change = {'refId': changeId, 'line': line};

    $http.post(apiBasePath + "/comments/", newComment).
    success(function(data, status, headers, config) {
      // this callback will be called asynchronously
      // when the response is available

      if (data.comment) {
        $(ReviewInterfaceClient.createInlineCommentBoxString(data.comment._id,data.comment.text, data.comment.author.refId, data.comment.modificationDate))
        .insertAfter('#'+lineId);

        $('#inline-comment-form-clone').remove();
      }

      console.log(status);
    }).
    error(function(data, status, headers, config) {
      // called asynchronously if an error occurs
      // or server returns response with an error status.
      if (data.errors)
        for (var k in data.errors) {
          console.log(data.errors[k].message + " - code:" + data.errors[k].code);
        }
    });

  };
}]);

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
    var self;
    var constr = function () {
        // the constructor
        self = this;
    };

    constr.getReviewStatusClass = function(reviewStatus) {
      if (reviewStatus == 'open') return "fa-circle-o";
      if (reviewStatus == 'rejected') return "fa-times-circle text-red";
      if (reviewStatus == 'accepted') return "fa-check-circle text-green";

      return "";
    };

    constr.getAvatarPicture = function(author) {
      if (!author.avatarPicture) return DEFAULT_AVATAR;

      return "data:image/png;base64," + author.avatarPicture;
    };

    constr.createDiffBoxWithInlineComments = function (diffId, uDiffString, comments) {
      return function (scope, compile) {
        var diffArray = uDiffString.split(/\u21B5/g)||[];

        $("#diff-boxes").append(_createDiffBoxString(diffId, diffArray));

        _registerInlineCommentClickListener(diffId, diffArray)(scope, compile);

        if (comments) {
          for (var i = 0; i < comments.length; i++) {
            var comment = comments[i].comment;
            $(constr.createInlineCommentBoxString(comment._id,comment.text, comment.author.refId, comment.modificationDate)).insertAfter('#diff_'+diffId+'_' + comment.change.line);
          }
        }
      };
    };

    this._insertInlineCommentFormAfterLine = function (diffId, line, scope, compile) {
      return function () {
        $('#inline-comment-form-clone').remove();

        var inlineCommentFormCopy = $('.inline-comment-form').clone();
        inlineCommentFormCopy.attr("id", "inline-comment-form-clone");
        inlineCommentFormCopy.find("textarea").wysihtml5();

        //inlineCommentFormCopy.find("form").attr("ng-controller", "CommentPostController");
        //inlineCommentFormCopy.find("form").attr("ng-submit", "submit()");
        //inlineCommentFormCopy.find("button").first().attr("type", "submit");
        //inlineCommentFormCopy.find("button").first().attr("id", "submit");
        //inlineCommentFormCopy.find("textarea").attr("ng-model", "comment.text");
        inlineCommentFormCopy.insertAfter('#diff_'+diffId+'_' + line);
        inlineCommentFormCopy.show();

        compile(inlineCommentFormCopy)(scope);

        $('#inline-comment-form-cancel').click(function() { $('#inline-comment-form-clone').remove(); });
      };
    };

    this._registerInlineCommentClickListener = function (diffId, diffArray) {
      return function (scope, compile) {
        for (var i = 1; i < diffArray.length -3; i++) {
          $('#diff_'+diffId+'_' + i).click(_insertInlineCommentFormAfterLine(diffId, i, scope, compile));
        }
      };
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
        diffLines += "<div id='diff_"+diffId+"_"+l+"' class='diff"+ mode +"'>"+ diffArray[i + 2] + "</div>";
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

    constr.createInlineCommentBoxString = function (commentId, commentText, author, creationDate) {
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
