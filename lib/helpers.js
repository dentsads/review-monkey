var async       = require('async');
var fs          = require("fs");
var Validator   = require('jsonschema').Validator;

var REVIEW_SCHEMA  = JSON.parse(fs.readFileSync("./lib/model/reviewSchema.json", "utf8"));
var COMMENT_SCHEMA = JSON.parse(fs.readFileSync("./lib/model/commentSchema.json", "utf8"));
var USER_SCHEMA    = JSON.parse(fs.readFileSync("./lib/model/userSchema.json", "utf8"));

var validator = new Validator();

/**
 * This module consitutes an Express.js middleware that is responsible for
 * REST API resource expansions for all JSON GET responses of Reviews and Comments.
 */
module.exports.ExpansionMiddleware = (function () {
    var self;

    var constr = function (reviewDAO, userDAO, commentDAO) {
      this.reviewDAO = reviewDAO;
      this.userDAO = userDAO;
      this.commentDAO = commentDAO;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.EXPAND_REVIEW = function (req, res, next) {
      var review = req.review;

      async.parallel([
        function(callback){ _expandReviewAuthor(review, callback); },
        function(callback){ _expandReviewChangeComments(review, callback); },
        function(callback){ _expandReviewReviewers(review, callback); },
        function(callback){ _expandReviewSubscibers(review, callback); },
        function(callback){ _expandReviewGlobalComments(review, callback); }
      ],
      // callback
      function(err, results) {
        if (err) res.send(err);
        res.json(review);
      });

    };

    constr.prototype.EXPAND_COMMENT = function (req, res, next) {
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

    constr.prototype.EXPAND_REVIEWS = function (req, res, next) {
      var reviews = req.reviews;

      async.each(reviews,
        function(review, callback) {

          async.parallel([
            function(callback){ _expandReviewAuthor(review, callback); },
            // This is still problematic and has to be fixed!
            //function(callback){ _expandReviewChangeComments(review, callback); },
            function(callback){ _expandReviewReviewers(review, callback); },
            function(callback){ _expandReviewSubscibers(review, callback); },
            function(callback){ _expandReviewGlobalComments(review, callback); }
          ],
          // callback
          function(err, results) {
            callback();
          });


        },
        function(err){
          if (err) res.send(err);
          res.json(reviews);
        }

      );

    };

    constr.prototype.EXPAND_COMMENTS = function (req, res, next) {
      var comments = req.comments;

      async.each(comments,
        function(comment, callback) {

          async.parallel([
            function(callback){ _expandCommentAuthor(comment, callback); },
            function(callback){ _expandReview(comment, callback); }
          ],
          // callback
          function(err, results) {
            callback();
          });


        },
        function(err){
          if (err) res.send(err);
          res.json(comments);
        }

      );

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

    var _expandReviewReviewers = function (review, callback) {
      var reviewers = review.reviewers;

      async.each(reviewers,
        function(reviewer, callback) {

          var reviewerId = reviewer.refId.substring(reviewer.refId.lastIndexOf('/')+1);
          self.userDAO.getUser(reviewerId, function(err, fetchedReviewer) {
            if (err) res.send(err);
            delete reviewer.refId;
            reviewer.reviewer  = fetchedReviewer[0];

            callback();
          });

        },
        function(err){
          callback();
        }

      );
    };

    var _expandReviewSubscibers = function (review, callback) {
      var subscribers = review.subscribers;

      async.each(subscribers,
        function(subscriber, callback) {

          var subscriberId = subscriber.refId.substring(subscriber.refId.lastIndexOf('/')+1);
          self.userDAO.getUser(subscriberId, function(err, fetchedSubscriber) {
            if (err) res.send(err);
            delete subscriber.refId;
            subscriber.subscriber  = fetchedSubscriber[0];

            callback();
          });

        },
        function(err){
          callback();
        }

      );
    };

    var _expandReviewGlobalComments = function (review, callback) {
      var comments = review.globalComments;

      async.each(comments,
        function(comment, callback){

          var commentId = comment.refId.substring(comment.refId.lastIndexOf('/')+1);
          self.commentDAO.getComment(commentId, function(err, fetchedComment) {
            if (err) res.send(err);
            delete comment.refId;
            comment.comment  = fetchedComment[0];

            callback();
          });

        },
        function(err){
          callback();
        }
      );
    };

    var _expandReviewChangeComments = function (review, callback) {
      var changes = review.changes;

      async.each(changes,
        function(change, callback) {

          var comments = change.comments;
          async.each(comments,
            function(comment, callback){

              var commentId = comment.refId.substring(comment.refId.lastIndexOf('/')+1);
              self.commentDAO.getComment(commentId, function(err, fetchedComment) {

                if (err) res.send(err);
                delete comment.refId;
                comment.comment  = fetchedComment[0];

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


/**
 * This module consitutes an Express.js middleware that is responsible for
 * REST API PUT and POST validation.
 */
module.exports.ValidationMiddleware = (function () {
    var self;

    var constr = function (reviewDAO, userDAO, commentDAO) {
      this.reviewDAO = reviewDAO;
      this.userDAO = userDAO;
      this.commentDAO = commentDAO;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.VALIDATE_COMMENT = function (req, res, next) {
      var comment = req.body;

      async.parallel([
        function(callback){ _validateHttpRequest(req, res, callback); },
        function(callback){ _validateSyntax(comment, callback); },
        function(callback){ _validateSemantics(comment, callback); }
      ],
      // callback
      function(err, results) {
        if (err) {
         res.status(406).send(err).end();
        } else {
         next();
        }
      });

    };

    var _validateHttpRequest = function (req, res, callback) {
      // Check if content-type is application/json*
      if (!req.is('application/json')) {
        callback(ErrorHandler.createError(1,
          "The content-type header must be set to application/json"), 0);
      } else {
        callback();
      }
    };

    var _validateSyntax = function (comment, callback) {
      // Validate comment json message against schema in commentSchema.json
      var validationResult = validator.validate(comment, COMMENT_SCHEMA);
      if (validationResult.errors.length !== 0) {
        var errorArray = [];
        for (var i = 0 ; i < validationResult.errors.length; i++) {
          var error = validationResult.errors[i];
          errorArray.push({'message': error.property + " " + error.message, 'code': 2});
        }
        callback(ErrorHandler.createErrors(errorArray));
      } else {
        callback();
      }

    };

    var _validateSemantics = function (comment, callback) {
      async.parallel([
        function(callback){
          if (!comment.parentComment) return callback();

          var commentRefId = comment.parentComment.refId.substring(comment.parentComment.refId.lastIndexOf('/')+1);

          self.commentDAO.getComment(commentRefId, function(err, comment) {
            if (0 === comment.length) { callback(ErrorHandler.createError(1,
              "No comment " + comment.parentComment.refId + " could be found!"), 0);
            } else {
              callback();
            }
          });
        },
        function(callback){
          var reviewRefId = comment.review.refId.substring(comment.review.refId.lastIndexOf('/')+1);

          self.reviewDAO.getReview(reviewRefId, function(err, review) {
            if (0 === review.length) { callback(ErrorHandler.createError(1,
              "No review " + comment.review.refId + " could be found!"), 0);
            } else {
              callback();
            }
          });
        }
      ],
      // callback
      function(err, results) {
        callback(err);
      });

    };

    return constr;
})();

/**
 * This module is a boring error handler providing functions to generate
 * error messages in a standardized way.
 */
var ErrorHandler = (function () {
    var constr = function () {
        // the constructor
    };

    //constr.prototype.constructor = constr;

    constr.createError = function (code, message) {
      return {'errors': [{
        'message': message,
        'code': code
      }]};
    };

    constr.createErrors = function (errorArray) {
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

module.exports.ErrorHandler = ErrorHandler;


/**
 * This module provides utility functions.
 */
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