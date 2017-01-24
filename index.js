
'use strict';

var async = require('async');
var user = require.main.require('./src/user');


var plugin = module.exports;

plugin.onTopicBuild = function(data, callback) {
	if (!data || !data.templateData || !data.templateData.tid) {
		return callback(null, data);
	}
	var io = require.main.require('./src/socket.io').server;

	async.waterfall([
		function (next) {
			io.in('topic_' + data.templateData.tid).clients(next);
		},
		function (socketids, next) {
			async.map(socketids, function (sid, next) {
				io.of('/').adapter.clientRooms(sid, next);
			}, next);
		},
		function (roomData, next) {
			var uids = {};

			roomData.forEach(function(clientRooms) {
				clientRooms.forEach(function (roomName) {
					if (roomName.startsWith('uid_')) {
						uids[roomName.split('_')[1]] = true;
					}
				});
			});

			if (data.req.uid) {
				uids[data.req.uid] = true;
			}

			user.getUsersFields(Object.keys(uids), ['username', 'userslug', 'uid', 'picture'], next);
		},
		function (userData, next) {
			data.templateData.browsingUsers = userData;
			next(null, data);
		}
	], callback);
};



