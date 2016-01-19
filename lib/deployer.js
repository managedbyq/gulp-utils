'use strict';

var async = require('async');
var exec = require('child_process').exec;
var s3upload = require('./s3upload');
var tiberius = require('./tiberius');

/**
 *
 * @param config.test {boolean}
 * @param config.applicationName {string}
 * @param config.repoName {string}
 * @param config.jenkinsProdDeployJobName {string}
 * @param config.packageVersion {string}
 * @param config.credentials.prodApplicationToken {string}
 * @param config.credentials.stgApplicationToken {string}
 * @param config.credentials.devApplicationToken {string}
 * @param config.credentials.s3KeyId {string}
 * @param config.credentials.s3SecretKey {string}
 * @param config.credentials.slackToken
 * @returns {{}}
 */
module.exports.create = function (config) {
  var prevVersion;

  var getPrevVersion = function (cb) {
    if (config.test) {
      console.log('Version fetch simulated');
      cb();
      return;
    }
    tiberius.mostRecentProductionRelease(
      config.credentials.prodApplicationToken,
      config.applicationName,
      function (err, version) {
        prevVersion = version;
        cb(err);
      });
  };
  var executeTag = function (cb) {
    var ver = config.packageVersion;
    var tagCommand = 'git tag -a v' + ver + ' -m "[' + ver + '] release" && git push --tags';

    if (config.test) {
      console.log('Tag simulated for: '.bold + ver);
      console.log('Command: '.bold + tagCommand);
      cb();
    } else {
      if (ver === prevVersion) {
        console.log('Version already deployed. Aborting.');
        return cb('Version already deployed.');
      }
      exec(tagCommand, function (err) {
        if (err) {
          console.log('Error tagging build ' + ver + '\n'.bold.red);
          return cb(err);
        }
        console.log('Tag created for: '.bold + ver);
        cb(ver, prevVersion);
      });
    }
  };

  var pushAssets = function (cb) {
    if (config.test) {
      console.log('Asset push simulated for: '.bold + config.packageVersion);
      cb();
      return;
    }

    s3upload.uploadToAllEnvironments({
      prefix: config.applicationName,
      accessKeyId: config.credentials.s3KeyId,
      secretAccessKey: config.credentials.s3SecretKey,
      localDir: 'build'
    }, cb);
  };

  var releaseToDev = function (cb) {
    if (config.test) {
      console.log('Dev release simulated for: '.bold + config.packageVersion);
      cb();
      return;
    }

    tiberius.releaseVersionToDev(
      config.credentials.devApplicationToken,
      config.applicationName,
      config.packageVersion,
      cb);
  };

  var publishDiff = function (cb) {
    if (config.test) {
      console.log('Diff simulated for: '.bold + config.packageVersion);
      cb();
      return;
    }
    tiberius.publishReleaseNotes({
      headline: config.applicationName + ' version ' + config.packageVersion + ' is running on the dev environment. ' +
      '<https://build.managedbyq.com/job/' + config.jenkinsProdDeployJobName + '/build?delay=0sec|Deploy!>',
      repoName: config.repoName,
      firstTag: 'v' + prevVersion,
      secondTag: 'v' + config.packageVersion,
      apiToken: config.credentials.slackToken
    }, cb);
  };

  return {
    devDeploy: function(cb) {
      async.series([getPrevVersion, executeTag, pushAssets, releaseToDev, publishDiff], cb);
    }
  };
};