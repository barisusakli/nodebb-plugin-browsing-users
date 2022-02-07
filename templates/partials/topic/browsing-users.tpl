<div component="topic/browsing-users" class="inline-block">
	{{{ each browsingUsers }}}
	<div class="pull-left" data-uid="{browsingUsers.uid}">
		<a href="{{{ if browsingUsers.userslug }}}{config.relative_path}/user/{browsingUsers.userslug}{{{ else }}}#{{{ end }}}">
			{{{ if browsingUsers.picture }}}
			<img class="avatar avatar-sm avatar-rounded" component="user/picture" src="{browsingUsers.picture}" align="left" itemprop="image" title="{browsingUsers.username}"/>
			{{{ else }}}
			<div class="avatar avatar-sm avatar-rounded" component="user/picture" title="{browsingUsers.username}" style="background-color: {browsingUsers.icon:bgColor};">{browsingUsers.icon:text}</div>
			{{{ end }}}
		</a>
	</div>
	{{{ end }}}
</div>