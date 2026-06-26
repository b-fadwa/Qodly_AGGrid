import {
  BASIC_SETTINGS,
  DEFAULT_SETTINGS,
  ESetting,
  TSetting,
  load,
} from '@ws-ui/webform-editor';

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

const appearanceSettings: TSetting[] = [
  {
    key: 'accentColor',
    label: 'Accent color',
    type: ESetting.COLOR_PICKER,
  },
];

const Settings: TSetting[] = [
  { key: 'dataAccess', label: 'Data Access', type: ESetting.GROUP, components: datasourceSettings },
  { key: 'appearance', label: 'Appearance', type: ESetting.GROUP, components: appearanceSettings },
  ...DEFAULT_SETTINGS,
];

export const BasicSettings: TSetting[] = [
  ...datasourceSettings,
  ...appearanceSettings,
  ...load(BASIC_SETTINGS).filter('style.overflow'),
];

export default Settings;
