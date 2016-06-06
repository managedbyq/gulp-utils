#! /usr/bin/env node

'use strict';

var s3upload = require('./s3upload');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));

var buckets = {
  marketing: {
    dev: 'dev.mbq.io',
    stg: 'stg.mbq.io',
    prod: 'managedbyq.com'
  },
  harrison: {
    dev: 'harrison.dev.mbq.io',
    stg: 'harrison.stg.mbq.io',
    prod: 'harrison.managedbyq.com'
  }
};

var s3Config = {};
if (fs.existsSync(process.env.HOME + '/.q')) {
  var ops = require(process.env.HOME + '/.q');
  s3Config = ops.aws || {};
}

s3upload.getKeyContent({
  bucket: buckets[argv.app][argv.env],
  key: 'version.json',
  accessKeyId: s3Config.key,
  secretAccessKey: s3Config.secret
}, function(err, json) {
  var version = JSON.parse(json).version;
  console.log(version);
});
