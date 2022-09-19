<div component="topic/browsing-users" class="d-inline-block">
	{{{ each browsingUsers }}}
	<div class="float-start" data-uid="{browsingUsers.uid}">
		<a href="{{{ if browsingUsers.userslug }}}{config.relative_path}/user/{browsingUsers.userslug}{{{ else }}}#{{{ end }}}">
			{buildAvatar(browsingUsers, "24px", true)}
		</a>
	</div>
	{{{ end }}}
</div>