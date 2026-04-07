import { ESetting, TSetting, getStaticFeaturesExperimentalFlag } from '@ws-ui/webform-editor';

const isI18nEnabled = getStaticFeaturesExperimentalFlag('i18n');

const columnSettings: TSetting[] = [
  {
    type: ESetting.DATAGRID,
    key: 'columns',
    label: 'Columns',
    titleProperty: 'title',
    data: [
      {
        label: 'Title',
        defaultValue: '',
        type: isI18nEnabled ? ESetting.I18NFIELD : ESetting.TEXT_FIELD,
        key: 'title',
      },
      {
        label: 'Source',
        type: ESetting.DS_AUTO_SUGGEST,
        key: 'source',
      },
      {
        label: 'Format',
        defaultValue: '',
        type: ESetting.FORMAT_FIELD,
        key: 'format',
        labelClassName: 'mr-4 ml-2 w-16',
        className: 'mb-2',
      },
      {
        label: 'Width',
        type: ESetting.NUMBER_FIELD,
        defaultValue: 150,
        key: 'width',
      },
      {
        label: 'Flex',
        type: ESetting.NUMBER_FIELD,
        defaultValue: 1,
        key: 'flex',
      },
      {
        label: 'Editable',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'editable',
      },
      {
        label: 'Enable Sorting',
        defaultValue: true,
        type: ESetting.CHECKBOX,
        key: 'sorting',
      },
      {
        label: 'Hide column',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'hidden',
      },
    ],
  },
];

const dataAccessSettings: TSetting[] = [
  {
    key: 'datasource',
    label: 'Qodly Source (Collection)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
];

const generalSettings: TSetting[] = [
  {
    key: 'disabled',
    label: 'Disabled',
    type: ESetting.CHECKBOX,
  },
  {
    key: 'classNames',
    label: 'Class',
    type: ESetting.CSSCLASS_SELECTOR,
    placeholder: '.example',
  },
  {
    key: 'style.width',
    label: 'Width',
    type: ESetting.UNITFIELD,
    tags: ['width'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%', 'auto', 'fit-content'],
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'style.height',
    label: 'Height',
    type: ESetting.UNITFIELD,
    tags: ['Height', 'height'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%', 'auto', 'fit-content'],
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'spacing',
    label: 'Spacing',
    type: ESetting.UNITFIELD,
    tags: ['Spacing', 'spacing'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%'],
    defaultValue: '8',
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'accentColor',
    label: 'Accent Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '#2196F3',
  },
  {
    key: 'backgroundColor',
    label: 'Background Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '#FFF',
  },
  {
    key: 'textColor',
    label: 'Text Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '#000',
  },
  {
    key: 'fontSize',
    label: 'Font Size',
    type: ESetting.UNITFIELD,
    tags: ['font-size'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%'],
    defaultValue: '14px',
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'borderColor',
    label: 'Border Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '#e0e0e0',
  },
  {
    key: 'wrapperBorderRadius',
    label: 'Border Radius',
    type: ESetting.UNITFIELD,
    tags: ['border-radius'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%'],
    defaultValue: '4px',
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'rowBorder',
    label: 'Row Border',
    type: ESetting.CHECKBOX,
    defaultValue: true,
  },
  {
    key: 'columnBorder',
    label: 'Column Border',
    type: ESetting.CHECKBOX,
    defaultValue: false,
  },
  {
    key: 'headerBackgroundColor',
    label: 'Header Background Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '',
  },
  {
    key: 'headerTextColor',
    label: 'Header Text Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '',
  },
];

const Settings: TSetting[] = [
  {
    key: 'properties',
    label: 'Properties',
    type: ESetting.GROUP,
    components: columnSettings,
  },
  {
    key: 'dataAccess',
    label: 'Data Access',
    type: ESetting.GROUP,
    components: dataAccessSettings,
  },
  {
    key: 'general',
    label: 'General',
    type: ESetting.GROUP,
    components: generalSettings,
  },
];

export const BasicSettings: TSetting[] = [...dataAccessSettings, ...columnSettings, ...generalSettings];

export default Settings;

