'use strict';

/* globals $, define */

define('admin/plugins/browsing-users', ['settings', 'alerts'], function (settings, alerts) {
	const browsingUsers = {};

	browsingUsers.init = function () {
		const settingsForm = $('.browsing-users-settings');
		settings.load('browsing-users', settingsForm);
		// ugly workaround
		$('option[value="guests"], option[value="spiders"]').hide();

		$('#save').on('click', function () {
			settings.save('browsing-users', settingsForm, function () {
				alerts.success('Settings saved!');
			});
		});
	};

	return browsingUsers;
});
