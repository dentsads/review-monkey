// Persistent datastore with automatic loading
var Datastore = require('nedb');
// Express web framework
var express = require('express');
var bodyParser = require('body-parser');
var Validator = require('jsonschema').Validator;

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

var ReviewValidator = (function () {
    var constr = function () {
        // the constructor
    };

    constr.isValidReviewRequest = function (req, res) {
      if (!req.is('application/json')) {
        res.status(406).send(_createError(1,"The content-type header must be set to application/json")).end();
        return false;
      }
      if (!_isValidReviewObject(req.body)) {
        res.status(406).send(_createError(2,"The review message structure in the request body is invalid!")).end();
        return false;
      }
    };

    this._isValidReviewObject = function (review) {
      if (!review) return false;
      if (!review.message) return false;
      if (!review.creationDate) return false;
      if (!review.modificationDate) return false;

      return true;
    };

    this._createError = function (code, message) {
      return {error: {
        'message': message,
        'code': code
      }};
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
   res.json({ message: 'hooray! welcome to our api!' });
});

router.route('/reviews')
    .post(ReviewService.createReview())
    .get(ReviewService.getAllReviews());

router.route('/reviews/:review_id')
    .get(ReviewService.getReview())
    .put(ReviewService.updateReview())
    .delete(ReviewService.deleteReview());

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
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
