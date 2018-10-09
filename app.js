//Dependencias
const rp = require('request-promise')
var request = require('request')
const express = require('express')
const app = express()
const morgan = require('morgan')
const mysql = require('mysql')
var uuid = require('node-uuid');
var httpContext = require('express-http-context');
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('d2a7b45c9c3140e98bd788c8ba842d41');
var books = require('google-books-search');

//Define conexion a db
const connection = mysql.createConnection({
  host: 'mysql-datos-2.cyufope5fgiy.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'root',
  password: 'root1234',
  database: 'MySQL_Datos_2'
})

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

  fetchNews(topic, function(returnValue) {
    res.json(returnValue + " Source: News");
    
  });

  fetchBooks(topic, function(returnValue) {
    res.json(returnValue + " Source: Books");
  }); 

  console.log("Fetching articles of topic: " + req.params.topic)
  var reqId = httpContext.get('reqId');
  const myTopic = req.params.topic
  const queryString = "SELECT topic, info_array FROM articulos WHERE topic = ?"
  connection.query(queryString, [myTopic], (err, rows, fields) => {
    if (err) {
      //go fetch from wikipedia
      console.log("Unable to retrieve from database: " + err)
      res.sendStatus(500)    
    }

    //return info from db
    var topArticles = rows.map((row) => {
      return {"Topic": row.topic, "Top articles": row.info_array, "UserId": reqId};
    })

    if (rows == 0) {
      console.log("Not found locally; fetching from wikipedia");
      var options={
        methode: 'GET',
        uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + myTopic + '&limit=25&namespace=0&format=json',
        json:true
      };   
      rp(options)
        .then(function(parseBody){
          topArticles = parseBody[1];
          res.json({"Topic": myTopic, "Top articles" : topArticles, "UserId": reqId });
        })
        .catch(function (err){
        }).finally(function(){
          var cleanArticles = topArticles.toString().replace(/\'/,"-");
          var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");
          var sql = "INSERT INTO articulos (topic, info_array) VALUES ('" + myTopic + "', '" + cleanArticles2 + "')";
          connection.query(sql, function (err, result) {
          if (err) throw err;
            console.log("1 record inserted");
          });
        });
    }else{
    res.json(topArticles);
    }
  })
  //Inserta log del request
  var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + myTopic + "', '" + reqId + "')";
  connection.query(sql, function (err, result) {
  if (err) throw err;
  console.log("1 log inserted");
  });

})


app.get('/search/:topic/:userId', (req, res) => {
  console.log("Fetching articles of topic: " + req.params.topic)
  const myTopic = req.params.topic
  
  const queryString = "SELECT topic, info_array FROM articulos WHERE topic = ?"
  connection.query(queryString, [myTopic], (err, rows, fields) => {
    if (err) {
      //go fetch from wikipedia
      console.log("Unable to retrieve from database: " + err)
      res.sendStatus(500) 
    }

    //return info from db
    var topArticles = rows.map((row) => {
      return {"Topic": row.topic, "Top articles": row.info_array, "UserId": req.params.userId};
    })

    if (rows == 0) {
      console.log("Not found locally; fetching from wikipedia");
      var options={
        methode: 'GET',
        uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + myTopic + '&limit=25&namespace=0&format=json',
        json:true
      };
    
      rp(options)
        .then(function(parseBody){
          topArticles = parseBody[1];
          res.json("[{Topic : " + myTopic + ", Top articles: " + topArticles + ", UserId : " + req.params.userId + "}]");
        })
        .catch(function (err){
        }).finally(function(){
          var cleanArticles = topArticles.toString().replace(/\'/,"-");
          var cleanArticles2 = cleanArticles.toString().replace(/\'[a-zA-Z]/,"-");
          var sql = "INSERT INTO articulos (topic, info_array) VALUES ('" + myTopic + "', '" + cleanArticles2 + "')";
          connection.query(sql, function (err, result) {
          if (err) throw err;
            console.log("1 record inserted");
          });
        });
    }else{
    res.json(topArticles);
    }
  })
  //Inserta log del request
  var sql = "INSERT INTO user_logs (topic, usuario) VALUES ('" + myTopic + "', '" + req.params.userId + "')";
  connection.query(sql, function (err, result) {
  if (err) throw err;
  console.log("1 log inserted");
  });
})

app.get("/test", (req, res) => {
  newsapi.v2.everything({
    sources: 'the-economist, bbc-news, fox-news',
    q: 'bitcoin',
  }).then(response => {
    console.log("shesponde " + response);
    res.send(response)
  }).catch(function (err) {
    // Crawling failed...
    console.log("Exclusion " + err);
  });
})

app.get("/testBooks", (req, res) => {
  books.search("Titanic", function(error, results) {
    if ( ! error ) {

        res.json(results);
    } else {
        console.log(error);
    }
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
        console.log("Books: " + results[0]);
        return(results);
    } else {
        console.log(error);
        return(0);
    }
});
}

function fetchNews(topic, callback) {
  newsapi.v2.everything({
    sources: 'bbc-news, fox-news',
    q: topic,
  }).then(response => {
    console.log("News: " + response[0]);
    return(response)
  }).catch(function (err) {
    // Crawling failed...
    console.log(err);
    return(0);
  });
}

function fetchWiki(topic, userId, callback) {
  var options={
    methode: 'GET',
    uri:'https://en.wikipedia.org/w/api.php?action=opensearch&search=' + topic + '&limit=25&namespace=0&format=json',
    json:true
  };
  rp(options)
    .then(function(parseBody){
      topArticles = parseBody[1];
      return("[{Topic : " + myTopic + ", Top articles: " + topArticles + ", UserId : " + userId + "}]");
    })
    .catch(function (err){
      console.log(err);
      return(0);
    });
}