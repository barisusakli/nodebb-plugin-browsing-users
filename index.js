'use strict';

const { LRUCache } = require('lru-cache');
const winston = require.main.require('winston');

const cache = new LRUCache({
	max: 500,
	ttl: 5000,
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
	routeHelpers.setupAdminPageRoute(hookData.router, '/admin/plugins/browsing-users', renderAdmin);
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
	res.render('admin/plugins/browsing-users', {
		groups: groupsData,
		title: 'Browsing Users',
	});
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

	return await getUsersInTopic(socket, data, settings);
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

async function getUsersInTopic(socket, data, settings) {
	const uid = socket.uid;
	const { tid, composing } = data;
	const browsingUsers = cache.get('browsing:tid:' + tid) || [];
	const composingUids = [];
	socket.data.composing = composing ? Date.now() + 5000 : 0;

	if (browsingUsers.length && isUserInCache(browsingUsers, uid)) {
		return browsingUsers;
	}

	try {
		const sockets = await socketIO.server.in(`topic_${tid}`).fetchSockets();
		const uids = {};
		for (const s of sockets) {
			if (s.data.uid > 0) {
				uids[s.data.uid] = 1;
				if (s.data.composing && s.data.composing > Date.now() && !composingUids.includes(s.data.uid)) {
					composingUids.push(s.data.uid);
				}
			}
		}

		settings.numUsers = Math.min(100, settings.numUsers || 10);

		let userIds = Object.keys(uids).map(uid => parseInt(uid, 10));

		// bump composing users to the front of the queue
		const intersection = userIds.filter(uid => composingUids.includes(uid));
		const remainder = userIds.filter(uid => !composingUids.includes(uid));
		userIds = intersection.concat(remainder).slice(0, 100);

		let userData = await user.getUsersFields(userIds, [
			'uid', 'username', 'userslug', 'picture', 'status',
		]);
		userData = userData.filter(
			u => u && u.uid > 0 && u.status !== 'offline'
		).slice(0, settings.numUsers);

		userData.forEach(function (user) {
			user.composing = composingUids.includes(user.uid);
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
