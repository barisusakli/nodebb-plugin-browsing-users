'use strict';

const LRU = require('lru-cache');
const util = require('util');

const cache = LRU({
	max: 500,
	length: function () { return 1; },
	maxAge: 5000
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
socketPlugins.browsingUsers.getBrowsingUsers = async function(socket, tid) {
	const canRead = await privileges.topics.can('read', tid, socket.uid);
	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}
	return await getUsersInTopic(socket.uid, tid);
};

function isUserInCache(browsingUsers, uid) {
	if (parseInt(uid, 10) <= 0) {
		return true;
	}
	return browsingUsers.find(user => parseInt(user.uid, 10) === parseInt(uid, 10));
}

const ioClients = util.promisify((room, callback) => socketIO.server.in(room).clients(callback));
const ioClientRooms = util.promisify((sid, callback) => socketIO.server.of('/').adapter.clientRooms(sid, callback));

async function getUsersInTopic(uid, tid) {
	var browsingUsers = cache.peek('browsing:tid:' + tid);
	if (browsingUsers && isUserInCache(browsingUsers, uid)) {
		return browsingUsers;
	}

	try {
		const socketids = await ioClients('topic_' + tid);
		const roomData = await Promise.all(socketids.map(sid => ioClientRooms(sid)));

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
		const settings = await meta.settings.get('browsing-users');
		settings.numUsers = Math.min(100, settings.numUsers || 10);

		const userIds = Object.keys(uids).slice(0, 100);
		let userData = await user.getUsersFields(userIds, ['uid', 'username', 'userslug', 'picture', 'status']);
		userData = userData.filter(user => user && parseInt(user.uid, 10) > 0 && user.status !== 'offline').slice(0, settings.numUsers);
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


