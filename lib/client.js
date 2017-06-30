
/* globals app, ajaxify, socket */

$(document).ready(function () {
	'use strict';

	var intervalId = 0;

	var pollInProgress = false;

	$(window).on('action:ajaxify.end', function (ev, data) {
		if (data.tpl_url === 'topic') {
			startPolling();
		} else {
			stopPolling();
		}
	});

	function startPolling() {
		stopPolling();
		intervalId = setInterval(function () {
			if (!ajaxify.data.tid || ajaxify.data.template.name !== 'topic') {
				return stopPolling();
			}
			if (pollInProgress) {
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
		}, 5000);
	}

	function stopPolling() {
		if (intervalId) {
			clearInterval(intervalId);
		}
		pollInProgress = false;
		intervalId = 0;
	}

});