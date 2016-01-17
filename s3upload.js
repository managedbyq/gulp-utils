'use strict';

var s3 = require('s3');

/**
 *
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.bucket e.g., 'mbq-assets-dev'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 * @returns {{upload: Function}}
 */
module.exports.upload = function (config, cb) {
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
};
