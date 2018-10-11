//Dependencias
const rp = require('request-promise')
var request = require('request')
const express = require('express')
const app = express()
const morgan = require('morgan')
var uuid = require('node-uuid');
var httpContext = require('express-http-context');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('d2a7b45c9c3140e98bd788c8ba842d41');
var books = require('google-books-search');

//logs con timings de requests 
app.use(morgan('short'));
//sessionId
app.use(httpContext.middleware);
// Asigna unique identifier a cada request
app.use(function(req, res, next) {
  httpContext.set('reqId', uuid.v1());
  next();
});

app.get("/search/:topic", (req, res) => {
  var topic = req.params.topic;
  var reqId = httpContext.get('reqId');
  var firstResponse = "";
  console.log("Fetching articles of topic: " + req.params.topic);

  fetchNews(topic, function(returnValue) {
    res.json(returnValue);
    //firstResponse = returnValue + " Source: News"
  });

  fetchBooks(topic, function(returnValue) {
    res.json(returnValue + " Source: Books");
    firstResponse = returnValue + " Source: News"
  }); 

  fetchWiki(topic, reqId, function(returnValue) {
    res.json(returnValue + "Source: Wiki");
    firstResponse = returnValue + " Source: News"
  });

  //res.end(firstResponse);

})


app.get('/search/:topic/:userId', (req, res) => {
  
})


app.get("/test", (req, res) => {
  fetchWiki("cat", function(returnValue){
    //console.log(returnValue);
      res.json(returnValue);
  });
})


app.get('/history/:userId', (req, res) => {
  console.log("Fetching history by userId")

  const queryString = "SELECT fecha, topic FROM user_logs where usuario = ? "
  connection.query(queryString, [req.params.userId], (err, rows, fields) => {
    if (err) {
      console.log("Failed to query for users: " + err)
      res.sendStatus(500)
      return
      // throw err
    }
    var historyUser = rows.map((row) => {
      return {"Date": row.fecha, "url": "http://localhost:3003/search/" + row.topic + "/" + req.params.userId};
    })
    res.json(historyUser)
  })
})

// localhost:3003
app.listen(3003, () => {
  console.log("Server is up and listening on 3003...")
})


function fetchBooks(topic, callback) {
  books.search(topic, function(error, results) {
    if ( ! error ) {
      var topBooks = [];
      for(i=1; i<results.length; i++){
        topBooks.push(results[i]["title"]);
      }
      console.log("Books: " + topBooks);
    } else {
        console.log(error);
        callback(0);
    }
});
}

function fetchNews(topic, callback) {
  newsapi.v2.everything({
    sources: 'bbc-news, fox-news',
    q: topic,
  }).then(response => {
    var topHeadlines = [];
      for(i=1; i<response["articles"].length; i++){
        topHeadlines.push(response["articles"][i]["title"]);
      }
    console.log("News: " + topHeadlines);
    callback(topHeadlines)
  }).catch(function (err) {
    // Crawling failed...
    console.log(err);
    callback(0);
  });
}

function fetchWiki(topic, callback) {
  var options={
    methode: 'GET',
    uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + topic + '&limit=25&namespace=0&format=json',
    json:true
  };
  rp(options)
    .then(function(parseBody){
      topArticles = parseBody[1];
      console.log("Wiki: " + topArticles);
      callback(topArticles);
    })
    .catch(function (err){
      console.log(err);
      return(0);
    });
}