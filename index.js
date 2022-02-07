'use strict';

const LRU = require('lru-cache');
const winston = require.main.require('winston');

const cache = LRU({
	max: 500,
	length: function () { return 1; },
	maxAge: 5000,
});

const groups = require.main.require('./src/groups');
const meta = require.main.require('./src/meta');
const user = require.main.require('./src/user');
const privileges = require.main.require('./src/privileges');
const socketPlugins = require.main.require('./src/socket.io/plugins');
const routeHelpers = require.main.require('./src/routes/helpers');
const socketIO = require.main.require('./src/socket.io');
const widgets = require.main.require('./src/widgets');

const plugin = module.exports;

plugin.init = async function (hookData) {
	routeHelpers.setupAdminPageRoute(hookData.router, '/admin/plugins/browsing-users', hookData.middleware, [], renderAdmin);
};

plugin.addAdminNavigation = async function (menu) {
	menu.plugins.push({
		route: '/plugins/browsing-users',
		icon: 'fa-group',
		name: 'Browsing Users',
	});
	return menu;
};

plugin.filterTopicBuild = async function (hookData) {
	// browsing users are rendered via websockets,
	// this is just here so theme can check for plugin and import partial, see persona topic.tpl
	hookData.templateData.browsingUsers = true;
	return hookData;
};

async function renderAdmin(req, res) {
	const groupsData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	groupsData.sort((a, b) => b.system - a.system);
	res.render('admin/plugins/browsing-users', { groups: groupsData });
}

socketPlugins.browsingUsers = {};
socketPlugins.browsingUsers.getBrowsingUsers = async function (socket, data) {
	const canRead = await privileges.topics.can('read', data.tid, socket.uid);
	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}

	const settings = await getSettings();
	const isVisible = await widgets.checkVisibility(settings, socket.uid);
	if (!isVisible) {
		return [];
	}

	return await getUsersInTopic(socket.uid, data.tid, data.composing);
};

async function getSettings() {
	const _settings = await meta.settings.get('browsing-users');
	const settings = {
		groups: [],
		groupsHideFrom: [],
	};

	try {
		settings.groups = _settings.groups ? JSON.parse(_settings.groups) : [];
		settings.groupsHideFrom = _settings.groupsHideFrom ? JSON.parse(_settings.groupsHideFrom) : [];
	} catch (e) {
		winston.warn('[browsing-users/getSettings] Groups settings are invalid.');
	}

	return { ..._settings, ...settings };
}

function isUserInCache(browsingUsers, uid) {
	if (parseInt(uid, 10) <= 0) {
		return true;
	}
	return browsingUsers.find(user => parseInt(user.uid, 10) === parseInt(uid, 10));
}

async function getUsersInTopic(uid, tid, composing) {
	const browsingUsers = cache.peek('browsing:tid:' + tid) || [];
	let composingUsers = cache.peek('browsing:composing:tid:' + tid) || [];

	if (composing) {
		if (!composingUsers.includes(uid)) {
			composingUsers.push(uid);
		}
	} else {
		composingUsers = composingUsers.filter(x => x !== uid);
	}

	cache.set('browsing:composing:tid:' + tid, composingUsers);

	if (browsingUsers.length && isUserInCache(browsingUsers, uid)) {
		browsingUsers.forEach(function (user) {
			user.composing = composingUsers.includes(user.uid);
		});

		return browsingUsers;
	}

	try {
		const socketids = Array.from(await socketIO.server.in('topic_' + tid).allSockets());
		const roomData = await Promise.all(socketids.map(sid => socketIO.server.of('/').adapter.socketRooms(sid)));

		const uids = {};

		roomData.forEach(function (clientRooms) {
			if (clientRooms && clientRooms.forEach) {
				clientRooms.forEach(function (roomName) {
					if (roomName.startsWith('uid_')) {
						uids[roomName.split('_')[1]] = true;
					}
				});
			}
		});

		if (uid) {
			uids[uid] = true;
		}
		const settings = await meta.settings.get('browsing-users');
		settings.numUsers = Math.min(100, settings.numUsers || 10);

		let userIds = Object.keys(uids).map(x => parseInt(x, 10));

		// bump composing users to the front of the queue
		const intersection = userIds.filter(x => composingUsers.includes(x));
		const remainder = userIds.filter(x => !composingUsers.includes(x));
		userIds = intersection.concat(remainder).slice(0, 100);

		let userData = await user.getUsersFields(userIds, ['uid', 'username', 'userslug', 'picture', 'status']);
		userData = userData.filter(user => user && parseInt(user.uid, 10) > 0 && user.status !== 'offline').slice(0, settings.numUsers);
		userData = await user.blocks.filter(uid, userData);

		userData.forEach(function (user) {
			user.composing = composingUsers.includes(user.uid);
		});

		cache.set('browsing:tid:' + tid, userData);
		return userData;
	} catch (err) {
		if (err.message === 'timeout reached while waiting for clients response') {
			return null;
		}
		throw err;
	}
}
