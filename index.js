'use strict';

var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var exec = require('child_process').exec;
var fs = require('fs');
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

module.exports.browserifyHelper = function (inputFile, options) {
  var bundle = browserify(inputFile, options)
    .on('log', function (msg) {
      console.log(options.moduleName.green, msg);
    });

  var rebundle = function () {
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

var BUMP_BRANCH = 'automation/bump';
var MAIN_BRANCH = 'master';

module.exports.bumpVersion = function (packageConfigPath, cb) {

  if (isSameCommitHash('origin/' + MAIN_BRANCH, 'origin/' + BUMP_BRANCH)) {
    console.log('Bump commit already created, aborting.');
    return cb();
  }

  var packageConfig = require(packageConfigPath);
  var versionArray = packageConfig.version.split('.');
  // increment patch version
  versionArray[2] = parseInt(versionArray[2], 10) + 1;
  packageConfig.version = versionArray.join('.');
  fs.writeFile(packageConfigPath, JSON.stringify(packageConfig, null, 2), function (err) {
    if (err) {
      console.log('Error writing to \'package.json\'\n'.bold.red);
      return cb(err);
    }

    var commitCommand = 'git add package.json && git commit -m "[bump] ' + packageConfig.version + '"';

    exec(commitCommand, function (err) {
      if (err) {
        console.log('Error commiting changes to \'package.json\'\n'.bold.red);
        return cb(err);
      }

      var commands = [
        'git branch -f ' + MAIN_BRANCH + ' HEAD',   //Set main branch head to detached head
        'git branch -f ' + BUMP_BRANCH + ' HEAD',   //Set bump branch head to detached head
        'git push origin ' + MAIN_BRANCH,           //Will fail if origin branch has changes (intended)
        'git push -f origin ' + BUMP_BRANCH,        //This can be forced if preceding succeeds
      ];
      exec(commands.join(' && '), function (err, stdout) {
        if (err) {
          var out = String(stdout);
          console.log(out);

          var log = String(execSync('git log -3'));
          console.log(log);

          console.log('Error pushing bump commits'.bold.red);
          return cb(err);
        }

        cb();
      });
    });
  });
};

module.exports.deployer = require('./lib/deployer');
module.exports.runServer = require('./lib/server');
module.exports.tiberius = require('./lib/tiberius');
module.exports.s3upload = require('./lib/s3upload');
