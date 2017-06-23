
/* globals ajaxify, socket */

$(document).ready(function () {
	'use strict';

	var intervalId = 0;

	$(window).on('action:ajaxify.end', function (ev, data) {
		if (data.tpl_url === 'topic') {
			startPolling();
		} else {
			stopPolling();
		}
	});

	function startPolling() {
		var browsingUsersEl = $('[component="topic/browsing-users"]');
		stopPolling();
		intervalId = setInterval(function () {
			if (!ajaxify.data.tid || ajaxify.data.template.name !== 'topic') {
				return stopPolling();
			}
			socket.emit('plugins.browsingUsers.getBrowsingUsers', ajaxify.data.tid, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}
				app.parseAndTranslate('partials/topic/browsing-users', 'browsingUsers', { browsingUsers: data }, function (html) {
					browsingUsersEl.html(html);
					app.createUserTooltips(browsingUsersEl);
				});
			});
		}, 5000);
	}

	function stopPolling() {
		if (intervalId) {
			clearInterval(intervalId);
		}

		intervalId = 0;
	}

});