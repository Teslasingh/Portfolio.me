var winston = require('winston');
var path = require('path');
var fs = require('fs');

var logDirectory = process.env.LOG_DIR || path.join(__dirname, '../logs');
try {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
  }
} catch (e) {
  // ignore directory creation errors
}

var logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      level: logLevel,
      handleExceptions: true,
      json: false,
      colorize: true,
      timestamp: true
    }),
    new (winston.transports.File)({
      level: logLevel,
      filename: path.join(logDirectory, 'app.log'),
      handleExceptions: true,
      json: true,
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  exitOnError: false
});

module.exports = logger;