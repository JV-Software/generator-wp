'use strict';

function getLatestTag(repo, callback) {
    require('simple-git')().listRemote('--tags ' + repo, function (err, tagsList) {
        if (err) {
            return callback(err);
        }

        var gitTags = tagsList.split('\n');

        // Remove last empty element
        gitTags.pop();

        // Ger last element
        var lastTag       = gitTags.pop(),
            latestVersion = /\d\.\d(\.\d)?/ig.exec(lastTag)[0];

        callback(null, latestVersion);
    });
}

module.exports = {
    getLatestTag : getLatestTag
};
