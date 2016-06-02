'use strict';

var aws = require('aws-sdk');
var async = require('async');
var fse = require('fs-extra');
var knox = require('knox');
var mime = require('mime');
var path = require('path');
var MultiPartUpload = require('knox-mpu');
var _ = require('highland');

function isVersionedFile(filename, version) {
  return filename.includes('/' + version + '/');
}

function toUploadParameters(options) {
  return function (obj) {
    var baseName = path.relative(options.localDir, obj.path),
      localFileName = path.join(options.localDir, baseName),
      objectName = baseName,
      headers = {
        'x-amz-acl': 'public-read',
        'content-type': mime.lookup(localFileName)
      };

    if (options.prefix) {
      objectName = path.join(options.prefix, objectName);
    }

    if (isVersionedFile(localFileName, options.version)) {
      headers['cache-control'] = 'max-age=315360000, no-transform, public';
    } else {
      headers['cache-control'] = 'max-age=300, s-maxage=300, no-transform, public';
    }

    return {
      filename: localFileName,
      objectName: objectName,
      headers: headers
    };
  };
}

function toUploadTask(config) {
  return function (uploadParameters) {
    return function (cb) {
      var client = knox.createClient({
        key: config.accessKeyId,
        secret: config.secretAccessKey,
        bucket: config.bucket,
        region: 'us-east-1'
      });

      new MultiPartUpload({
        client: client,
        objectName: uploadParameters.objectName,
        file: uploadParameters.filename,
        headers: uploadParameters.headers
      }, function(err, body) {
        if (err) {
          console.log('WARNING: Failed to upload ' + uploadParameters.filename + ' ' + err);
          return cb(err);
        }

        if (!body.Bucket || !body.Key) {
          console.log('WARNING: Failed to upload ' + uploadParameters.filename +
            ' (Body or Key unset in response): ' + body);
          return cb('Error uploading (Body or Key unset in response)');
        }

        console.log('Uploaded ' + body.Bucket + '/' + body.Key);
        cb(err, body);
      });
    }
  };
}

function runInParallel(taskStream, limit) {
  return _(taskStream)
    .nfcall([])
    .parallel(limit);
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

    s3.putBucketWebsite({Bucket: config.bucket, WebsiteConfiguration: data}, function (err) {
      if (err) {
        return cb(err);
      }
      console.log('Updated redirection rules');
      cb();
    });
  });
}

/**
 * @param version
 * @returns {Function} a reducer that collates items into versioned
 * and unversioned arrays
 */
function collateUploadParameters(version) {
  return function (allUploadParameters) {
    var result = {
      versioned: [],
      unversioned: []
    };

    _(allUploadParameters).each(function(uploadParameters) {
      if (isVersionedFile(uploadParameters.filename, version)) {
        result.versioned.push(uploadParameters);
      } else {
        result.unversioned.push(uploadParameters);
      }
    });

    return result;
  }
}

/**
 * Returns a stream of file upload tasks, containing one item per bucket
 * per item in the uploadParametersList. That is, if there are 3 buckets
 * and 15 items in the uploadParametersList,the returned stream will
 * contain 45 items.
 */
function uploadAll(uploadParametersList, buckets, config) {
  var taskStream = _(buckets)
    .map(function (bucket) {
      var bucketConfig = _.extend(config, {bucket: bucket});
      return _(uploadParametersList)
        .map(toUploadTask(bucketConfig))
        .map(function (task) {
          // if an s3 upload fails, try 3 times before giving up
          return async.retryable(3, task);
        });
    })
    .sequence();
  return runInParallel(taskStream, 25);
}

/**
 * Returns a stream of redirect update tasks, containing one item for
 * each bucket.
 */
function updateAllRedirects(config, buckets) {
  var taskStream = _(buckets)
    .map(function (bucket) {
      var bucketConfig = _.extend(config, {bucket: bucket});
      return function (cb) {
        if (config.redirects) {
          updateRedirects(bucketConfig, cb);
        } else {
          return cb();
        }
      }
    });
  return runInParallel(taskStream, 10);
}

module.exports._isVersionedFile = isVersionedFile;
module.exports._toUploadParameters = toUploadParameters;
module.exports._runInParallel = runInParallel;
module.exports._collateUploadParameters = collateUploadParameters;

/**
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 * @param {string} config.version
 */
module.exports.uploadToAllEnvironments = function (config, cb) {
  module.exports.uploadToBuckets(
    ['mbq-assets-dev', 'mbq-assets-stg', 'mbq-assets-prd'],
    config,
    cb);
};


/**
 * @param {array} buckets
 * @param {string} config.prefix e.g., 'omd' or 'frontend'
 * @param {string} config.accessKeyId
 * @param {string} config.secretAccessKey
 * @param {string} config.localDir
 * @param {object} config.redirects
 * @param {string} config.version
 */
module.exports.uploadToBuckets = function (buckets, config, cb) {
  _(fse.walk(config.localDir))
    .filter(function (data) {
      return data.stats.isFile();
    })
    .map(toUploadParameters(config))
    .collect()
    .map(collateUploadParameters(config.version))
    .flatMap(function (collatedUploadParameters) {
      return _([uploadAll(collatedUploadParameters.versioned, buckets, config),
                uploadAll(collatedUploadParameters.unversioned, buckets, config)]).series();
    })
    .collect()
    .flatMap(function() {
      return updateAllRedirects(config, buckets);
    })
    .collect()
    .toCallback(cb);
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
  }, function (err, data) {
    if (err) {
      return cb(err);
    }
    cb(null, data.Body.toString());
  });
};
