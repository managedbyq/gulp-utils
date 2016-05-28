'use strict';

var jshint = require('gulp-jshint');
var gulp   = require('gulp');
var childProcess = require('child_process');

gulp.task('jslint', function(){
  return gulp
    .src('*.js')
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('test', function(cb) {
  childProcess.exec('npm test', function(error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (stderr) {
      console.log('stderr: ' + stderr);
    }
    cb(error);
  });
});


gulp.task('default', ['jslint', 'test']);
