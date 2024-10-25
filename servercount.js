#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('./server/app');
var debug = require('debug')('portfolio-website-p1:server');
var https = require('https');
var fs = require('fs');

/**
 * Page view counter.
 */
var pageViews = 0;

/**
 * Middleware to count page views.
 */
app.use(function(req, res, next) {
    pageViews++;
    console.log("Page views:", pageViews);
    next();
});

// The rest of your code follows...
var port = normalizePort(process.env.PORT || '443');
app.set('port', port);



// SSL certificate files loading, HTTPS server creation, etc., goes here.
/*
 * Load SSL certificate files.
 * Replace 'your_cert_key.pem' and 'your_cert.pem' with your actual file names.
 * Make sure to provide the correct file paths.
 */
var privateKey = fs.readFileSync('/etc/letsencrypt/live/anubhav.ddns.net/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/anubhav.ddns.net/cert.pem', 'utf8');
var ca = fs.readFileSync('/etc/letsencrypt/live/anubhav.ddns.net/chain.pem', 'utf8');

var credentials = { key: privateKey, cert: certificate, ca: ca };

/*
 * Create HTTPS server.
 */
var server = https.createServer(credentials, app);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        return val;
    }

    if (port >= 0) {
        return port;
    }

    return false;
}

/**
 * Event listener for HTTPS server "error" event.
 */
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTPS server "listening" event.
 */
function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ?
        'pipe ' + addr :
        'port ' + addr.port;
    debug('Listening on ' + bind);
}

