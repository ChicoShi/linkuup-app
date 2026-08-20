"use strict";
angular.module('LUP').
service('GDTRendererSrvc', function() {

	this.forSetting = function(setting) {
		var type = setting.type || '';
		if (/GDT_Checkbox$/.test(type)) {
			return {control: 'checkbox'};
		}
		if (type === 'GDO\\Country\\GDT_Country') {
			return {control: 'select', source: 'countries'};
		}
		if (type === 'GDO\\Language\\GDT_Language') {
			return {control: 'select', source: 'languages'};
		}
		if (type === 'GDO\\Date\\GDT_Timezone') {
			return {control: 'select', source: 'timezones'};
		}
		if (setting.options && setting.options.enumValues) {
			return {control: 'select', source: 'enum'};
		}
		if (/GDT_(Message|Text)$/.test(type)) {
			return {control: 'textarea'};
		}
		if (type === 'GDO\\UI\\GDT_Color') {
			return {control: 'input', input_type: 'color'};
		}
		if (type === 'GDO\\Contact\\GDT_WhatsApp') {
			return {control: 'input', input_type: 'tel'};
		}
		if (/GDT_(Int|UInt|Float|Decimal|Level|PersonHeight)$/.test(type)) {
			return {control: 'input', input_type: 'number'};
		}
		if (/GDT_Time$/.test(type)) {
			return this.dateRenderer(setting, 'time');
		}
		if (/GDT_DateTime$/.test(type)) {
			return this.dateRenderer(setting, 'datetime-local');
		}
		if (/GDT_(Date|Birthdate)$/.test(type)) {
			return this.dateRenderer(setting, 'date');
		}
		if (/GDT_Timestamp$/.test(type)) {
			var options = setting.options || {};
			return this.dateRenderer(setting,
				options.withDate && options.withTime ? 'datetime-local' :
				options.withDate ? 'date' : 'time');
		}
		return {control: 'input', input_type: 'text'};
	};

	this.dateRenderer = function(setting, inputType) {
		var options = setting.options || {};
		return {
			control: 'input',
			input_type: inputType,
			min: this.dateValue(options.minDate, inputType),
			max: this.dateValue(options.maxDate, inputType),
		};
	};

	this.valueForSetting = function(setting, value) {
		if (!setting.renderer || setting.renderer.input_type === undefined) {
			return value;
		}
		return this.dateValue(value, setting.renderer.input_type);
	};

	this.dateValue = function(value, inputType) {
		if (value === null || value === undefined || value === '') {
			return value;
		}
		var date = String(value).replace('T', ' ');
		if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
			return value;
		}
		if (inputType === 'date') {
			return date.slice(0, 10);
		}
		if (inputType === 'time') {
			return date.length >= 16 ? date.slice(11, 16) : date;
		}
		if (inputType === 'datetime-local') {
			return date.slice(0, 16).replace(' ', 'T');
		}
		return value;
	};

	return this;
});
