
'use strict';

var async = require.main.require('async');
var plugin = module.exports;

plugin.onTopicBuild = function(data, callback) {
	if (!data || !data.templateData || !data.templateData.tid) {
		return callback(null, data);
	}
	var websockets = require.main.require('./src/socket.io');
	websockets.server.in('topic_' + data.templateData.tid).clients(function (err, socketids) {
		if (err) {
			return callback(err);
		}

		// TODO: use .clientRooms() to turn socketids to uids
		// https://github.com/socketio/socket.io-redis/pull/146
		data.browsingUsers = socketids;
		callback(null, data);
	});
};



