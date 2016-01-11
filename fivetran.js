var request = require('request');

module.exports.postBuildResult = function(jobName, buildNumber) {
    var url ='http://requestb.in/12cgbtt1';
    request.post(url, {
        json: {
            jobName: jobName,
            buildNumber: buildNumber,
            completionDate: new Date().toISOString()
        }
    });
};
