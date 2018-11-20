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
const curl = new (require( 'curl-request' ))();

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
  host: 'datos2final.cr0c2d7y40q0.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'root',
  password: 'root1234',
  database: 'datosfinal'
})

app.get("/search/:topic/:userId?", (req, res) => {
  var topic = req.params.topic;
  if (req.params.userId){
    var reqId = req.params.userId;
  }else{
    var reqId = httpContext.get('reqId');
  }
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
              var newsResponse = returnValue;
              if (!(res.headersSent)){
                res.send({"Topic": topic, "Result": newsResponse, "UserId": reqId});
              }
              //guarda la info en redis
              client.set(topic, newsResponse.toString(), redis.print);
              saveLog(reqId, topic, newsResponse, "News");
            }
        });

        fetchBooks(topic, function(returnValue) {
          if (returnValue != 0){
            var booksResponse = returnValue;
            if (!(res.headersSent)){
              res.send({"Topic": topic, "Result": booksResponse, "UserId": reqId});
            }
            //guarda la info en redis
            client.set(topic, booksResponse.toString(), redis.print);
            saveLog(reqId, topic, returnValue, "Books");
          }
        }); 

        fetchWiki(topic, function(returnValue) {
          if (returnValue != 0){
            var wikiResponse = returnValue.toString();
            if (!(res.headersSent)){
              res.send({"Topic": topic, "Result": wikiResponse, "UserId": reqId});
            }
            //guarda la info en redis
            client.set(topic, wikiResponse, redis.print);
            saveLog(reqId, topic, wikiResponse, "Wikipedia");
          }
        });

        }else{
          console.log('Se encontro en Redis');
          res.send({"Topic": topic, "Result": result, "UserId": reqId });
      }
    });

  postToLoggingAPI(reqId, topic);

});


app.get("/search2/:topic/:userId?", (req, res) => {

})

// localhost:3003
app.listen(3003, () => {
  console.log("Server is up and listening on 3003...")
})

app.get('/', (req, res) => {
  res.json("Datos2 API");
})


function saveLog(userId, topic, result, source) {
  //Inserta log del request
  console.log("saveLog base de datos");
  connection.query(
    "INSERT INTO history (topic, result, usuario, sourceAPI) VALUES (?, ?, ?, ?)", [topic, result.toString(), userId, source], function (err, rows) {
      if (err) throw err;
      console.log("1 log inserted");
    }
  );
}

function fetchBooks(topic, callback) {
    books.search(topic, function(error, results) {
      if ( ! error ) {
        var topBooks = [];
        for(i=1; i<results.length; i++){
          topBooks.push(results[i]["title"]);
        }
        console.log("Books: " + topBooks);
        try{
          callback(topBooks);
        }catch(err){
          callback(0);
        }
      } else {
        console.log(error);
        callback(0);
      }
    });
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
    })
    .catch(function (err){
      console.log(err);
      callback(0);
    })
    .finally(function() {
      console.log("Wiki: " + topArticles);
      callback(topArticles);
   });
}

function postToLoggingAPI(userID, topic) {
    console.log("entrando a logging api");    
    var date = new Date;
    var timestamp = date.getTime();
    curl.get('http://54.163.75.163:3003/log/'+topic+'/'+userID+'/'+timestamp)
    .then((res) => {
      console.log("Exito ", res);
    })
    .catch((err) => {
      console.log("Error ", err);
    })
}
