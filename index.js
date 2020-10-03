'use strict';

const LRU = require('lru-cache');
const util = require('util');

const cache = LRU({
	max: 500,
	length: function () { return 1; },
	maxAge: 2500
});

const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const privileges = require.main.require('./src/privileges');
const socketPlugins = require.main.require('./src/socket.io/plugins');
const routeHelpers = require.main.require('./src/routes/helpers');
const socketIO = require.main.require('./src/socket.io');

const plugin = module.exports;

plugin.init = async function(hookData) {
	routeHelpers.setupAdminPageRoute(hookData.router, '/admin/plugins/browsing-users', hookData.middleware, [], renderAdmin);
};

plugin.addAdminNavigation = async function(menu) {
	menu.plugins.push({
		route: '/plugins/browsing-users',
		icon: 'fa-group',
		name: 'Browsing Users'
	});
	return menu;
};

async function renderAdmin(req, res) {
	res.render('admin/plugins/browsing-users', { });
}

socketPlugins.browsingUsers = {};
socketPlugins.browsingUsers.getBrowsingUsers = async function(socket, data) {
	const canRead = await privileges.topics.can('read', data.tid, socket.uid);
	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}
	return await getUsersInTopic(socket.uid, data.tid, data.composing);
};

function isUserInCache(browsingUsers, uid) {
	if (parseInt(uid, 10) <= 0) {
		return true;
	}
	return browsingUsers.find(user => parseInt(user.uid, 10) === parseInt(uid, 10));
}

const ioClients = util.promisify((room, callback) => socketIO.server.in(room).clients(callback));
const ioClientRooms = util.promisify((sid, callback) => socketIO.server.of('/').adapter.clientRooms(sid, callback));


async function getUsersInTopic(uid, tid, composing) {
	var browsingUsers = cache.peek('browsing:tid:' + tid) || [];
	var composingUsers = cache.peek('browsing:composing:tid:' + tid) || [];
	
	if (composing) {
		if (!composingUsers.includes(uid)) {
			composingUsers.push(uid);
		}
	} else {
		composingUsers = composingUsers.filter(x => x !== uid);
	}

	cache.set('browsing:composing:tid:' + tid, composingUsers)

	if (browsingUsers.length && isUserInCache(browsingUsers, uid)) {
		return browsingUsers;
	}

	try {
		const socketids = await ioClients('topic_' + tid);
		const roomData = await Promise.all(socketids.map(sid => ioClientRooms(sid)));

		var uids = {};

		roomData.forEach(function(clientRooms) {
			clientRooms.forEach(function (roomName) {
				if (roomName.startsWith('uid_')) {
					uids[parseInt(roomName.split('_')[1], 10)] = true;
				}
			});
		});

		if (uid) {
			uids[uid] = true;
		}
		const settings = await meta.settings.get('browsing-users');
		settings.numUsers = Math.min(100, settings.numUsers || 10);

		var userIds = Object.keys(uids).map(function(x) {
			return parseInt(x, 10)
		});
		// bump composing users to the front of the queue
		var intersection = userIds.filter(x => composingUsers.includes(x));
		var remainder = userIds.filter(x => !composingUsers.includes(x));
		userIds = intersection.concat(remainder).slice(0, 100);
		
		let userData = await user.getUsersFields(userIds, ['uid', 'username', 'userslug', 'picture', 'status']);
		userData = userData.filter(user => user && parseInt(user.uid, 10) > 0 && user.status !== 'offline').slice(0, settings.numUsers);
		
		for (var i = 0, ii = composingUsers.length; i < ii; i++) {
			userData[i].composing = true;
		}

		cache.set('browsing:tid:' + tid, userData);
		return userData;
	} catch (err) {
		if (err.message === 'timeout reached while waiting for clients response') {
			return null;
		} else {
			throw err;
		}
	}
}


