'use strict';

/* globals $, window, document, app, ajaxify, socket */

$(document).ready(function () {
	const MAX_INTERVAL = 5000;
	const MIN_INTERVAL = 2500;
	const INTERVAL_STEP = 500;
	const USERS_PER_INTERVAL_INCREASE = 10;

	let interval = MIN_INTERVAL;

	$(window).on('action:ajaxify.end', function () {
		if (ajaxify.data.template.topic && app.user.uid) {
			renderBrowsingUsers();
		}
	});

	function renderBrowsingUsers() {
		if (!ajaxify.data.tid || !ajaxify.data.template.topic) {
			return;
		}

		socket.emit('plugins.browsingUsers.getBrowsingUsers', {
			tid: ajaxify.data.tid,
			composing: !!$('[component="composer"]').length,
		}, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}
			if (!data || !ajaxify.data.template.topic) {
				return;
			}

			var currentUids = data.map(function (user) { return parseInt(user.uid, 10); });

			var alreadyAddedUids = [];
			var browsingUsersEl = $('[component="topic/browsing-users"]');
			// remove any users that are no longer in topic
			browsingUsersEl.find('[data-uid]').each(function () {
				var uid = parseInt($(this).attr('data-uid'), 10);
				if (!currentUids.includes(uid)) {
					$(this).remove();
				} else {
					alreadyAddedUids.push(uid);
				}
			});

			if (noChanges(currentUids, alreadyAddedUids)) {
				showComposing(browsingUsersEl, data);
				startTimeout(currentUids);
				return;
			}

			app.parseAndTranslate('partials/topic/browsing-users', 'browsingUsers', {
				browsingUsers: data,
			}, function (html) {
				var browsingUsersEl = $('[component="topic/browsing-users"]');
				if (!browsingUsersEl.length) {
					return;
				}

				// add any new users
				html.filter('[data-uid]').each(function () {
					var $this = $(this);
					var uid = parseInt($this.attr('data-uid'), 10);
					if (!alreadyAddedUids.includes(uid) && !browsingUsersEl.find('[data-uid=' + uid + ']').length) {
						browsingUsersEl.append($this);
						app.createUserTooltips(browsingUsersEl);
					}
				});

				showComposing(browsingUsersEl, data);

				startTimeout(currentUids);
			});
		});
	}

	function startTimeout(currentUids) {
		interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.floor(currentUids.length / USERS_PER_INTERVAL_INCREASE) * INTERVAL_STEP));
		setTimeout(renderBrowsingUsers, interval);
	}

	function showComposing(browsingUsersEl, data) {
		for (var i = 0, ii = data.length; i < ii; i++) {
			browsingUsersEl.find('[data-uid="' + data[i].uid + '"] a').toggleClass('composing', !!data[i].composing);
		}
	}

	function noChanges(currentUids, alreadyDisplayedUids) {
		if (currentUids.length !== alreadyDisplayedUids.length) {
			return false;
		}

		for (var i = 0; i < currentUids.length; i++) {
			if (currentUids[i] !== alreadyDisplayedUids[i]) {
				return false;
			}
		}
		return true;
	}
});
