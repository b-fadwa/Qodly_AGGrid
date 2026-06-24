import { ESetting, TSetting } from '@ws-ui/webform-editor';

const datasourceSettings: TSetting[] = [
  {
    key: 'state',
    label: 'Table state / view (object)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'format',
    label: 'Current format (object)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'formats',
    label: 'Saved formats (array)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
];

const generalSettings: TSetting[] = [
  { key: 'disabled', label: 'Disabled', type: ESetting.CHECKBOX },
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
    units: ['px', 'em', 'rem', 'vw', 'vh', '%'],
    hasLabel: true,
    isSmallInput: true,
  },
  {
    key: 'style.height',
    label: 'Height',
    type: ESetting.UNITFIELD,
    units: ['px', 'em', 'rem', 'vw', 'vh', '%', 'auto'],
    hasLabel: true,
    isSmallInput: true,
  },
  { key: 'accentColor', label: 'Accent color', type: ESetting.COLOR_PICKER },
];

const Settings: TSetting[] = [
  { key: 'dataAccess', label: 'Data Access', type: ESetting.GROUP, components: datasourceSettings },
  { key: 'general', label: 'General', type: ESetting.GROUP, components: generalSettings },
];

export const BasicSettings: TSetting[] = [
  ...datasourceSettings,
  ...generalSettings,
];

export default Settings;
