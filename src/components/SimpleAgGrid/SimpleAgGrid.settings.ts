import {
  DEFAULT_ITERATOR,
  ESetting,
  ETextFieldModifier,
  TSetting,
} from '@ws-ui/webform-editor';
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
        type: ESetting.DS_AUTO_SUGGEST,
        key: 'source',
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
        defaultValue: true,
        type: ESetting.CHECKBOX,
        key: 'editable',
      },
      {
        label: 'Enable Sorting',
        defaultValue: false,
        type: ESetting.CHECKBOX,
        key: 'sorting',
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
    key: 'iterator',
    label: 'Iterate with',
    type: ESetting.TEXT_FIELD,
    modifier: ETextFieldModifier.ITERATOR,
    placeholder: DEFAULT_ITERATOR,
  },
  {
    key: 'rowCssField',
    label: 'Row CSS Field',
    type: ESetting.TEXT_FIELD,
    placeholder: 'e.g. status',
  },
  {
    key: 'serverSideRef',
    label: 'Server Side',
    type: ESetting.TEXT_FIELD,
    hasError: validateServerSide,
    validateOnEnter: true,
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
    defaultValue: '0',
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
];

export const BasicSettings: TSetting[] = [
  ...dataAccessSettings,
  ...commonSettings,
  ...generalSettings,
];

export default Settings;
