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
		if (!app.isFocused) {
			return startTimeout([]);
		}
		require(['alerts'], function (alerts) {
			socket.emit('plugins.browsingUsers.getBrowsingUsers', {
				tid: ajaxify.data.tid,
				composing: !!$('[component="composer"]').length,
			}, function (err, data) {
				if (err) {
					return alerts.error(err.message);
				}
				if (!data || !ajaxify.data.template.topic) {
					return;
				}
				data = data.filter(u => !app.user.blocks.includes(u.uid));
				var currentUids = data.map(u => parseInt(u.uid, 10));

				var alreadyAddedUids = [];
				var browsingUsersEl = $('[component="topic/browsing-users"]');
				const labelEl = $('[component="topic/browsing-users-label"]');
				// remove any users that are no longer in topic
				browsingUsersEl.find('>[data-uid]').each(function () {
					var uid = parseInt($(this).attr('data-uid'), 10);
					if (!currentUids.includes(uid)) {
						$(this).remove();
					} else {
						alreadyAddedUids.push(uid);
					}
				});

				if (noChanges(currentUids, alreadyAddedUids)) {
					showComposing(browsingUsersEl, data);
					toggleLabel(labelEl, data);
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
						const existingEl = browsingUsersEl.find('>[data-uid=' + uid + ']');
						if (
							!alreadyAddedUids.includes(uid) &&
							!existingEl.length
						) {
							browsingUsersEl.append($this);
						}
					});

					showComposing(browsingUsersEl, data);
					toggleLabel(labelEl, data);
					startTimeout(currentUids);
				});
			});
		});
	}

	function startTimeout(currentUids) {
		interval = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.floor(currentUids.length / USERS_PER_INTERVAL_INCREASE) * INTERVAL_STEP));
		setTimeout(renderBrowsingUsers, interval);
	}

	function showComposing(browsingUsersEl, users) {
		users.forEach((user) => {
			const userEls = browsingUsersEl.find('>[data-uid="' + user.uid + '"]');
			userEls.each((idx, el) => {
				if (user.composing) {
					const $el = $(el);
					$el.prependTo($el.parent());
				}
			});
			userEls.find('a').toggleClass('composing', !!user.composing);
		});
	}

	function toggleLabel(labelEl, users) {
		labelEl.toggleClass('hidden', !users.length);
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
