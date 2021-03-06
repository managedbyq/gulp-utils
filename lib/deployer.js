'use strict';

var async = require('async');
var fs = require('fs');
var exec = require('child_process').exec;
var s3upload = require('./s3upload');
var tiberius = require('./tiberius');

/**
 *
 * @param config.test {boolean}
 * @param config.applicationName {string}
 * @param config.repoName {string}
 * @param config.jenkinsProdDeployJobName {string}
 * @param config.localVersion {string}
 * @param config.staticSite.devS3Bucket
 * @param config.staticSite.prodS3Bucket
 * @param config.staticSite.redirects
 * @param config.credentials.prodApplicationToken {string}
 * @param config.credentials.devApplicationToken {string}
 * @param config.credentials.s3KeyId {string}
 * @param config.credentials.s3SecretKey {string}
 * @returns {{}}
 */
module.exports.create = function (config) {
  var versionToDeploy;

  var pushAssets = function (cb) {
    if (config.test) {
      console.log('Asset push simulated for: '.bold + config.localVersion);
      cb();
      return;
    }

    s3upload.uploadToBuckets(['mbq-assets-prd'], {
      prefix: config.applicationName,
      accessKeyId: config.credentials.s3KeyId,
      secretAccessKey: config.credentials.s3SecretKey,
      localDir: 'build',
      version: config.localVersion
    }, cb);
  };

  var pushDevStaticAssets = function (cb) {
    if (config.test) {
      console.log('Asset push simulated for: '.bold + config.localVersion);
      cb();
      return;
    }

    s3upload.uploadToBuckets([config.staticSite.devS3Bucket], {
      accessKeyId: config.credentials.s3KeyId,
      secretAccessKey: config.credentials.s3SecretKey,
      localDir: 'build',
      redirects: config.staticSite.redirects,
      version: config.localVersion
    }, cb);
  };

  var pushProdStaticAssets = function (cb) {
    if (config.test) {
      console.log('Asset push simulated for: '.bold + config.localVersion);
      cb();
      return;
    }

    s3upload.uploadToBuckets([config.staticSite.prodS3Bucket], {
      accessKeyId: config.credentials.s3KeyId,
      secretAccessKey: config.credentials.s3SecretKey,
      localDir: 'build',
      redirects: config.staticSite.redirects,
      version: config.localVersion
    }, cb);
  };

  var releaseToDev = function (cb) {
    if (config.test) {
      console.log('Dev release simulated for: '.bold + config.localVersion);
      cb();
      return;
    }

    tiberius.releaseVersionToDev(
      config.credentials.devApplicationToken,
      config.applicationName,
      config.localVersion,
      cb);
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

  var getStaticVersion = function (env, bucket, cb) {
    if (config.test) {
      console.log('Simulating fetch of ' + env + ' version');
      cb(null, '2.1.5');
      return;
    }

    s3upload.getKeyContent({
      accessKeyId: config.credentials.s3KeyId,
      secretAccessKey: config.credentials.s3SecretKey,
      bucket: bucket,
      key: 'version.json'
    }, function (err, json) {
      if (err) {
        return cb(err);
      }
      var version = JSON.parse(json).version;
      console.log('Current version on ' + env + ' is ' + version);
      cb(null, version);
    });
  };

  var getDevStaticVersion = function(cb) {
    getStaticVersion('dev', config.staticSite.devS3Bucket, function (err, version) {
      versionToDeploy = version;
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

  var writeVersionJson = function(cb) {
    fs.writeFile('build/version.json', JSON.stringify({'version': config.localVersion}), cb);
  };

  return {
    writeVersionJson: writeVersionJson,

    devDeploy: function (cb) {
      async.series([pushAssets, releaseToDev], cb);
    },
    releaseToDev: releaseToDev,
    prodDeploy: function (version, cb) {
      versionToDeploy = version;
      var steps = [productionDeploy];

      if (!versionToDeploy) {
        steps.unshift(getDevVersion);
      }

      async.series(steps, cb);
    },
    devStaticDeploy: function (cb) {
      async.series(
        [writeVersionJson, pushDevStaticAssets],
        cb);
    },
    prodStaticDeploy: function (version, cb) {
      versionToDeploy = version;
      var steps = [writeVersionJson, pushProdStaticAssets];

      if (!versionToDeploy) {
        steps.unshift(getDevStaticVersion);
      }
      async.series(steps, cb);
    }
  };
};
