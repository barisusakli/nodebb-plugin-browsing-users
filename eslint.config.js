'use strict';
const serverConfig = require('eslint-config-nodebb');
const publicConfig = require('eslint-config-nodebb/public');

const { configs } = require('@eslint/js');

module.exports = [
	configs.recommended,
	...publicConfig,
	...serverConfig,
];

