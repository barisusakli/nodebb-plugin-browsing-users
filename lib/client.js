
/* globals app, ajaxify, socket */

$(document).ready(function () {
	'use strict';

	var intervalId = 0;

	var pollInProgress = false;

	$(window).on('action:ajaxify.end', function (ev, data) {
		if (data.tpl_url === 'topic') {
			renderBrowsingUsers();
			startPolling();
		} else {
			stopPolling();
		}
	});

	function startPolling() {
		if (app.user.uid <= 0) {
			return;
		}
		stopPolling();
		intervalId = setInterval(renderBrowsingUsers, 5000);
	}

	function renderBrowsingUsers() {
		if (!ajaxify.data.tid || ajaxify.data.template.name !== 'topic') {
			return stopPolling();
		}
		if (pollInProgress || app.user.uid <= 0) {
			return;
		}
		pollInProgress = true;
		socket.emit('plugins.browsingUsers.getBrowsingUsers', ajaxify.data.tid, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}
			if (!data) {
				pollInProgress = false;
				return;
			}
			app.parseAndTranslate('partials/topic/browsing-users', 'browsingUsers', { browsingUsers: data }, function (html) {
				var browsingUsersEl = $('[component="topic/browsing-users"]');
				browsingUsersEl.html(html);
				app.createUserTooltips(browsingUsersEl);
				pollInProgress = false;
			});
		});
	}

	function stopPolling() {
		if (intervalId) {
			clearInterval(intervalId);
		}
		pollInProgress = false;
		intervalId = 0;
	}
});
