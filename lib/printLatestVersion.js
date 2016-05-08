#! /usr/bin/env node

'use strict';

var tiberius = require('./tiberius');
var argv = require('minimist')(process.argv.slice(2));

var releaseFinder, applicationToken;
if (argv.env === 'dev') {
  releaseFinder = tiberius.mostRecentDevRelease;
  applicationToken = process.env.DEV_API_APPLICATION_TOKEN;
} else if (argv.env === 'prod') {
  releaseFinder = tiberius.mostRecentProductionRelease;
  applicationToken = process.env.PROD_API_APPLICATION_TOKEN;
}

releaseFinder(applicationToken, argv.app, function(err, version) {
  console.log(version);
});
