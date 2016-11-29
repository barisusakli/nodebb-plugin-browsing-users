
'use strict';

var async = require.main.require('async');
var plugin = module.exports;

plugin.onTopicBuild = function(data, callback) {
	if (!data || !data.templateData || !data.templateData.tid) {
		return callback(null, data);
	}
	var io = require.main.require('./src/socket.io').server;

	io.in('topic_' + data.templateData.tid).clients(function (err, socketids) {
		if (err) {
			return callback(err);
		}

		async.map(socketids, function (sid, next) {
			io.of('/').adapter.clientRooms(sid, next);
		}, function (err, roomData) {
			if (err) {
				return callback(err);
			}
			var uids = {};

			roomData.forEach(function(clientRooms) {
				clientRooms.forEach(function (roomName) {
					if (roomName.startsWith('uid_')) {
						uids[roomName.split('_')[1]] = true;
					}
				});
			});

			data.templateData.browsingUsers = Object.keys(uids);
			callback(null, data);
		});
	});
};



