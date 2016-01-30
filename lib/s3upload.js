'use strict';

var aws = require('aws-sdk');
var async = require('async');
var s3 = require('s3');
var _ = require('lodash');

/**
 *
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.bucket e.g., 'mbq-assets-dev'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 */
function upload(config, cb) {
  var client = s3.createClient({
    s3Options: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: 'us-east-1'
    }
  });
  var s3Params = {
    ACL: 'public-read',
    Bucket: config.bucket,
    CacheControl: 'max-age=300, s-maxage=300, no-transform, public'
  };
  if (config.prefix) {
    s3Params.Prefix = config.prefix;
  }
  var uploader = client.uploadDir({
    localDir: config.localDir,
    s3Params: s3Params
  });
  uploader.on('error', cb);
  uploader.on('fileUploadEnd', function (localFilePath, s3Key) {
    console.log('Uploaded ' + config.bucket + '/' + s3Key);
  });
  uploader.on('end', cb);
}

/**
 * @param {string} config.bucket
 * @param {string} config.redirects
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 */
function updateRedirects(config, cb) {
  var s3 = new aws.S3({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  });

  s3.getBucketWebsite({Bucket: config.bucket}, function (err, data) {
    if (err) {
      console.log('Error fetching bucket', err);
      return cb(err);
    }

    data.RoutingRules = Object.keys(config.redirects).map(function (from) {
      return {
        'Condition': {'KeyPrefixEquals': from},
        'Redirect': {
          'Protocol': 'https',
          'HostName': config.bucket,
          'ReplaceKeyWith': config.redirects[from]
        }
      };
    });

    s3.putBucketWebsite({Bucket: config.bucket, WebsiteConfiguration: data}, function(err) {
      if (err) {
        return cb(err);
      }
      console.log('Updated redirection rules');
      cb();
    });
  });
}

/**
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 */
module.exports.uploadToAllEnvironments = function (config, cb) {
  module.exports.uploadToBuckets(
    ['mbq-assets-dev', 'mbq-assets-stg', 'mbq-assets-prd'],
    function (bucket, cb) {
      upload(_.extend({bucket: bucket}, config), cb);
    },
    cb);
};


/**
 * @param {array} buckets
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 * @param {object} config.redirects
 */
module.exports.uploadToBuckets = function (buckets, config, cb) {
  var operations = [];
  _.each(buckets, function (bucket) {
    var bucketConfig = _.extend({bucket: bucket}, config);
    operations.push(function (cb) {
      upload(bucketConfig, cb);
    });
    if (config.redirects) {
      operations.push(function (cb) {
        updateRedirects(bucketConfig, cb);
      });
    }
  });
  async.series(operations, cb);
};

/**
 * @param {string} config.bucket
 * @param {string} config.key
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param cb
 */
module.exports.getKeyContent = function (config, cb) {
  var s3 = new aws.S3({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  s3.getObject({
    Bucket: config.bucket,
    Key: config.key
  }, function(err, data) {
    if (err) {
      return cb(err);
    }
    cb(null, data.Body.toString());
  });
};
