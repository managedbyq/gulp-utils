'use strict';

var http = require('http');

var _ = require('lodash');
var async = require('async');
var cors = require('cors');
var express = require('express');
var request = require('request');

var apiRoute = require('./apiroute');

function staticServer (path, port, customBehavior) {
  var app = express();
  var server = http.createServer(app);
  app.use(path, express.static('./build'));
  if (customBehavior) {
    customBehavior(app);
  }
  server.on('listening', function () {
    console.log('statics listening on port: %s, path: %s', port, path);
  });
  server.on('error', function (err) {
    console.error('error');
  });
  server.listen = _.partial(server.listen.bind(server), port);
  return server;
}

function apiRouteServer () {
  var app = express();
  // allow CORS from any domain
  app.use(cors({origin: true, preflightContinue: true}));
  var server = http.createServer(app);
  var routeOpts = {request: request};
  var locals = {
    api: process.env.API || 'local',
    api_endpoint: process.env.API_ENDPOINT
  };
  apiRoute(app, routeOpts, locals);
  server.on('listening', function () {
    console.log('apiRoute listening on 4000 with settings: ', locals);
  });
  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
      console.log('Another apiRoute is already running');
    } else {
      throw err;
    }
  });
  server.listen = _.partial(server.listen.bind(server), 4000);
  return server;
}

module.exports = function runServer (path, port, customBehavior, callback) {
  if (!callback) {
    callback = customBehavior;
    customBehavior = null;
  }
  var staticApp = staticServer(path, port, customBehavior);
  var apiRouteApp = apiRouteServer();
  async.parallel([
    staticApp.listen.bind(staticApp),
    apiRouteApp.listen.bind(apiRouteApp)
  ], callback);
};
