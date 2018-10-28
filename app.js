//Dependencias
const rp = require('request-promise')
var request = require('request')
const express = require('express')
const app = express()
const mysql = require('mysql')
const morgan = require('morgan')
var uuid = require('node-uuid');
var httpContext = require('express-http-context');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('d2a7b45c9c3140e98bd788c8ba842d41');
var books = require('google-books-search');
const myLoggers = require('log4js');
var redis = require('redis');

//logs con timings de requests 
app.use(morgan('short'));
//sessionId
app.use(httpContext.middleware);
// Asigna unique identifier a cada request
app.use(function(req, res, next) {
  httpContext.set('reqId', uuid.v1());
  next();
});

//Define conexion a db
const connection = mysql.createConnection({
  host: 'mysql-datos-2.cyufope5fgiy.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'root',
  password: 'root1234',
  database: 'MySQL_Datos_2'
})

app.get("/search/:topic", (req, res) => {
  var topic = req.params.topic;
  var reqId = httpContext.get('reqId');
  console.log("Fetching articles of topic: " + req.params.topic);
  //revisa en redis 
  var client = redis.createClient();
  client.on('connect', function() {
      console.log('Redis client connected');
  });
  client.on('error', function (err) {
      console.log('Something went wrong ' + err);
  });
  client.get(topic, function (error, result) {
      if (error) {
          console.log(error);
          throw error; }
      //estructura json del resultado
      console.log("redis: " + result);
      //si no esta la info en redis va a wikipedia
      if (result==null || error){
        fetchNews(topic, function(returnValue) {
            if (returnValue != 0){
              res.send({"Topic": topic, "Result": returnValue, "UserId": reqId});
              var newsResponse = returnValue + " Source: News";
              //guarda la info en redis
              client.set(topic, newsResponse, redis.print);
              console.log('Se guardo en Redis');
            }
        });

        fetchBooks(topic, function(returnValue) {
          if (returnValue != 0){
            res.send({"Topic": topic, "Result": returnValue, "UserId": reqId});
            var booksResponse = returnValue + " Source: News";
            //guarda la info en redis
            client.set(topic, booksResponse, redis.print);
            console.log('Se guardo en Redis');
          }
        }); 

        fetchWiki(topic, reqId, function(returnValue) {
          if (returnValue != 0){
            res.send({"Topic": topic, "Result": returnValue, "UserId": reqId});
            var wikiResponse = returnValue + " Source: News";
            //guarda la info en redis
            client.set(topic, wikiResponse, redis.print);
            console.log('Se guardo en Redis');
          }
        });

      }else{
        console.log('Se encontro en Redis');
        res.send({"Topic": topic, "Result": result, "UserId": reqId });
    }
    //Inserta log del request
    var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + topic + "', '" + reqId + "')";
    connection.query(sql, function (err, result) {
    if (err) throw err;
    console.log("1 log inserted");
    });
  });
});


app.get("/test", (req, res) => {
  fetchBooks("cat", function(returnValue){
    //console.log(returnValue);
      res.json(returnValue);
  });
})

// localhost:3003
app.listen(3003, () => {
  console.log("Server is up and listening on 3003...")
})

app.get('/', (req, res) => {
  res.json("Datos2 API");
})


function fetchBooks(topic, callback) {
  try{
    books.search(topic, function(error, results) {
      if ( ! error ) {
        var topBooks = [];
        for(i=1; i<results.length; i++){
          topBooks.push(results[i]["title"]);
        }
        console.log("Books: " + topBooks);
        callback(topBooks);
      } else {
        console.log(error);
        callback(0);
      }
    });
  }catch(err){
    callback(0);
  }
}

function fetchNews(topic, callback) {
  newsapi.v2.everything({
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
      return(topArticles);
    })
    .catch(function (err){
      console.log(err);
      return(0);
    });
}