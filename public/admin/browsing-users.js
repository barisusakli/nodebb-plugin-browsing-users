define('admin/plugins/browsing-users', ['settings'],  function (settings) {
    var browsingUsers = {};

    browsingUsers.init = function () {
        var settingsForm = $('.browsing-users-settings');
        settings.load('browsing-users', settingsForm);

        $('#save').on('click', function () {
			settings.save('browsing-users', settingsForm, function () {
				app.alertSuccess('Settings saved!');
			});
		});
    };

    return browsingUsers;
});