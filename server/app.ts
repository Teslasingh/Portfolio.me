/// <reference path = "./_reference.ts"/>

var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var ejs = require('ejs');
var nodemailer = require('nodemailer');
var appLogger = require('./logger');

var app = express();

var routes = require('./routes/index');
var users = require('./routes/users');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
var morganFormat = process.env.MORGAN_FORMAT || (app.get('env') === 'production' ? 'combined' : 'dev');
app.use(morgan(morganFormat, { stream: { write: function(message) { appLogger.info(message.trim()); } } }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', routes);
app.use('/users', users);

// error logging middleware
app.use(function(err, req, res, next) {
  var status = err && err.status ? err.status : 500;
  var meta = { status: status, method: req.method, url: req.originalUrl, ip: req.ip };
  if (status >= 500) {
    appLogger.error(err && (err.stack || err.message) ? (err.stack || err.message) : err, meta);
  } else {
    appLogger.warn(err && err.message ? err.message : 'Error', meta);
  }
  next(err);
});

class CustomError extends Error{
    public status:number;
    constructor(message?:string){
        super(message);
    }
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new CustomError('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        var appLogger = require('./logger');
        appLogger.error(err && (err.stack || err.message) ? (err.stack || err.message) : err);
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  var appLogger = require('./logger');
  appLogger.error(err && (err.stack || err.message) ? (err.stack || err.message) : err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
