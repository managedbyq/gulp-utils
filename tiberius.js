var async = require('async');
var git = require('simple-git');
var NodeGit = require('NodeGit');
var _ = require('lodash');

function fullCommitMessage(hash, cb) {
    NodeGit.Repository.open(process.cwd())
        .then(function(repo) {
            return repo.getCommit(hash);
        })
        .then(function(commit) {
            cb(null, commit.message());
        })
        .catch(function(err) {
            cb(err);
        });
}

module.exports.releaseNotes = function(firstTag, secondTag, cb) {
    var linkTemplate = _.template('https://github.com/managedbyq/os-core/pull/<%= num %>/files');
    var lineTemplate = _.template('\u2022 (<%= author %>) <%= description %> - <<%= link %>|github>');
    git(process.cwd()).log({from: firstTag, to: secondTag}, function (err, log) {
        if (err) {
            cb(err);
        }

        var prCommits = _.filter(log.all, function(commit) {
            return commit.message.startsWith("Merge pull request");
        });

        async.parallel(_.map(prCommits, function(commit) {
            return function(cb) {
                fullCommitMessage(commit.hash.substr(1), function (err, message) {
                    if (err) {
                        cb(err);
                    }
                    var prNumber = message.match(/Merge pull request #(\d+)/)[1];
                    var description = message.split('\n', 3)[2];

                    var link = linkTemplate({num: prNumber});
                    var line = lineTemplate({author: commit.author_name, description: description, link: link});
                    cb(null, line);
                });
            }
        }), function(err, results) {
            if (err) {
                cb(err);
            }
            cb(null, results.join('\n'));
        });
    });
};
