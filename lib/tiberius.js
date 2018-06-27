'use strict';

var async = require('async');
var exec = require('child_process').exec;
var request = require('superagent');

function mostRecentRelease(config, cb) {
  var apiUrl = config.apiUrl;
  var token = config.token;
  var applicationName = config.applicationName;

  request
    .get(apiUrl + '/api/v1/applications/' + applicationName + '/')
    .set('X-Application-Token', token)
    .end(function (err, res) {
      if (err) {
        cb(err);
        return;
      }
      cb(null, JSON.parse(res.text).version);
    });
}

function setReleasedVersion(config, newVersion, cb) {
  var apiUrl = config.apiUrl;
  var token = config.token;
  var applicationName = config.applicationName;

  request
    .patch(apiUrl + '/api/v1/applications/' + applicationName + '/')
    .send({version: newVersion})
    .set('X-Application-Token', token)
    .end(cb);
}

module.exports.mostRecentProductionRelease = function (token, applicationName, cb) {
  mostRecentRelease({
      apiUrl: 'https://api.managedbyq.com',
      applicationName: applicationName,
      token: token
    },
    cb);
};

module.exports.mostRecentDevRelease = function (token, applicationName, cb) {
  mostRecentRelease({
      apiUrl: 'https://api.dev.mbq.io',
      applicationName: applicationName,
      token: token
    },
    cb);
};

module.exports.releaseVersionToDev = function (token, applicationName, newVersion, cb) {
  setReleasedVersion({
      apiUrl: 'https://api.dev.mbq.io',
      applicationName: applicationName,
      token: token
    },
    newVersion,
    cb);
};

module.exports.releaseVersionToPrd = function (token, applicationName, newVersion, cb) {
  setReleasedVersion({
      apiUrl: 'https://api.managedbyq.com',
      applicationName: applicationName,
      token: token
    },
    newVersion,
    cb);
};
