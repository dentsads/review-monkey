// Required dependencies
var async         = require('async');
var fs            = require("fs");
var Validator     = require('jsonschema').Validator;
var passport      = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var REVIEW_SCHEMA  = JSON.parse(fs.readFileSync("./lib/model/reviewSchema_PUTPOST.json", "utf8"));
var COMMENT_SCHEMA = JSON.parse(fs.readFileSync("./lib/model/commentSchema_PUTPOST.json", "utf8"));
var USER_SCHEMA    = JSON.parse(fs.readFileSync("./lib/model/userSchema_PUTPOST.json", "utf8"));

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
        function(callback){ _expandReviewSubscribers(review, callback); },
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
            function(callback){ _expandReviewChangeComments(review, callback); },
            function(callback){ _expandReviewReviewers(review, callback); },
            function(callback){ _expandReviewSubscribers(review, callback); },
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
        var obfuscatedUser = fetchedAuthor[0];
        delete obfuscatedUser.password;

        review.author = obfuscatedUser;
        callback();
      });
    };

    var _expandCommentAuthor = function (comment, callback) {
      var authorRefId = comment.author.refId;
      var authorId = authorRefId.substring(authorRefId.lastIndexOf('/')+1);

      self.userDAO.getUser(authorId, function(err, fetchedAuthor) {
        if (err) res.send(err);
        var obfuscatedUser = fetchedAuthor[0];
        delete obfuscatedUser.password;

        comment.author = obfuscatedUser;
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
      var reviewers = review.reviewers || {};

      async.each(reviewers,
        function(reviewer, callback) {

          var reviewerId = reviewer.refId.substring(reviewer.refId.lastIndexOf('/')+1);
          self.userDAO.getUser(reviewerId, function(err, fetchedReviewer) {
            if (err) res.send(err);
            delete reviewer.refId;
            var obfuscatedUser = fetchedReviewer[0];
            delete obfuscatedUser.password;

            reviewer.reviewer  = obfuscatedUser;

            callback();
          });

        },
        function(err){
          callback();
        }

      );
    };

    var _expandReviewSubscribers = function (review, callback) {
      var subscribers = review.subscribers || {};

      async.each(subscribers,
        function(subscriber, callback) {

          var subscriberId = subscriber.refId.substring(subscriber.refId.lastIndexOf('/')+1);
          self.userDAO.getUser(subscriberId, function(err, fetchedSubscriber) {
            if (err) res.send(err);
            delete subscriber.refId;
            var obfuscatedUser = fetchedSubscriber[0];
            delete obfuscatedUser.password;

            subscriber.subscriber  = obfuscatedUser;

            callback();
          });

        },
        function(err){
          callback();
        }

      );
    };

    var _expandReviewGlobalComments = function (review, callback) {
      var comments = review.globalComments || {};

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

          var comments = change.comments || {};
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

      async.series([
        function(callback){ _validateHttpRequest(req, res, callback); },
        function(callback){ _validateSyntax(comment, COMMENT_SCHEMA, callback); },
        function(callback){ _validateCommentSemantics(comment, callback); }
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

    constr.prototype.VALIDATE_REVIEW = function (req, res, next) {
      var review = req.body;

      async.series([
        function(callback){ _validateHttpRequest(req, res, callback); },
        function(callback){ _validateSyntax(review, REVIEW_SCHEMA, callback); },
        function(callback){ _validateReviewSemantics(review, callback); }
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

    constr.prototype.VALIDATE_USER = function (req, res, next) {
      var user = req.body;

      async.series([
        function(callback){ _validateHttpRequest(req, res, callback); },
        function(callback){ _validateSyntax(user, USER_SCHEMA, callback); }
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

    var _validateSyntax = function (data, schema, callback) {
      // Validate comment json message against schema
      var validationResult = validator.validate(data, schema);
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

    var _validateCommentSemantics = function (comment, callback) {
      async.series([
        function(callback){
          if (!comment.parentComment) return callback();

          var commentRefId = comment.parentComment.refId.substring(comment.parentComment.refId.lastIndexOf('/')+1);

          self.commentDAO.getComment(commentRefId, function(err, fetchedComment) {
            if (0 === fetchedComment.length) {
              callback(ErrorHandler.createError(1,
              "No comment " + comment.parentComment.refId + " could be found!"), 0);
            } else {
              callback();
            }
          });
        },
        function(callback){
          var reviewRefId = comment.review.refId.substring(comment.review.refId.lastIndexOf('/')+1);

          self.reviewDAO.getReview(reviewRefId, function(err, review) {
            if (0 === review.length) {
              callback(ErrorHandler.createError(1,
              "No review " + comment.review.refId + " could be found!"), 0);
            } else {
              callback();
            }
          });
        },
        function(callback){
          if (!comment.change) return callback();

          var changeRefId = comment.change.refId;
          var changeLine = comment.change.line;

          var reviewRefId = comment.review.refId.substring(comment.review.refId.lastIndexOf('/')+1);

          self.reviewDAO.getReview(reviewRefId, function(err, review) {
            var changeArray = review[0].changes;

            for(var i = 0 ; i < changeArray.length; i++){
              var change = changeArray[i];

              if (change.id === changeRefId) {
                if (!change.lineCount || change.lineCount < changeLine || changeLine < 1) {
                  return callback(ErrorHandler.createError(1,
                    "The comment line number "+ changeLine +" of this comment exceeds " +
                    "the total number of lines "+ change.lineCount +" of change " + changeRefId), 0);
                    continue;
                }

                if (!comment.parentComment) return callback();

                if (change.comments)
                for(var i = 0 ; i < change.comments.length; i++){
                  var changeComment = change.comments[i];

                  var changeCommentRefId = changeComment.refId.substring(changeComment.refId.lastIndexOf('/')+1);
                  var parentCommentRefId = comment.parentComment.refId.substring(comment.parentComment.refId.lastIndexOf('/')+1);


                  if (changeCommentRefId === parentCommentRefId)
                    return callback();
                }

                return callback(ErrorHandler.createError(1,
                  "The change with id "+ comment.change.refId + " of review "+ comment.review.refId +" must contain"
                  + " the parent comment " + comment.parentComment.refId + ", but it doesn\'t"), 0);

              }
            }

            callback(ErrorHandler.createError(1,
              "Change "+ changeRefId +" could not be found in review " + comment.review.refId), 0);
          });

        }
      ],
      // callback
      function(err, results) {
        callback(err);
      });

    };

    var _validateReviewSemantics = function (review, callback) {
      async.series([
        function(callback){
          if (!review.reviewers) return callback();

          async.each(review.reviewers,
            function(reviewer, callback){

              var reviewerId = reviewer.refId.substring(reviewer.refId.lastIndexOf('/')+1);
              self.userDAO.getUser(reviewerId, function(err, fetchedReviewer) {
                if (0 === fetchedReviewer.length) { callback(ErrorHandler.createError(1,
                  "No reviewer " + reviewer.refId + " could be found!"), 0);
                } else {
                  callback();
                }
              });

            },
            function(err){
              callback(err);
            }
          );
        },
        function(callback){
          if (!review.subscribers) return callback();

          async.each(review.subscribers,
            function(subscriber, callback){

              var subscriberId = subscriber.refId.substring(subscriber.refId.lastIndexOf('/')+1);
              self.userDAO.getUser(subscriberId, function(err, fetchedSubscriber) {
                if (0 === fetchedSubscriber.length) { callback(ErrorHandler.createError(1,
                  "No subscriber " + subscriber.refId + " could be found!"), 0);
                } else {
                  callback();
                }
              });

            },
            function(err){
              callback(err);
            }
          );
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
 * This module handles all authentication matters of 'passport'.
 */
module.exports.Authenticator = (function () {
    var self;

    var constr = function (userDbService) {
      this.dbservice = userDbService;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.passport = function () {
      passport.use(new LocalStrategy(
        function(username, password, done) {
          self.dbservice.find({ username: username }, function (err, user) {
            if (err) { return done(err); }

            if (0 === user.length) {
              return done(null, false, { message: 'Incorrect username.' });
            }
            if (1 < user.length) {
              return done(null, false, { message: 'Ambiguous username.' });
            }
            if (user[0].password !== password) {
              return done(null, false, { message: 'Incorrect password.' });
            }

            return done(null, user[0]);
          });
        }
      ));

      passport.serializeUser(function(user, done) {
        done(null, user._id);
      });

      passport.deserializeUser(function(id, done) {
        self.dbservice.findOne({ _id : id }, function(err, user) {
          done(err, user);
        });
      });

      return passport;
    };

    constr.prototype.securityRedirect = function(loginPath) {
      return function (req, res, next){
        //if (req.session.passport.user === undefined) {
        if (!req.isAuthenticated() && req.path !== loginPath) {
          req.session.redirectUrl = req.originalUrl;
          res.redirect(loginPath);
        } else {
          next();
        }
      };
    }

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

    // This function makes some risky assumptions about the input structure
    constr.prototype.getUdiffLineCount = function (b64Udiff) {
      var uDiffString = new Buffer(b64Udiff, 'base64').toString('utf8');
      var diffArray = uDiffString.split(/\u21B5/g)||[];

      return diffArray.length -5;
    }

    return constr;
})();

module.exports.ErrorHandler = ErrorHandler;
