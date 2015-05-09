var async = require('async');
var fs    = require("fs");

module.exports.ExpansionMiddleware = (function () {
    var self;

    var constr = function (reviewDao, userDao) {
      this.reviewDAO = reviewDao;
      this.userDAO = userDao;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.EXPAND_REVIEWS = function (req, res, next) {
      var review = req.review;

      async.parallel([
        function(callback){ _expandReviewAuthor(review, callback); },
        function(callback){ _expandReviewChangeComment(review, callback); }
      ],
      // callback
      function(err, results) {
        if (err) res.send(err);
        res.json(review);
      });

    };

    constr.prototype.EXPAND_COMMENTS = function (req, res, next) {
      var comment = req.comment;

      async.parallel([
        function(callback){ _expandCommentAuthor(comment, callback); },
        function(callback){ _expandReview(comment, callback); }
      ],
      // callback
      function(err, results) {
        if (err) res.send(err);
        res.json(comment);
      });

    };

    var _expandReviewAuthor = function (review, callback) {
      var authorRefId = review.author.refId;
      var authorId = authorRefId.substring(authorRefId.lastIndexOf('/')+1);

      self.userDAO.getUser(authorId, function(err, fetchedAuthor) {
        if (err) res.send(err);
        review.author = fetchedAuthor[0];
        callback();
      });
    };

    var _expandCommentAuthor = function (comment, callback) {
      var authorRefId = comment.author.refId;
      var authorId = authorRefId.substring(authorRefId.lastIndexOf('/')+1);

      self.userDAO.getUser(authorId, function(err, fetchedAuthor) {
        if (err) res.send(err);
        comment.author = fetchedAuthor[0];
        callback();
      });
    };

    var _expandReview = function (comment, callback) {
      var reviewRefId = comment.review.refId;
      var reviewId = reviewRefId.substring(reviewRefId.lastIndexOf('/')+1);

      self.reviewDAO.getReview(reviewId, function(err, fetchedReview) {
        if (err) res.send(err);
        comment.review = fetchedReview[0];
        callback();
      });
    };

    var _expandReviewChangeComment = function (review, callback) {
      var changes = review.changes;

      async.each(changes,
        function(change, callback) {

          async.each(change.comments,
            function(comment, callback){

              var commentId = comment.refId.substring(comment.refId.lastIndexOf('/')+1);
              self.userDAO.getUser("2", function(err, author) {
                if (err) res.send(err);
                delete comment.refId;
                comment.comment  = author[0];
                //res.json(review);
                callback();
              });

            },
            function(err){
              callback();
            }
          );

        },
        function(err){
          callback();
        }

      );
    };

    return constr;
})();

module.exports.ErrorHandler = (function () {
    var constr = function () {
        // the constructor
    };

    constr.prototype.constructor = constr;

    constr.prototype.createError = function (code, message) {
      return {'errors': [{
        'message': message,
        'code': code
      }]};
    };

    constr.prototype.createErrors = function (errorArray) {
      if (!errorArray) throw new Error("errorArray must not be empty");

      var errors = [];
      for(var i = 0 ; i < errorArray.length; i++){
        var error = errorArray[i];
        if (!error.message) throw new Error("error.message must not be empty");
        if (!error.code) throw new Error("error.code must not be empty");

        errors.push({
          'message': error.message,
          'code': error.code
        });
      }

      return {'errors': errors};
    };

    return constr;
})();

module.exports.Utils = (function () {
    var constr = function () {
        // the constructor
    };

    constr.prototype.constructor = constr;

    constr.prototype.saveB64AvatarImage = function (b64Data, filePath) {
      fs.writeFile(filePath, b64Data, {'encoding': 'base64', 'flags': 'wx'}, function(err) {
        if(err) {
          console.log(err);
        } else {
          console.log("The file was saved as " + filePath);
        }
      });
    }

    return constr;
})();
