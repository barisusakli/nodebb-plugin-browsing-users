'use strict';

var async = require('async');
var LRU = require('lru-cache');

var cache = LRU({
	max: 500,
	length: function () { return 1; },
	maxAge: 10000
});

var user = require.main.require('./src/user');
var privileges = require.main.require('./src/privileges');
var socketPlugins = require.main.require('./src/socket.io/plugins');

var plugin = module.exports;

plugin.onTopicBuild = function(data, callback) {
	if (!data || !data.templateData || !data.templateData.tid) {
		return callback(null, data);
	}

	async.waterfall([
		function (next) {
			getUsersInTopic(data.req.uid, data.templateData.tid, next);
		},
		function (userData, next) {
			data.templateData.browsingUsers = userData;
			next(null, data);
		},
	], callback);
};

socketPlugins.browsingUsers = {};
socketPlugins.browsingUsers.getBrowsingUsers = function(socket, tid, callback) {
	async.waterfall([
		function (next) {
			privileges.topics.can('read', tid, socket.uid, next);
		},
		function (canRead, next) {
			if (!canRead) {
				return next(new Error('[[error:no-privileges]]'));
			}
			getUsersInTopic(socket.uid, tid, next);
		},
	], callback);
};

function isUserInCache(browsingUsers, uid) {
	if (!parseInt(uid, 10)) {
		return true;
	}
	return browsingUsers.find(function (user) {
		return parseInt(user.uid, 10) === parseInt(uid, 10);
	});
}

function getUsersInTopic(uid, tid, callback) {
	var browsingUsers = cache.peek('browsing:tid:' + tid);
	if (browsingUsers && isUserInCache(browsingUsers, uid)) {
		return setImmediate(callback, null, browsingUsers);
	}

	var io = require.main.require('./src/socket.io').server;
	async.waterfall([
		function (next) {
			io.in('topic_' + tid).clients(next);
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

			if (uid) {
				uids[uid] = true;
			}

			var userIds = Object.keys(uids).slice(0, 100);
			user.getUsersFields(userIds, ['uid', 'username', 'userslug', 'picture', 'status'], next);
		},
		function (userData, next) {
			userData = userData.filter(function (user) {
				return user && parseInt(user.uid, 10) > 0 && user.status !== 'offline';
			}).slice(0, 10);
			cache.set('browsing:tid:' + tid, userData);
			next(null, userData);
		},
	], function (err, userData) {
		if (err) {
			if (err.message === 'timeout reached while waiting for clients response') {
				return callback(null, null);
			} else {
				return callback(err);
			}
		}
		callback(null, userData)
	});
}


