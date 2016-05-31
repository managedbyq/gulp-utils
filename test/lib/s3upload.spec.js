
'use strict'

var _ = require('highland');
var expect = require('chai').expect;
var path = require('path');
var process = require('process');
var stream = require('stream');

var s3upload = require('../../lib/s3upload');

describe('s3upload', function() {
  describe('_isVersionedFile', function() {
    it('returns true if the version is contained in the filename', function() {
      expect(s3upload._isVersionedFile('/foo/216/bar.js', '216')).to.equal(true);
    });

    it('returns false if the version is not contained in the filename', function() {
      expect(s3upload._isVersionedFile('/foo/bar.js', '216')).to.equal(false);
    });
  });

  describe('_toUploadParameters', function() {
    var options, fileObj;

    beforeEach(function() {
      options = { localDir: 'build' };
      fileObj = { path: path.join(process.cwd(), 'build/one/two.js') }
    });

    it('computes the file name as a relative path that includes the local directory', function() {
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.filename).to.equal('build/one/two.js');
    });

    it('computes the object name as a relative path that does not include the local directory', function() {
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.objectName).to.equal('one/two.js');
    });

    it('prepends the prefix (when supplied) to the object name', function() {
      options.prefix = 'foo';
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.objectName).to.equal('foo/one/two.js');
    });

    it('always includes a public read acl header', function() {
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.headers['x-amz-acl']).to.equal('public-read');
    });

    it('includes a header to cache versioned assets for a long time', function() {
      options.version='216';
      fileObj.path = path.join(process.cwd(), 'build/216/one/two.js');
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.headers['cache-control']).to.contain('max-age=315360000');
    });

    it('includes a header to cache non-versioned assets for a short time', function() {
      options.version='216';
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.headers['cache-control']).to.contain('max-age=300');
    });

    it('includes a correct content-type header', function() {
      fileObj.path = path.join(process.cwd(), 'build/one/two.js');
      var result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.headers['content-type']).to.equal('application/javascript');
      fileObj.path = path.join(process.cwd(), 'build/one/two.aaa');
      result = s3upload._toUploadParameters(options)(fileObj);
      expect(result.headers['content-type']).to.equal('application/octet-stream');
    });
  });

  describe('_collateUploadParameters', function() {
    it('correctly separates versioned and unversioned files', function () {
      var result = s3upload._collateUploadParameters('216')([
        {filename: '/foo/216/a.js'},
        {filename: '/foo/unversioned/a.js'},
        {filename: '/foo/216/b.js'}
      ]);
      expect(result.versioned).to.deep.equal([
        {filename: '/foo/216/a.js'},
        {filename: '/foo/216/b.js'}
      ]);
      expect(result.unversioned).to.deep.equal([
        {filename: '/foo/unversioned/a.js'}
      ]);
    });

    it('works if there are no unversioned files', function () {
      var result = s3upload._collateUploadParameters('216')([
        {filename: '/foo/216/a.js'},
        {filename: '/foo/216/b.js'}
      ]);
      expect(result.versioned).to.deep.equal([
        {filename: '/foo/216/a.js'},
        {filename: '/foo/216/b.js'}
      ]);
      expect(result.unversioned).to.deep.equal([]);
    });

    it('works if there are no versioned files', function () {
      var result = s3upload._collateUploadParameters('216')([
        {filename: '/foo/unversioned/a.js'},
      ]);
      expect(result.versioned).to.deep.equal([]);
      expect(result.unversioned).to.deep.equal([
        {filename: '/foo/unversioned/a.js'}
      ]);
    });
  });

  describe('_runInParallel', function() {
    var successCount;
    var successTask = function(cb) { successCount++; cb(); };
    var failureTask = function(cb) { cb('fail'); };

    beforeEach(function() {
      successCount = 0;
    });

    it('runs all the tasks', function(done) {
      s3upload._runInParallel(_([successTask, successTask, successTask]), 2)
        .collect()
        .toCallback(function () {
          expect(successCount).to.equal(3);
          done();
        });
    });

    it('reports success if all tasks finish successfully', function(done) {
      s3upload._runInParallel(_([successTask, successTask, successTask]), 2)
        .collect()
        .toCallback(done);
    });

    it('reports failure if there is an error reading the task stream', function (done) {
      var errorStream = new stream.Readable({
        read: function (n) {
          this.emit('error', 'hi');
        }
      });
      s3upload._runInParallel(errorStream, 2)
        .collect()
        .toCallback(function (err) {
          if (err) {
            done();
          } else {
            done(new Error('error expected but not received'));
          }
        });
    });

    it('reports failure if there is an error executing any task', function (done) {
      s3upload._runInParallel(_([successTask, failureTask, successTask]), 2)
        .collect()
        .toCallback(function (err) {
          if (err) {
            done();
          } else {
            done(new Error('error expected but not received'));
          }
        });
    });
  });
});