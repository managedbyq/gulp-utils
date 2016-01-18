
'use strict';

var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var livereload = require('gulp-livereload');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var watchify = require('watchify');

var error;
function handleError(err) {
  if (error !== err.message) {
    console.log(err.message.red);
    error = err.message;
  }
}

module.exports.browserifyHelper = function(inputFile, options) {
  var bundle = browserify(inputFile, options)
    .on('log', function(msg) {
      console.log(options.moduleName.green, msg);
    });

  var rebundle = function(){
    return bundle.bundle()
      .on('error', handleError)
      .pipe(source(inputFile))
      .pipe(buffer())
      .pipe(gulpif(!options.useWatchify, uglify()))
      .pipe(rename(options.moduleName + '.js'))
      .pipe(gulp.dest(options.outputVersionedDir + '/js'))
      .pipe(gulpif(options.useWatchify, livereload()));
  };

  if (options.useWatchify) {
    bundle = watchify(bundle);
    bundle.on('update', rebundle);
  }

  return rebundle();
};

module.exports.runServer = require('./lib/server');
module.exports.tiberius = require('./tiberius');
module.exports.s3upload = require('./s3upload');
