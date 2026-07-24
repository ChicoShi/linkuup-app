'use strict';
angular.module('LUP').
service('RenderSrvc', function(TypeSrvc, SettingsSrvc, CountrySrvc, EnumSrvc) {

    const RenderSrvc = this;

    RenderSrvc.displaySetting = function (key, value) {
        const setting = SettingsSrvc.setting(key);
        return RenderSrvc.renderClass(setting, value);
    };

    RenderSrvc.renderClass = function(type, value) {
        let r = RenderSrvc.renderClassB(type.type, value);
        if (r === undefined) {
            const types = TypeSrvc.TYPES[type.type];
            for (let c of types) {
                r = RenderSrvc.renderClassB(c, value);
                if (r !== undefined) {
                    break;
                }
            }
        }
        return r;
    };

    RenderSrvc.renderClassB = function(type, value) {
        switch (type) {
            case 'GDO\\Country\\GDT_Country':
                return "<img src=\""  + CountrySrvc.countryURL(value) + "\" alt='"+value+"' /> ";
            case 'GDO\\Core\\GDT_Array':
            case 'GDO\\Core\\GDT_JSON':
                return value;
            case 'GDO\\Date\\GDT_Date':
            case 'GDO\\Date\\GDT_Timestamp':
                if (value === null) {
                    return t('no_data');
                }
                const date = new Date(value);
                const disp = date.toLocaleString();
                return disp;
            case 'GDO\\Core\\GDT_Decimal':
            case 'GDO\\Core\\GDT_Float':
            case 'GDO\\Core\\GDT_ObjectSelect':
            case 'GDO\\Core\\GDT_Int':
            case 'GDO\\Core\\GDT_String': return value;
            case 'GDO\\Core\\GDT_Enum':
                if (value === "0") {
                    return type.options.emptyLabel;
                }
                return window.t(value);
        }
    };

    return RenderSrvc;
});
