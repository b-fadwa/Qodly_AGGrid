import { ESetting, TSetting } from '@ws-ui/webform-editor';
import { validateServerSide } from '@ws-ui/shared';

const commonSettings: TSetting[] = [
  {
    type: ESetting.DATAGRID,
    key: 'columns',
    label: 'Columns',
    titleProperty: 'title',
    data: [
      {
        label: 'Title',
        defaultValue: '',
        type: ESetting.TEXT_FIELD,
        key: 'title',
      },
      {
        label: 'Source',
        // defaultValue: '',
        type: ESetting.DS_AUTO_SUGGEST,
        // datasourceProperty: 'datasource',
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
        label: 'Enable Sorting',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'sorting',
      },
      {
        label: 'Enable filtering',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'filtering',
      },
      {
        label: 'Hide column',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'hidden',
      },
      {
        label: 'Locked Position',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'locked',
      },
      {
        label: 'Enable Sizing',
        defaultValue: true,
        type: ESetting.CHECKBOX,
        key: 'sizing',
      },
    ],
  },
];

const dataAccessSettings: TSetting[] = [
  {
    key: 'datasource',
    label: 'Qodly Source',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'currentElement',
    label: 'Selected Element',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'currentSelection',
    label: 'Selected Selection',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'multiSelection',
    label: 'Enable Multi-Selection',
    type: ESetting.CHECKBOX,
    defaultValue: false,
  },
  {
    key: 'state',
    label: 'State Source',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'saveLocalStorage',
    label: 'Save In Local Storage',
    type: ESetting.CHECKBOX,
    defaultValue: false,
  },
  {
    key: 'serverSideRef',
    label: 'Server Side',
    type: ESetting.TEXT_FIELD,
    hasError: validateServerSide,
    validateOnEnter: true,
  },
];

const basicSettings: TSetting[] = [
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
    units: [
      'px',
      'em',
      'rem',
      'vw',
      'vh',
      'pt',
      '%',
      'auto',
      'none',
      'unset',
      'inherit',
      'fit-content',
    ],
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'style.height',
    label: 'Height',
    type: ESetting.UNITFIELD,
    tags: ['Height', 'height'],
    units: [
      'px',
      'em',
      'rem',
      'vw',
      'vh',
      'pt',
      '%',
      'auto',
      'none',
      'unset',
      'inherit',
      'fit-content',
    ],
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
    key: 'oddRowBackgroundColor',
    label: 'Odd Row Background Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '#21222C',
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
    defaultValue: '0',
    hasLabel: true,
    isSmallInput: true,
  },
  { key: 'rowBorder', label: 'Row Border', type: ESetting.CHECKBOX, defaultValue: true },
  { key: 'columnBorder', label: 'Column Border', type: ESetting.CHECKBOX, defaultValue: false },
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
    key: 'enableColumnHover',
    label: 'Enable Column Hover',
    type: ESetting.CHECKBOX,
    defaultValue: true,
  },
  {
    key: 'enableCellFocus',
    label: 'Enable Cell Focus',
    type: ESetting.CHECKBOX,
    defaultValue: true,
  },
  {
    key: 'style.width',
    label: 'Width',
    type: ESetting.UNITFIELD,
    tags: ['width'],
    units: [
      'px',
      'em',
      'rem',
      'vw',
      'vh',
      'pt',
      '%',
      'auto',
      'none',
      'unset',
      'inherit',
      'fit-content',
    ],
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'style.height',
    label: 'Height',
    type: ESetting.UNITFIELD,
    tags: ['Height', 'height'],
    units: [
      'px',
      'em',
      'rem',
      'vw',
      'vh',
      'pt',
      '%',
      'auto',
      'none',
      'unset',
      'inherit',
      'fit-content',
    ],
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
];

const borderSettings: TSetting[] = [
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
    defaultValue: '0',
    hasLabel: true,
    isSmallInput: true,
  },
  { key: 'rowBorder', label: 'Row Border', type: ESetting.CHECKBOX, defaultValue: true },
  { key: 'columnBorder', label: 'Column Border', type: ESetting.CHECKBOX, defaultValue: false },
];

const headerSettings: TSetting[] = [
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
  {
    key: 'headerVerticalPaddingScale',
    label: 'Header Vertical Padding Scale',
    type: ESetting.NUMBER_FIELD,
    defaultValue: 1,
  },
  {
    key: 'headerColumnBorder',
    label: 'Header Column Border',
    type: ESetting.CHECKBOX,
    defaultValue: false,
  },
  {
    key: 'headerFontSize',
    label: 'Header Font Size',
    type: ESetting.UNITFIELD,
    tags: ['font-size'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%'],
    defaultValue: '14px',
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'headerFontWeight',
    label: 'Header Font Weight',
    type: ESetting.SELECT,
    defaultValue: 700,
    options: [
      { label: '400', value: '400' },
      { label: '500', value: '500' },
      { label: '600', value: '600' },
      { label: '700', value: '700' },
      { label: '800', value: '800' },
      { label: '900', value: '900' },
    ],
  },
];

const cellSettings: TSetting[] = [
  {
    key: 'oddRowBackgroundColor',
    label: 'Odd Row Background Color',
    type: ESetting.COLOR_PICKER,
    defaultValue: '#21222C',
  },
  {
    key: 'cellHorizontalPaddingScale',
    label: 'Cell Horizontal Padding Scale',
    type: ESetting.NUMBER_FIELD,
    defaultValue: 1,
  },
  {
    key: 'rowVerticalPaddingScale',
    label: 'Row Vertical Padding Scale',
    type: ESetting.NUMBER_FIELD,
    defaultValue: 1,
  },
];

const iconSettings: TSetting[] = [
  {
    key: 'iconSize',
    label: 'Icon Size',
    type: ESetting.UNITFIELD,
    tags: ['icon-size'],
    units: ['px', 'em', 'rem', 'vw', 'vh', 'pt', '%'],
    defaultValue: '16px',
    hasLabel: true,
    isSmallInput: true,
  },
];

const Settings: TSetting[] = [
  {
    key: 'properties',
    label: 'Properties',
    type: ESetting.GROUP,
    components: commonSettings,
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
  {
    key: 'border',
    label: 'Border',
    type: ESetting.GROUP,
    components: borderSettings,
  },
  {
    key: 'header',
    label: 'Header',
    type: ESetting.GROUP,
    components: headerSettings,
  },
  {
    key: 'cell',
    label: 'Cell',
    type: ESetting.GROUP,
    components: cellSettings,
  },
  {
    key: 'icon',
    label: 'Icon',
    type: ESetting.GROUP,
    components: iconSettings,
  },
];

export const BasicSettings: TSetting[] = [
  ...dataAccessSettings,
  ...commonSettings,
  ...basicSettings,
];

export default Settings;
