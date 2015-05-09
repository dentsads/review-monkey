var async = require('async');

module.exports.ExpansionMiddleware = (function () {
    var self;

    var constr = function (reviewDao, userDao) {
      this.reviewDAO = reviewDao;
      this.userDAO = userDao;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.EXPAND_REVIEW = function (req, res, next) {
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

    var _expandReviewAuthor = function (review, callback) {
      var authorRefId = review.author.refId;
      var authorId = authorRefId.substring(authorRefId.lastIndexOf('/')+1);

      self.userDAO.getUser(authorId, function(err, author) {
        if (err) res.send(err);
        review.author = author[0];
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
