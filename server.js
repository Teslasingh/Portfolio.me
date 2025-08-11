#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('./server/app');
var debug = require('debug')('portfolio-website-p1:server');
var https = require('https');  // Change to the 'https' module
var fs = require('fs');  // Require the 'fs' module for reading SSL certificate files

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '443');
//Console.log('Hosted on Port 3000');
app.set('port', port);

/*
 * Load SSL certificate files.
 * Replace 'your_cert_key.pem' and 'your_cert.pem' with your actual file names.
 * Make sure to provide the correct file paths.
 */
// Correct paths after Certbot
var privateKey = fs.readFileSync('privkey.pem', 'utf8');
var certificate = fs.readFileSync('fullchain.pem', 'utf8');
var ca = fs.readFileSync('chain.pem', 'utf8'); // Optional

var credentials = { key: privateKey, cert: certificate, ca: ca }; // Credentials for HTTPS


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
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
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

    // handle specific listen errors with friendly messages
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
