'use strict';

var http = require('http');

var _ = require('lodash');
var async = require('async');
var express = require('express');
var request = require('request');

var apiRoute = require('./apiroute');

function staticServer (appName, port) {
  var app = express();
  var server = http.createServer(app);
  app.use('/'+appName, express.static('./build'));
  server.on('listening', function () {
    console.log('%s statics listening on %s', appName, port);
  });
  server.on('error', function (err) {
    console.error('error');
  });
  server.listen = _.partial(server.listen.bind(server), port);
  return server;
}

function apiRouteServer () {
  var app = express();
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

module.exports = function runServer (appName, port, callback) {
  var staticApp = staticServer(appName, port);
  var apiRouteApp = apiRouteServer();
  async.parallel([
    staticApp.listen.bind(staticApp),
    apiRouteApp.listen.bind(apiRouteApp)
  ], callback);
};
