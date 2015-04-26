var express = require('express');
var app = express();
var bodyParser = require('body-parser');

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router


// Persistent datastore with automatic loading
var Datastore = require('nedb')
  , db = new Datastore({ filename: './.datastore/datafile.db', autoload: true });


router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

router.route('/reviews')

    // create a review
    .post(function(req, res) {

        var review = { hello: 'world'
               , n: 5
               , today: new Date()
               , nedbIsAwesome: true
               , notthere: null
               , notToBeSaved: undefined  // Will not be saved
               , fruits: [ 'apple', 'orange', 'pear' ]
               , infos: { name: 'nedb' }
               };

        db.insert(review, function (err, review) {
      		if (err)
    	        	res.send(err);

      		res.json({ message: 'Review created!' });

      		console.log('inserted document' + review.today);
	      });

    })

    .get(function(req, res) {
  		db.find({}, function (err, reviews) {
  			if (err)
  		        	res.send(err);

  			res.json(reviews);

  		  // docs is an array containing documents Mars, Earth, Jupiter
  		  // If no document is found, docs is equal to []
  		  console.log('found document: ' + reviews[0].fruits);
  		});
    });

router.route('/reviews/:review_id')

    .get(function(req, res) {
        db.find({ _id : req.params.review_id}, function(err, review) {
            if (err)
                res.send(err);
            res.json(review);
        });
    })

    .put(function(req, res) {
    	 db.findOne({ _id : req.params.review_id }, function (err, review) {
    			if (err)
    		        	res.send(err);
    			review = req.body;
    			db.update({ _id : req.params.review_id }, req.body, {}, function (err, numReplaced) {
    			     if (err)
    				res.send(err);

    			  res.json(review);
    			});

	     });

    })

    .delete(function(req, res) {

			db.remove({ _id : req.params.review_id }, {}, function (err, numRemoved) {
			  if (err)
				res.send(err);

			    res.json({ message: 'Successfully deleted' });
			});
	});

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

app.get('/pages/reviews/:review_id', function (req, res) {
  res.send('Review: ' + req.params.review_id);
})

var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Review Monkey listening at http://%s:%s', host, port);

});
