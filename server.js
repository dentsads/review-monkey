// Persistent datastore with automatic loading
var Datastore = require('nedb');
var express = require('express');
var bodyParser = require('body-parser');
var Validator = require('jsonschema').Validator;
var fs = require("fs");

var REVIEW_SCHEMA = JSON.parse(fs.readFileSync("./lib/model/reviewSchema.json", "utf8"));

var validator = new Validator();
var app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

var dbReview = new Datastore({ filename: './.datastore/reviews.db', autoload: true });
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

var ReviewService = (function () {
    var constr = function () {
        // the constructor
    };

    constr.getReview = function () {
      return function (req, res) {
        dbReview.find({ _id : req.params.review_id}, function(err, review) {
          if (err) res.send(err);
          res.json(review);
        });
      };
    };

    constr.updateReview = function () {
      return function(req, res) {
        if (!ReviewValidator.isValidReviewRequest(req, res)) return;

        dbReview.findOne({ _id : req.params.review_id }, function (err, review) {
      			if (err) res.send(err);
      			review = req.body;
            dbReview.update({ _id : req.params.review_id }, req.body, {}, function (err, numReplaced) {
      			     if (err) res.send(err);
      			  res.json(review);
      			});
  	     });
      };
    };

    constr.deleteReview = function () {
      return function(req, res) {
        dbReview.remove({ _id : req.params.review_id }, {}, function (err, numRemoved) {
  			  if (err) res.send(err);
  			    res.json({ message: 'Review successfully deleted!', 'review': JSON.stringify(review) });
  		  });
  	   };
    };

    constr.getAllReviews = function () {
      return function(req, res) {
        dbReview.find({}, function (err, reviews) {
    			if (err) res.send(err);
    			res.json(reviews);
    		});
      };
    };

    constr.createReview = function () {
      return function(req, res) {
        if (!ReviewValidator.isValidReviewRequest(req, res)) return;

        dbReview.insert(req.body, function (err, review) {
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

    constr.getReview = function () {
      return function (req, res) {
        dbComments.find({ _id : req.params.review_id}, function(err, review) {
          if (err) res.send(err);
          res.json(review);
        });
      };
    };

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
