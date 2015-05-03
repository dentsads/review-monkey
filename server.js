// Persistent datastore with automatic loading
var Datastore = require('nedb');
var express = require('express');
var bodyParser = require('body-parser');
var Validator = require('jsonschema').Validator;
var http = require('http');
var fs = require("fs");

var REVIEW_SCHEMA  = JSON.parse(fs.readFileSync("./lib/model/reviewSchema.json", "utf8"));
var COMMENT_SCHEMA = JSON.parse(fs.readFileSync("./lib/model/commentSchema.json", "utf8"));
var USER_SCHEMA    = JSON.parse(fs.readFileSync("./lib/model/userSchema.json", "utf8"));

var validator = new Validator();
var app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

var dbReviews = new Datastore({ filename: './.datastore/reviews.db', autoload: true });
var dbComments = new Datastore({ filename: './.datastore/comments.db', autoload: true });
var dbUsers = new Datastore({ filename: './.datastore/users.db', autoload: true });

var ErrorHandler = (function () {
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

var ReviewValidator = (function () {
    var constr = function () {
        // the constructor
    };

    constr.isValidReviewRequest = function (req, res) {
      // Check if content-type is application/json*
      if (!req.is('application/json')) {
        res.status(406).send(ErrorHandler.createError(1,"The content-type header must be set to application/json")).end();
        return false;
      }

      // Validate request json message against schema in reviewSchema.json
      var validationResult = _validateReviewObject(req.body);
      if (validationResult.errors.length !== 0) {
        var errorArray = [];
        for (var i = 0 ; i < validationResult.errors.length; i++) {
          var error = validationResult.errors[i];
          errorArray.push({'message': error.property + " " + error.message, 'code': 2});
        }
        res.status(406).send(ErrorHandler.createErrors(errorArray)).end();
        return false;
      }

      // If this point is reached, then the request seems to be valid
      return true;
    };

    this._validateReviewObject = function (review) {
      return validator.validate(review, REVIEW_SCHEMA);
    };

    return constr;
})();

var CommentValidator = (function () {
    var constr = function () {
        // the constructor
    };

    constr.isValidCommentRequest = function (req, res) {
      if (!_isHttpRequestValid(req, res)) return false;
      if (!_isSchematicallyValid(req, res)) return false;
      //if (!_isSemanticallyValid(req, res)) return false;

      // If this point is reached, then the request seems to be valid
      return true;
    };

    constr.isSemanticallyValid = function (req, res, callback) {
      var review = req.body;
      console.log("Got response: " + review.author.refId);
      if (review.author)
      dbUsers.find({ _id : review.author.refId}, function(err, user) {
        return callback(err, user);
      });
      /*
      http.get(review.author.refId, function(authorRes) {
        console.log("Got response: " + JSON.stringify(authorRes.body));
        if (authorRes.body == 'undefined') {
          res.status(406).send(ErrorHandler.createError(3,"Could not find user " + review.author.refId)).end();
          return false;
        }
      }).on('error', function(e) {
        res.status(406).send(ErrorHandler.createError(3,"Could not find user " + review.author)).end();
        return false;
        console.log("Got error: " + e.message);
      });
      */
    };

    constr._isSemanticallyValidCallback = function (res) {
      return function (err, user) {
        if (err || user.length == 0) {
          console.log("inside error");
          res.status(406).send(ErrorHandler.createError(3,"Could not find user " + user)).end();
          return false;
        }

        return true;
      };
    };

    this._isSchematicallyValid = function (req, res) {
      // Validate comment json message against schema in commentSchema.json
      var validationResult = _validateCommentObject(req.body);
      if (validationResult.errors.length !== 0) {
        var errorArray = [];
        for (var i = 0 ; i < validationResult.errors.length; i++) {
          var error = validationResult.errors[i];
          errorArray.push({'message': error.property + " " + error.message, 'code': 2});
        }
        res.status(406).send(ErrorHandler.createErrors(errorArray)).end();
        return false;
      }

      return true;
    };

    this._isHttpRequestValid = function (req, res) {
      // Check if content-type is application/json*
      if (!req.is('application/json')) {
        res.status(406).send(ErrorHandler.createError(1,"The content-type header must be set to application/json")).end();
        return false;
      }

      return true;
    };

    this._validateCommentObject = function (comment) {
      return validator.validate(comment, COMMENT_SCHEMA);
    };

    return constr;
})();

var UserValidator = (function () {
    var constr = function () {
        // the constructor
    };

    constr.isValidUserRequest = function (req, res) {
      // Check if content-type is application/json*
      if (!req.is('application/json')) {
        res.status(406).send(ErrorHandler.createError(1,"The content-type header must be set to application/json")).end();
        return false;
      }

      // Validate user json message against schema in commentSchema.json
      var validationResult = _validateUserObject(req.body);
      if (validationResult.errors.length !== 0) {
        var errorArray = [];
        for (var i = 0 ; i < validationResult.errors.length; i++) {
          var error = validationResult.errors[i];
          errorArray.push({'message': error.property + " " + error.message, 'code': 2});
        }
        res.status(406).send(ErrorHandler.createErrors(errorArray)).end();
        return false;
      }

      // If this point is reached, then the request seems to be valid
      return true;
    };

    this._validateUserObject = function (user) {
      return validator.validate(user, USER_SCHEMA);
    };

    return constr;
})();

var ReviewService = (function () {
    var constr = function () {
        // the constructor
    };

    constr.getReview = function () {
      return function (req, res) {
        dbReviews.find({ _id : req.params.review_id}, function(err, review) {
          if (err) res.send(err);
          res.json(review);
        });
      };
    };

    constr.updateReview = function () {
      return function(req, res) {
        if (!ReviewValidator.isValidReviewRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.modificationDate = currentDatetime;

        dbReviews.findOne({ _id : req.params.review_id }, function (err, review) {
      			if (err) res.send(err);
      			review = req.body;
            dbReviews.update({ _id : req.params.review_id }, req.body, {}, function (err, numReplaced) {
      			     if (err) res.send(err);
      			  res.json(review);
      			});
  	     });
      };
    };

    constr.deleteReview = function () {
      return function(req, res) {
        dbReviews.remove({ _id : req.params.review_id }, {}, function (err, numRemoved) {
  			  if (err) res.send(err);
  			    res.json({ message: 'Review successfully deleted!'});
  		  });
  	   };
    };

    constr.getAllReviews = function () {
      return function(req, res) {
        dbReviews.find({}, function (err, reviews) {
    			if (err) res.send(err);
    			res.json(reviews);
    		});
      };
    };

    constr.createReview = function () {
      return function(req, res) {
        if (!ReviewValidator.isValidReviewRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        dbReviews.insert(req.body, function (err, review) {
      		if (err) res.send(err);
      		res.json({ message: 'Review successfully created!', 'review': JSON.stringify(review) });
	      });
      };
    };

    return constr;
})();

var CommentService = (function () {
    var constr = function () {
        // the constructor
    };

    constr.getComment = function () {
      return function (req, res) {
        dbComments.find({ _id : req.params.comment_id}, function(err, comment) {
          if (err) res.send(err);
          res.json(comment);
        });
      };
    };

    constr.updateComment = function () {
      return function(req, res) {
        if (!CommentValidator.isValidCommentRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.modificationDate = currentDatetime;

        dbComments.findOne({ _id : req.params.comment_id }, function (err, comment) {
            if (err) res.send(err);
            comment = req.body;
            dbComments.update({ _id : req.params.comment_id }, req.body, {}, function (err, numReplaced) {
                 if (err) res.send(err);
              res.json(comment);
            });
         });
      };
    };

    constr.deleteComment = function () {
      return function(req, res) {
        dbComments.remove({ _id : req.params.comment_id }, {}, function (err, numRemoved) {
  			  if (err) res.send(err);
  			    res.json({ message: 'Comment successfully deleted!' });
  		  });
  	   };
    };

    constr.getAllComments = function () {
      return function(req, res) {
        dbComments.find({}, function (err, comments) {
          if (err) res.send(err);
          res.json(comments);
        });
      };
    };

    constr.createComment = function () {
      return function(req, res) {
        if (!CommentValidator.isValidCommentRequest(req, res)) return;
        //if (!CommentValidator.isSemanticallyValid(req, res,
        //     CommentValidator._isSemanticallyValidCallback(res))) return;

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        dbComments.insert(req.body, function (err, comment) {
      		if (err) res.send(err);
      		res.json({ message: 'Comment successfully created!', 'comment': JSON.stringify(comment) });
	      });
      };
    };

    return constr;
})();

var UserService = (function () {
    var constr = function () {
        // the constructor
    };

    constr.getUser = function () {
      return function (req, res) {
        dbUsers.find({ _id : req.params.user_id}, function(err, user) {
          if (err) res.send(err);
          res.json(user);
        });
      };
    };

    constr.updateUser = function () {
      return function(req, res) {
        if (!UserValidator.isValidUserRequest(req, res)) return;

        dbUsers.findOne({ _id : req.params.user_id }, function (err, user) {
            if (err) res.send(err);
            user = req.body;
            dbUsers.update({ _id : req.params.user_id }, req.body, {}, function (err, numReplaced) {
                 if (err) res.send(err);
              res.json(user);
            });
         });
      };
    };

    constr.deleteUser = function () {
      return function(req, res) {
        dbUsers.remove({ _id : req.params.user_id }, {}, function (err, numRemoved) {
  			  if (err) res.send(err);
  			    res.json({ message: 'User successfully deleted!' });
  		  });
  	   };
    };

    constr.getAllUsers = function () {
      return function(req, res) {
        dbUsers.find({}, function (err, users) {
          if (err) res.send(err);
          res.json(users);
        });
      };
    };

    constr.createUser = function () {
      return function(req, res) {
        if (!UserValidator.isValidUserRequest(req, res)) return;

        dbUsers.insert(req.body, function (err, user) {
      		if (err) res.send(err);

          if (user.avatarImage)
            saveAvatarImage(user.avatarImage, user.id);

      		res.json({ message: 'User successfully created!', 'user': JSON.stringify(user) });
	      });
      };
    };

    this.saveAvatarImage = function (b64Data, userId) {
      fs.writeFile("./web/dist/img/" + userId + ".png", b64Data, {'encoding': 'base64', 'flags': 'wx'}, function(err) {
        if(err) {
          console.log(err);
        } else {
          console.log("The file was saved as " + "./web/dist/img/" + userId + ".png");
        }
      });
    }

    return constr;
})();

router.get('/', function(req, res) {
   res.json({ message: 'Welcome to the Review Monkey API!' });
});

router.route('/reviews')
    .post(ReviewService.createReview())
    .get(ReviewService.getAllReviews());

router.route('/reviews/:review_id')
    .get(ReviewService.getReview())
    .put(ReviewService.updateReview())
    .delete(ReviewService.deleteReview());

router.route('/comments')
    .post(CommentService.createComment())
    .get(CommentService.getAllComments());

router.route('/comments/:comment_id')
    .get(CommentService.getComment())
    .put(CommentService.updateComment())
    .delete(CommentService.deleteComment());

router.route('/users')
    .post(UserService.createUser())
    .get(UserService.getAllUsers());

router.route('/users/:user_id')
    .get(UserService.getUser())
    .put(UserService.updateUser())
    .delete(UserService.deleteUser());

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api/<version>/
app.use('/api/v1', router);

//app.set('views', __dirname + '/web3');
//app.engine('html', require('ejs').renderFile);

app.set("view options", {layout: false});
app.use(express.static(__dirname + '/web'));

// requests will never reach this route
app.get('/', function (req, res) {
  res.render('index');
})

var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Review Monkey listening at http://%s:%s', host, port);
});
