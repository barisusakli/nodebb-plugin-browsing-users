'use strict';

/* globals $, app, define */

define('admin/plugins/browsing-users', ['settings'], function (settings) {
	const browsingUsers = {};

	browsingUsers.init = function () {
		const settingsForm = $('.browsing-users-settings');
		settings.load('browsing-users', settingsForm);
		// ugly workaround
		$('option[value="guests"], option[value="spiders"]').hide();

		$('#save').on('click', function () {
			settings.save('browsing-users', settingsForm, function () {
				app.alertSuccess('Settings saved!');
			});
		});
	};

	return browsingUsers;
});
