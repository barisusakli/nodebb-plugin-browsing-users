
/* globals app, ajaxify, socket */

$(document).ready(function () {
	'use strict';

	var intervalId = 0;
	var pollInProgress = false;

	$(window).on('action:ajaxify.end', function (ev, data) {
		if (ajaxify.data.template.topic) {
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

	function stopPolling() {
		if (intervalId) {
			clearInterval(intervalId);
		}
		pollInProgress = false;
		intervalId = 0;
	}

	function renderBrowsingUsers() {
		if (!ajaxify.data.tid || !ajaxify.data.template.topic) {
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
			if (!data || !ajaxify.data.template.topic) {
				pollInProgress = false;
				return;
			}
			app.parseAndTranslate('partials/topic/browsing-users', 'browsingUsers', {
				browsingUsers: data
			}, function (html) {
				var browsingUsersEl = $('[component="topic/browsing-users"]');
				if (!browsingUsersEl.length) {
					return stopPolling();
				}
				var currentUids = data.map(function(user) { return parseInt(user.uid, 10); });
				var alreadyAddedUids = [];
				// remove any users that are no longer in topic
				browsingUsersEl.find('[data-uid]').each(function () {
					var uid = parseInt($(this).attr('data-uid'), 10);
					if (!currentUids.includes(uid)) {
						$(this).remove();
					} else {
						alreadyAddedUids.push(uid);
					}
				});

				// add any new users
				html.filter('[data-uid]').each(function () {
					var $this = $(this);
					var uid = parseInt($this.attr('data-uid'), 10);
					if (!alreadyAddedUids.includes(uid)) {
						browsingUsersEl.append($this);
						app.createUserTooltips(browsingUsersEl);
					}
				});

				pollInProgress = false;
			});
		});
	}
});
