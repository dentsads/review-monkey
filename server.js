// Required modules
var Datastore   = require('nedb');
var express     = require('express');
var bodyParser  = require('body-parser');
var Validator   = require('jsonschema').Validator;
var http        = require('http');
var async       = require("async");
var fs          = require("fs");
var helpers     = require('./lib/helpers');

var REVIEW_SCHEMA  = JSON.parse(fs.readFileSync("./lib/model/reviewSchema.json", "utf8"));
var COMMENT_SCHEMA = JSON.parse(fs.readFileSync("./lib/model/commentSchema.json", "utf8"));
var USER_SCHEMA    = JSON.parse(fs.readFileSync("./lib/model/userSchema.json", "utf8"));

var validator = new Validator();
var app       = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// DB objects
var dbReviews   = new Datastore({ filename: './.datastore/reviews.db', autoload: true });
var dbComments  = new Datastore({ filename: './.datastore/comments.db', autoload: true });
var dbUsers     = new Datastore({ filename: './.datastore/users.db', autoload: true });

// Request Validators
var ReviewValidator = (function () {
    var constr = function () {
        // the constructor
    };

    constr.isValidReviewRequest = function (req, res) {
      // Check if content-type is application/json*
      if (!req.is('application/json')) {
        res.status(406).send(helpers.ErrorHandler.createError(1,"The content-type header must be set to application/json")).end();
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
        res.status(406).send(helpers.ErrorHandler.createErrors(errorArray)).end();
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
          res.status(406).send(helpers.ErrorHandler.createError(3,"Could not find user " + review.author.refId)).end();
          return false;
        }
      }).on('error', function(e) {
        res.status(406).send(helpers.ErrorHandler.createError(3,"Could not find user " + review.author)).end();
        return false;
        console.log("Got error: " + e.message);
      });
      */
    };

    constr._isSemanticallyValidCallback = function (res) {
      return function (err, user) {
        if (err || user.length == 0) {
          console.log("inside error");
          res.status(406).send(helpers.ErrorHandler.createError(3,"Could not find user " + user)).end();
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
        res.status(406).send(helpers.ErrorHandler.createErrors(errorArray)).end();
        return false;
      }

      return true;
    };

    this._isHttpRequestValid = function (req, res) {
      // Check if content-type is application/json*
      if (!req.is('application/json')) {
        res.status(406).send(helpers.ErrorHandler.createError(1,"The content-type header must be set to application/json")).end();
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
        res.status(406).send(helpers.ErrorHandler.createError(1,"The content-type header must be set to application/json")).end();
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
        res.status(406).send(helpers.ErrorHandler.createErrors(errorArray)).end();
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

// REST Services
var ReviewRESTService = (function () {
    var self;

    var constr = function (reviewDAO, userDAO) {
      this.reviewDAO = reviewDAO;
      this.userDAO = userDAO;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getReview = function () {
      return function (req, res, next) {
        self.reviewDAO.getReview(req.params.review_id, function(err, review) {
          if (err) res.send(err);

          if (req.query.expand != "true") {
            res.json(review);
          } else {
            req.review = review[0];
            next();
          }

        });
      };
    };

    constr.prototype.updateReview = function () {
      return function(req, res) {
        if (!ReviewValidator.isValidReviewRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.modificationDate = currentDatetime;

        self.reviewDAO.updateReview(req.params.review_id, req.body, function (err, numReplaced) {
          if (err) res.send(err);
          res.json({ message: 'Review successfully updated!'});
        });
      };
    };

    constr.prototype.deleteReview = function () {
      return function(req, res) {
        self.reviewDAO.deleteReview(req.params.review_id, function (err, numRemoved) {
          if (err) res.send(err);
            res.json({ message: 'Review successfully deleted!'});
        });
       };
    };

    constr.prototype.getAllReviews = function () {
      return function(req, res, next) {
        self.reviewDAO.getAllReviews(function (err, reviews) {
          if (err) res.send(err);

          if (req.query.expand != "true") {
            res.json(reviews);
          } else {
            req.reviews = reviews;
            next();
          }
        });
      };
    };

    constr.prototype.createReview = function () {
      return function(req, res) {
        if (!ReviewValidator.isValidReviewRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        self.reviewDAO.createReview(req.body, function (err, review) {
          if (err) res.send(err);
          res.json({ message: 'Review successfully created!', 'review': JSON.stringify(review) });
        });
      };
    };

    return constr;
})();

var UserRESTService = (function () {
    var self;

    var constr = function (reviewDAO, userDAO) {
      this.reviewDAO = reviewDAO;
      this.userDAO = userDAO;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getUser = function () {
      return function (req, res, next) {
        self.userDAO.getUser(req.params.user_id, function(err, user) {
          if (err) res.send(err);

          if (req.query.expand != "true") {
            res.json(user);
          } else {
            req.user = user[0];
            next();
          }

        });
      };
    };

    constr.prototype.updateUser = function () {
      return function(req, res) {
        if (!UserValidator.isValidUserRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.modificationDate = currentDatetime;

        self.userDAO.updateUser(req.params.user_id, req.body, function (err, numReplaced) {
          if (err) res.send(err);
          res.json({ message: 'User successfully updated!'});
        });
      };
    };

    constr.prototype.deleteUser = function () {
      return function(req, res) {
        self.userDAO.deleteUser(req.params.user_id, function (err, numRemoved) {
          if (err) res.send(err);
            res.json({ message: 'User successfully deleted!'});
        });
       };
    };

    constr.prototype.getAllUsers = function () {
      return function(req, res) {
        self.userDAO.getAllUsers(function (err, users) {
          if (err) res.send(err);
          res.json(users);
        });
      };
    };

    constr.prototype.createUser = function () {
      return function(req, res) {
        if (!UserValidator.isValidUserRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        self.userDAO.createUser(req.body, function (err, user) {
          if (err) res.send(err);
          res.json({ message: 'User successfully created!', 'review': JSON.stringify(user) });
        });
      };
    };

    return constr;
})();

var CommentRESTService = (function () {
    var self;

    var constr = function (reviewDAO, userDAO, commentDAO) {
      this.reviewDAO = reviewDAO;
      this.userDAO = userDAO;
      this.commentDAO = commentDAO;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getComment = function () {
      return function (req, res, next) {
        self.commentDAO.getComment(req.params.comment_id, function(err, comment) {
          if (err) res.send(err);

          if (req.query.expand != "true") {
            res.json(comment);
          } else {
            req.comment = comment[0];
            next();
          }

        });
      };
    };

    constr.prototype.updateComment = function () {
      return function(req, res) {
        if (!CommentValidator.isValidCommentRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.modificationDate = currentDatetime;

        self.commentDAO.updateComment(req.params.comment_id, req.body, function (err, numReplaced) {
          if (err) res.send(err);
          res.json({ message: 'Comment successfully updated!'});
        });
      };
    };

    constr.prototype.deleteComment = function () {
      return function(req, res) {
        self.commentDAO.deleteComment(req.params.comment_id, function (err, numRemoved) {
          if (err) res.send(err);
            res.json({ message: 'Comment successfully deleted!'});
        });
       };
    };

    constr.prototype.getAllComments = function () {
      return function(req, res, next) {
        self.commentDAO.getAllComments(function (err, comments) {
          if (err) res.send(err);

          if (req.query.expand != "true") {
            res.json(comments);
          } else {
            req.comments = comments;
            next();
          }
        });
      };
    };

    constr.prototype.createComment = function () {
      return function(req, res) {
        if (!CommentValidator.isValidCommentRequest(req, res)) return;

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        self.commentDAO.createComment(req.body, function (err, comment) {
          if (err) res.send(err);
          res.json({ message: 'Comment successfully created!', 'review': JSON.stringify(comment) });
        });
      };
    };

    return constr;
})();


/*
var ReviewDAO = (function () {
    var self;
    var constr = function (crudService) {
      this.crudService = crudService;
      this.crudService.name = "reviewDaoService";
      self = this;
    };

    constr.prototype.constructor = constr;
    constr.prototype.getReview = function (id, callback) { console.log("review Dao aufgerufen"); return self.crudService.getEntity(id, callback);};
    constr.prototype.updateReview = function (id, newEntity, callback) { return self.crudService.updateEntity(id, newEntity, callback);};
    constr.prototype.deleteReview = function (id, callback) { return self.crudService.deleteEntity(id, callback);};
    constr.prototype.getAllReviews = function (callback) { return self.crudService.getAllEntities(callback);};
    constr.prototype.createReview = function (newEntity, callback) { return self.crudService.createEntity(newEntity, callback);};


    return constr;
})();
*/

// DAOs
var ReviewDAO = (function () {
    var self;
    var constr = function (userDbService) {
      this.dbservice = reviewDbService;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getReview= function (id, callback) {
      self.dbservice.find({ _id : id}, function(err, user) {
        callback(err, user);
      });
    };

    constr.prototype.updateReview = function (id, newReview, callback) {
      self.dbservice.findOne({ _id : id }, function (err, review) {
          if (err) callback(err);
          review = newReview;
          self.dbservice.update({ _id : id }, review, {}, function (err, numReplaced) {
            callback(err, numReplaced);
          });
       });
    };

    constr.prototype.deleteReview = function (id, callback) {
      self.dbservice.delete({ _id : id }, {}, function (err, numRemoved) {
        callback(err, numRemoved);
      });
    };

    constr.prototype.getAllReviews = function (callback) {
      self.dbservice.find({}, function (err, reviews) {
        callback(err, reviews);
      });
    };

    constr.prototype.createReview = function (newReview, callback) {
      self.dbservice.insert(newReview, function (err, review) {
        if (err) callback(err);
        callback(err, review);
      });
    };

    return constr;
})();

var UserDAO = (function () {
    var self;
    var constr = function (userDbService) {
      this.dbservice = userDbService;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getUser= function (id, callback) {
      self.dbservice.find({ _id : id}, function(err, user) {
        callback(err, user);
      });
    };

    constr.prototype.updateUser = function (id, newUser, callback) {
      self.dbservice.findOne({ _id : id }, function (err, user) {
          if (err) callback(err);
          user = newUser;
          self.dbservice.update({ _id : id }, user, {}, function (err, numReplaced) {
            callback(err, numReplaced);
          });
       });
    };

    constr.prototype.deleteUser = function (id, callback) {
      self.dbservice.delete({ _id : id }, {}, function (err, numRemoved) {
        callback(err, numRemoved);
      });
    };

    constr.prototype.getAllUsers = function (callback) {
      self.dbservice.find({}, function (err, users) {
        callback(err, users);
      });
    };

    constr.prototype.createUser = function (newUser, callback) {
      self.dbservice.insert(newUser, function (err, user) {
        if (err) callback(err);

        //if (newUser.avatarImage)
        //  helpers.Utils.saveB64AvatarImage(user.avatarImage, "./web/dist/img/" + user.id + ".png");

        callback(err, user);
      });
    };

    return constr;
})();

var CommentDAO = (function () {
    var self;
    var constr = function (commentDbService) {
      this.dbservice = commentDbService;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getComment= function (id, callback) {
      self.dbservice.find({ _id : id}, function(err, comment) {
        callback(err, comment);
      });
    };

    constr.prototype.updateComment = function (id, newComment, callback) {
      self.dbservice.findOne({ _id : id }, function (err, comment) {
          if (err) callback(err);
          comment = newComment;
          self.dbservice.update({ _id : id }, comment, {}, function (err, numReplaced) {
            callback(err, numReplaced);
          });
       });
    };

    constr.prototype.deleteComment = function (id, callback) {
      self.dbservice.delete({ _id : id }, {}, function (err, numRemoved) {
        callback(err, numRemoved);
      });
    };

    constr.prototype.getAllComments = function (callback) {
      self.dbservice.find({}, function (err, comments) {
        callback(err, comments);
      });
    };

    constr.prototype.createComment = function (newComment, callback) {
      self.dbservice.insert(newComment, function (err, comment) {
        if (err) callback(err);
        callback(err, comment);
      });
    };

    return constr;
})();

var CRUDDAO = (function () {
    var self;
    var constr = function (dbService) {
      this.dbservice = dbService;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getEntity= function (id, callback) {
      console.log("abstract Dao aufgerufen");
      self.dbservice.find({ _id : id}, function(err, entity) {
        callback(err, entity);
      });
    };

    constr.prototype.updateEntity = function (id, newEntity, callback) {
      self.dbservice.findOne({ _id : id }, function (err, entity) {
          if (err) callback(err);
          entity = newEntity;
          self.dbservice.update({ _id : id }, entity, {}, function (err, numReplaced) {
            callback(err, numReplaced);
          });
       });
    };

    constr.prototype.deleteEntity = function (id, callback) {
      self.dbservice.delete({ _id : id }, {}, function (err, numRemoved) {
        callback(err, numRemoved);
      });
    };

    constr.prototype.getAllEntities = function (callback) {
      self.dbservice.find({}, function (err, entities) {
        callback(err, entities);
      });
    };

    constr.prototype.createEntity = function (newEntity, callback) {
      self.dbservice.insert(newEntity, function (err, entity) {
        if (err) callback(err);
        callback(err, entity);
      });
    };

    return constr;
})();

var DbService = (function () {
    var self;
    var constr = function (db) {
        this.db = db;
        self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.find = function (queryJsonObject, callback) {
      this.db.find(queryJsonObject, function(err, data) {
        callback(err, data);
      });
    };

    constr.prototype.findOne = function (queryJsonObject, callback) {
      this.db.findOne(queryJsonObject, function(err, data) {
        callback(err, data);
      });
    };

    constr.prototype.update = function (queryJsonObject, newData, callback) {
      this.db.update(queryJsonObject, newData, {}, function (err, numReplaced) {
        callback(err, numReplaced);
      });
    };

    constr.prototype.delete = function (queryJsonObject, callback) {
      this.db.remove(queryJsonObject, {}, function (err, numRemoved) {
        callback(err, numReplaced);
      });
    };

    constr.prototype.insert = function (newData, callback) {
      this.db.insert(newData, function(err, data) {
        callback(err, data);
      });
    };

    return constr;
})();

// DB Abstraction objects
var reviewDbService   = new DbService(dbReviews);
var userDbService     = new DbService(dbUsers);
var commentDbService  = new DbService(dbComments);

// DAO objects
var reviewDAO   = new ReviewDAO(reviewDbService);
var userDAO     = new UserDAO(userDbService);
var commentDAO  = new CommentDAO(commentDbService);

// REST Service objects
var reviewRestService   = new ReviewRESTService(reviewDAO, userDAO);
var userRestService     = new UserRESTService(reviewDAO, userDAO);
var commentRestService  = new CommentRESTService(reviewDAO, userDAO, commentDAO);
var mid                 = new helpers.ExpansionMiddleware(reviewDAO, userDAO, commentDAO);

router.get('/', function(req, res) {
   res.json({ message: 'Welcome to the Review Monkey API!' });
});

router.route('/reviews')
    .post(reviewRestService.createReview())
    .get(reviewRestService.getAllReviews(), mid.EXPAND_REVIEWS);

router.route('/reviews/:review_id')
    .get(reviewRestService.getReview(), mid.EXPAND_REVIEW)
    .put(reviewRestService.updateReview())
    .delete(reviewRestService.deleteReview());

router.route('/comments')
    .post(commentRestService.createComment())
    .get(commentRestService.getAllComments(), mid.EXPAND_COMMENTS);

router.route('/comments/:comment_id')
    .get(commentRestService.getComment(), mid.EXPAND_COMMENT)
    .put(commentRestService.updateComment())
    .delete(commentRestService.deleteComment());

router.route('/users')
    .post(userRestService.createUser())
    .get(userRestService.getAllUsers());

router.route('/users/:user_id')
    .get(userRestService.getUser())
    .put(userRestService.updateUser())
    .delete(userRestService.deleteUser());

// REGISTER THE ROUTE -------------------------------
// all of our routes will be prefixed with /api/<version>/
app.use('/api/v1', router);

app.set("view options", {layout: false});
app.use(express.static(__dirname + '/web'));

// render the index file when requesting on the top level
app.get('/', function (req, res) {
  res.render('index');
})

var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Review Monkey listening at http://%s:%s', host, port);
});
