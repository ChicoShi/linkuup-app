'use strict';
angular.module('LUP').
service('RenderSrvc', function(TypeSrvc, SettingsSrvc, CountrySrvc, TimezoneSrvc, EnumSrvc) {

    const RenderSrvc = this;

    RenderSrvc.displaySetting = function (key, value) {
        const setting = SettingsSrvc.setting(key);
        return RenderSrvc.renderClass(setting, value);
    };

    RenderSrvc.renderClass = function(type, value) {
        let r = RenderSrvc.renderClassB(type.type, type, value);
        if (r === undefined) {
            const types = TypeSrvc.TYPES[type.type];
            for (let c of types) {
                r = RenderSrvc.renderClassB(c, type, value);
                if (r !== undefined) {
                    break;
                }
            }
        }
        return r ? r : value;
    };

    RenderSrvc.renderClassB = function(klass, type, value) {
        switch (klass) {
            case 'GDO\\Country\\GDT_Country':
                const title = t(`country_${value}`);
                return value ? "<img class=\"profile-country\" src=\""  + CountrySrvc.countryURL(value) + "\" alt='"+title+"' /> " + title : '';
            case 'GDO\\Core\\GDT_Array':
            case 'GDO\\Core\\GDT_JSON':
                return value;
            case 'GDO\\Date\\GDT_Timezone':
                return TimezoneSrvc.renderTimezone(value);
            case 'GDO\\Date\\GDT_Timestamp':
                if (value === null) {
                    return t('no_data');
                }
                const date = new Date(value);
                let disp = '';
                if (type.options.withDate) {
                    disp += ' ' + date.toLocaleDateString();
                }
                if (type.options.withTime) {
                    disp += ' ' + date.toLocaleTimeString();
                }
                if (type.options.withAgo) {
                    if (disp) {
                        disp += ` (${moment(value).fromNow()})`
                    } else {
                        disp = moment(value).fromNow();
                    }
                }
                return disp.trimStart();
            case 'GDO\\Core\\GDT_Decimal':
            case 'GDO\\Core\\GDT_Float':
                if (Number.isNaN(value)) {
                    return '---';
                }
            case 'GDO\\Core\\GDT_ObjectSelect':
            case 'GDO\\Core\\GDT_Int':
            case 'GDO\\Core\\GDT_String': return value;
            case 'GDO\\Core\\GDT_Enum':
                if (value === "0") {
                    return type.options.emptyLabel;
                }
                return window.t(value);
            case 'GDO\\Core\\GDT_Checkbox':
                switch (value) {
                    case '0': return t('no');
                    case '1': return t('yes');
                    case '2': return t('unknown');
                }
        }
    };

    return RenderSrvc;
});
