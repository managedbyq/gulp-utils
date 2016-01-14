'use strict';

var async = require('async');
var exec = require('child_process').exec;
var git = require('simple-git');
var request = require('superagent');
var Slack = require('slack-node');
var _ = require('lodash');

function fullCommitMessage(hash, cb) {
  exec('git log -n 1 --pretty=format:%B ' + hash, cb);
}

function sendSlackMessage(options, cb) {
  var slack = new Slack(options.apiToken);
  options = _.extend({channel: '#dev-ci'}, options || {});
  slack.api('chat.postMessage', {
    channel: options.channel,
    attachments: JSON.stringify([{
      'text': options.message,
      'color': 'warning',
      'mrkdwn_in': ['text']
    }]),
    icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Tiberius%2C_Romisch-' +
              'Germanisches_Museum%2C_Cologne_%288115606671%29.jpg/440px-Tiberius' +
              '%2C_Romisch-Germanisches_Museum%2C_Cologne_%288115606671%29.jpg',
    username: 'Tiberius'
  }, cb);
}

function releaseNotes(repoName, firstTag, secondTag, cb) {
  var linkTemplate = _.template('https://github.com/managedbyq/<%= repoName %>/pull/<%= num %>/files');
  var lineTemplate = _.template('\u2022 (<%= author %>) <%= description %> - <<%= link %>|github>');
  git(process.cwd()).log({from: firstTag, to: secondTag}, function (err, log) {
    if (err) {
      cb(err);
      return;
    }

    var prCommits = _.filter(log.all, function (commit) {
      return commit.message.startsWith('Merge pull request');
    });

    async.parallel(_.map(prCommits, function (commit) {
      return function (cb) {
        fullCommitMessage(commit.hash.substr(1), function (err, message) {
          if (err) {
            cb(err);
            return;
          }
          var prNumber = message.match(/Merge pull request #(\d+)/)[1];
          var description = message.split('\n', 3)[2];

          var link = linkTemplate({num: prNumber, repoName: repoName});
          var line = lineTemplate({author: commit.author_name, description: description, link: link});
          cb(null, line);
        });
      };
    }), function (err, results) {
      if (err) {
        cb(err);
        return;
      }
      results.reverse();
      cb(null, results.join('\n'));
    });
  });
}

module.exports.publishReleaseNotes = function (options, cb) {
  var template = _.template('*<%= headline %>*\n<%= notes %>');
  releaseNotes(options.repoName, options.firstTag, options.secondTag, function (err, releaseNotes) {
    if (err) {
      cb(err);
      return;
    }
    sendSlackMessage(_.extend({}, options, {
      message: template({repoName: options.repoName, headline: options.headline, notes: releaseNotes})
    }), cb);
  });
};

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
