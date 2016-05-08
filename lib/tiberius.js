'use strict';

var async = require('async');
var exec = require('child_process').exec;
var request = require('superagent');
var Slack = require('slack-node');
var _ = require('lodash');

function sendSlackMessage(options, cb) {
  var slack = new Slack(options.apiToken);
  options = _.extend({channel: '#dev-ci'}, options || {});

  if (options.test) {
    console.log('Simulating sending slack message "' + options.message + '" to ' + options.channel);
    cb(null);
    return;
  }
  slack.api('chat.postMessage', {
    channel: options.channel,
    attachments: JSON.stringify([{
      'text': options.message,
      'color': 'good',
      'mrkdwn_in': ['text']
    }]),
    icon_url: 'http://i.imgur.com/pAMdaSt.jpg',
    username: 'Tiberius'
  }, cb);
}

module.exports.sendSlackMessage = sendSlackMessage;

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

module.exports.releaseVersionToStg = function (token, applicationName, newVersion, cb) {
  setReleasedVersion({
      apiUrl: 'https://api.stg.mbq.io',
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
