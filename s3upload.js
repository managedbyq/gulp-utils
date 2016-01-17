'use strict';

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
  var uploader = client.uploadDir({
    localDir: config.localDir,
    s3Params: {
      ACL: 'public-read',
      Bucket: config.bucket,
      Prefix: config.prefix
    }
  });
  uploader.on('error', cb);
  uploader.on('fileUploadEnd', function (localFilePath, s3Key) {
    console.log('Uploaded ' + config.bucket + '/' + s3Key);
  });
  uploader.on('end', cb);
}

/**
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 */
module.exports.uploadToAllEnvironments = function (config, cb) {
  async.eachSeries(['mbq-assets-dev', 'mbq-assets-stg', 'mbq-assets-prd'], function (bucket, cb) {
    upload(_.extend({bucket: bucket}, config), cb);
  }, cb);
};
