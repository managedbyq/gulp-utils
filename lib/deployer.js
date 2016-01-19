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
  var prevVersion, versionToDeploy;

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
        cb(null, ver, prevVersion);
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

  var getDevVersion = function (cb) {
    if (config.test) {
      console.log('Simulating fetch of dev version');
      versionToDeploy = '2.1.6';
      cb(null);
      return;
    }
    tiberius.mostRecentDevRelease(
      config.credentials.devApplicationToken,
      config.applicationName,
      function (err, devVersion) {
        versionToDeploy = devVersion;
        cb(err);
      });
  };

  var getPrevProdVersion = function (cb) {
    if (config.test) {
      console.log('Simulating fetch of prod version');
      prevVersion = '2.1.5';
      cb(null);
      return;
    }
    tiberius.mostRecentProductionRelease(
      config.credentials.prodApplicationToken,
      config.applicationName,
      function (err, version) {
        console.log('Current version on production is ' + version);
        prevVersion = version;
        cb(err);
      });
  };

  var productionDeploy = function (cb) {
    console.log('Deploying version ' + versionToDeploy + ' to production');
    if (config.test) {
      console.log('Simulating production deploy');
      cb(null);
      return;
    }
    tiberius.releaseVersionToPrd(
      config.credentials.prodApplicationToken,
      config.applicationName,
      versionToDeploy,
      cb);
  };

  var stagingDeploy = function (cb) {
    console.log('Deploying version ' + versionToDeploy + ' to staging');
    if (config.test) {
      console.log('Simulating staging deploy');
      cb(null);
      return;
    }
    tiberius.releaseVersionToStg(
      config.credentials.stgApplicationToken,
      config.applicationName,
      versionToDeploy,
      cb);
  };

  var publishProductionDiff = function (cb) {
    if (config.test) {
      console.log('Simulating publishing of diff between ' + prevVersion + ' and ' + versionToDeploy);
      cb(null);
      return;
    }
    console.log('Publishing diff between ' + prevVersion + ' and ' + versionToDeploy);
    tiberius.publishReleaseNotes({
      headline: config.applicationName + 'version ' + versionToDeploy + ' deployed to production',
      repoName: config.applicationName,
      firstTag: 'v' + prevVersion,
      secondTag: 'v' + versionToDeploy,
      apiToken: config.credentials.slackToken
    }, cb);
  };

  var notifyDevOfProductionDeploy = function (cb) {
    tiberius.sendSlackMessage(
      {
        apiToken: config.credentials.slackToken,
        channel: '#dev',
        message: '*' + config.applicationName + ' version ' + versionToDeploy + ' deployed to production*',
        test: config.test
      },
      cb);
  };

  var notifyDevOfStagingDeploy = function (cb) {
    tiberius.sendSlackMessage(
      {
        apiToken: config.credentials.slackToken,
        channel: '#dev',
        message: '*' + config.applicationName + ' version ' + versionToDeploy + ' deployed to staging*',
        test: config.test
      },
      cb);
  };

  var notifyDevCIOfStagingDeploy = function (cb) {
    tiberius.sendSlackMessage(
      {
        apiToken: config.credentials.slackToken,
        message: '*' + config.applicationName + ' version ' + versionToDeploy + ' deployed to staging*',
        test: config.test
      },
      cb);
  };


  return {
    devDeploy: function (cb) {
      async.series([getPrevVersion, executeTag, pushAssets, releaseToDev, publishDiff], cb);
    },
    prodDeploy: function (version, cb) {
      versionToDeploy = version;
      var steps = [
        getPrevProdVersion,
        productionDeploy,
        publishProductionDiff,
        notifyDevOfProductionDeploy,
        stagingDeploy,
        notifyDevCIOfStagingDeploy,
        notifyDevOfStagingDeploy
      ];

      if (!versionToDeploy) {
        steps.unshift(getDevVersion);
      }

      async.series(steps, cb);
    }
  };
};