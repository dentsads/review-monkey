// Required dependencies
var Datastore     = require('nedb');
var express       = require('express');
var bodyParser    = require('body-parser');
var session       = require('express-session')
var cookieParser  = require('cookie-parser')
var http          = require('http');
var async         = require("async");
var fs            = require("fs");
var uuid          = require('node-uuid');
var helpers       = require('./lib/helpers');
var config       = require('./config.json');

var app           = express();

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

// REST Services
var ReviewRESTService = (function () {
    var self;

    var constr = function (reviewDAO, userDAO) {
      this.reviewDAO = reviewDAO;
      this.userDAO = userDAO;
      this.utils = new helpers.Utils();
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
      return function(req, res, next) {
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
      return function(req, res, next) {

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        // Set default prority to 'low' if none is given
        if (req.body.priority === undefined)
          req.body.priority = "low";

        req.body.author = {};
        req.body.author.refId  = req.session.passport.user;

        for (var i = 0 ; i < req.body.changes.length; i++) {
          var change = req.body.changes[i];
          // Calculate line count for every udiff change
          change.lineCount = self.utils.getUdiffLineCount(change.udiff);
          // Generate random RFC4122 v4 UUIDs for every change
          change.id = uuid.v4();
        }

        for (var i = 0 ; i < req.body.reviewers.length; i++) {
          var reviewer = req.body.reviewer[i];
          // Default review status is 'open'
          reviewer.reviewStatus = "open";
        }

        self.reviewDAO.createReview(req.body, function (err, review) {
          if (err) res.send(err);
          res.json({ message: 'Review successfully created!', 'review': review });
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
            var obfuscatedUser = user;
            delete obfuscatedUser[0].password;
            res.json(obfuscatedUser);
          } else {
            var obfuscatedUser = user[0];
            delete obfuscatedUser.password;
            req.user = obfuscatedUser;
            next();
          }

        });
      };
    };

    constr.prototype.updateUser = function () {
      return function(req, res, next) {
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
      return function(req, res, next) {

        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        req.body.archived = false;

        self.userDAO.createUser(req.body, function (err, user) {
          if (err) res.send(err);
          res.json({ message: 'User successfully created!', 'review': user });
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
      return function(req, res, next) {
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
        self.commentDAO.getComment(req.params.comment_id, function (err, comment) {
          if (err) res.send(err);

          self.commentDAO.deleteComment(req.params.comment_id, function (err, numRemoved) {
            if (err) res.send(err);

              _deleteCommentReferencesInReview(comment[0]);

              res.json({ message: 'Comment successfully deleted!'});
          });

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
      return function(req, res, next) {
        var currentDatetime = new Date().toString();
        req.body.creationDate = currentDatetime;
        req.body.modificationDate = currentDatetime;

        req.body.author = {};
        req.body.author.refId = req.session.passport.user;

        self.commentDAO.createComment(req.body, function (err, comment) {
          if (err) res.send(err);

          _updateCommentReferencesInReview(comment);

          res.json({ message: 'Comment successfully created!', 'comment': comment });
        });
      };
    };

    var _updateCommentReferencesInReview = function (comment) {
      var reviewRefId = comment.review.refId.substring(comment.review.refId.lastIndexOf('/')+1);

      if (comment.change === undefined) {
        self.reviewDAO.updateReview(reviewRefId, { $push: { globalComments: {"refId": comment._id} } }, function (err, numReplaced) {
        });
      } else if (comment.change != undefined) {

        self.reviewDAO.getReview(reviewRefId, function (err, fetchedReview) {
          for(var i = 0 ; i < fetchedReview[0].changes.length; i++){
            var change = fetchedReview[0].changes[i];

            if (change.id === comment.change.refId) {
              if (change.comments === undefined)
                change.comments = [];

              change.comments.push({"refId": comment._id});
            }
          }

          self.reviewDAO.updateReview(reviewRefId, fetchedReview[0], function (err, numReplaced) {
          });
        });

      }

    };

    var _deleteCommentReferencesInReview = function (comment) {
      var reviewRefId = comment.review.refId.substring(comment.review.refId.lastIndexOf('/')+1);

      if (comment.change === undefined) {

      } else if (comment.change != undefined) {

        self.reviewDAO.getReview(reviewRefId, function (err, fetchedReview) {
          for(var i = 0 ; i < fetchedReview[0].changes.length; i++){
            var change = fetchedReview[0].changes[i];

            if (change.id === comment.change.refId) {

              for (var k in change.comments) {
                if (change.comments[k].refId === comment._id) {
                  change.comments.splice(k, 1);
                  if (change.comments.length === 0) {
                    delete change.comments;
                  }
                }
              }
            }
          }

          self.reviewDAO.updateReview(reviewRefId, fetchedReview[0], function (err, numReplaced) {
          });
        });

      }
    };

    return constr;
})();

// DAOs
var ReviewDAO = (function () {
    var self;
    var constr = function (reviewDbService) {
      this.dbservice = reviewDbService;
      self = this;
    };

    constr.prototype.constructor = constr;

    constr.prototype.getReview= function (id, callback) {
      self.dbservice.find({ _id : id}, function(err, review) {
        callback(err, review);
      });
    };

    constr.prototype.updateReview = function (id, newReview, callback) {
      self.dbservice.update({ _id : id }, newReview, function (err, numReplaced) {
        callback(err, numReplaced);
      });
    };

    constr.prototype.updateReview2 = function (queryObject, updateObject, callback) {
      self.dbservice.update(queryObject, updateObject, function (err, numReplaced) {
        callback(err, numReplaced);
      });
    };

    constr.prototype.deleteReview = function (id, callback) {
      self.dbservice.delete({ _id : id }, function (err, numRemoved) {
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
      self.dbservice.update({ _id : id }, newUser, function (err, numReplaced) {
        callback(err, numReplaced);
      });
    };

    constr.prototype.deleteUser = function (id, callback) {
      self.dbservice.delete({ _id : id }, function (err, numRemoved) {
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
      self.dbservice.update({ _id : id }, newComment, function (err, numReplaced) {
        callback(err, numReplaced);
      });
    };

    constr.prototype.deleteComment = function (id, callback) {
      self.dbservice.delete({ _id : id }, function (err, numRemoved) {
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

// Db Service
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
        callback(err, numRemoved);
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
var reviewRestService   = new ReviewRESTService(reviewDAO, userDAO, helpers.Utils);
var userRestService     = new UserRESTService(reviewDAO, userDAO);
var commentRestService  = new CommentRESTService(reviewDAO, userDAO, commentDAO);
var exp                 = new helpers.ExpansionMiddleware(reviewDAO, userDAO, commentDAO);
var val                 = new helpers.ValidationMiddleware(reviewDAO, userDAO, commentDAO);

// Passport Authenticator
var authenticator = new helpers.Authenticator(userDbService);
var passport = authenticator.passport();

router.get('/', function(req, res) {
   res.json({ message: 'Welcome to the Review Monkey API!' });
});

router.get('/identity', function(req, res) {
  var user = req.user;
  delete user.password;
  res.json(user);
});

router.route('/reviews')
    .post(val.VALIDATE_REVIEW, reviewRestService.createReview())
    .get(reviewRestService.getAllReviews(), exp.EXPAND_REVIEWS);

router.route('/reviews/:review_id')
    .get(reviewRestService.getReview(), exp.EXPAND_REVIEW)
    .put(val.VALIDATE_REVIEW, reviewRestService.updateReview())
    .delete(reviewRestService.deleteReview());

router.route('/comments')
    .post(val.VALIDATE_COMMENT, commentRestService.createComment())
    .get(commentRestService.getAllComments(), exp.EXPAND_COMMENTS);

router.route('/comments/:comment_id')
    .get(commentRestService.getComment(), exp.EXPAND_COMMENT)
    .put(val.VALIDATE_COMMENT, commentRestService.updateComment())
    .delete(commentRestService.deleteComment());

router.route('/users')
    .post(val.VALIDATE_USER, userRestService.createUser())
    .get(userRestService.getAllUsers());

router.route('/users/:user_id')
    .get(userRestService.getUser())
    .put(val.VALIDATE_USER, userRestService.updateUser())
    .delete(userRestService.deleteUser());

app.use(express.static('public'));
app.use(cookieParser());
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

var auth = passport.authenticate('local', {
                                  failureRedirect: '/web/pages/examples/login.html'});

var securityRedirect = function (req, res, next){
  if (!req.isAuthenticated() && req.path !== '/web/pages/examples/login.html') {
    req.session.redirectUrl = req.originalUrl;
    res.redirect('/web/pages/examples/login.html');
  } else {
    next();
  }
}

var noCache = function (req, res, next){
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

app.post('/web/pages/examples/login.html', auth, function (req, res){
  var redirectUrl = req.session.redirectUrl ? req.session.redirectUrl : '/';
  delete req.session.redirectUrl;

  res.redirect(redirectUrl);
});

// REGISTER THE ROUTE -------------------------------
// all of our routes will be prefixed with /api/<version>/
app.use('/api/v1', securityRedirect, router);
//app.use('/api/v1', router);

app.set("view options", {layout: false});

app.get('/web', securityRedirect, noCache);

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/', function(req, res, next) {
  res.redirect('/web');
});
app.use('/web', express.static(__dirname + '/web'));

var server = app.listen(config['web-server-port'] || 3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Review Monkey listening at http://%s:%s', host, port);
});
