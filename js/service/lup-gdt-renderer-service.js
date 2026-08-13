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
		if (setting.options && setting.options.enumValues) {
			return {control: 'select', source: 'enum'};
		}
		if (/GDT_(Message|Text)$/.test(type)) {
			return {control: 'textarea'};
		}
		if (type === 'GDO\\UI\\GDT_Color') {
			return {control: 'input', input_type: 'color'};
		}
		if (/GDT_(Int|UInt|Float|Decimal)$/.test(type)) {
			return {control: 'input', input_type: 'number'};
		}
		if (/GDT_(Date|DateTime|Birthdate)$/.test(type)) {
			return {control: 'input', input_type: 'date'};
		}
		return {control: 'input', input_type: 'text'};
	};

	return this;
});
