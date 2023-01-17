<div component="topic/browsing-users" class="d-flex gap-1">
	{{{ each browsingUsers }}}
	<div data-uid="{./uid}">
		<a href="{{{ if ./userslug }}}{config.relative_path}/user/{./userslug}{{{ else }}}#{{{ end }}}">
			{buildAvatar(browsingUsers, "24px", true)}
		</a>
	</div>
	{{{ end }}}
</div>