'use strict';

var jshint = require('gulp-jshint');
var gulp   = require('gulp');

gulp.task('jslint', function(){
  return gulp
    .src('*.js')
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('jshint-stylish'))
    .pipe(jshint.reporter('fail'));
});

gulp.task('default', ['jslint']);
