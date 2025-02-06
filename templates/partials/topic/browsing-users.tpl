<label component="topic/browsing-users-label" class="form-label text-muted text-sm hidden">Browsing Users</label>
<div component="topic/browsing-users" class="d-flex gap-1">
	{{{ each browsingUsers }}}
	<div data-uid="{./uid}">
		<a class="text-decoration-none" href="{{{ if ./userslug }}}{config.relative_path}/user/{./userslug}{{{ else }}}#{{{ end }}}">
			{buildAvatar(browsingUsers, "24px", true, "avatar-tooltip")}
			<i class="compose-icon position-absolute fa fa-keyboard pe-none"></i>
		</a>
	</div>
	{{{ end }}}
</div>