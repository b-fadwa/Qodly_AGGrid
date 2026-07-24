import {
  BASIC_SETTINGS,
  DEFAULT_SETTINGS,
  ESetting,
  TSetting,
  load,
} from '@ws-ui/webform-editor';

const datasourceSettings: TSetting[] = [
  {
    key: 'views',
    label: 'Saved views list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'filters',
    label: 'Saved filters list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'sorts',
    label: 'Saved sorts list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'sequence',
    label: 'Current sequence (object)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'sequences',
    label: 'Saved sequences list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'transpositions',
    label: 'Sequence transpositions (object)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'exportFormats',
    label: 'Saved export formats list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'printFormats',
    label: 'Saved print formats list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'predefinedDocuments',
    label: 'Predefined documents list',
    type: ESetting.DS_AUTO_SUGGEST,
  },
  {
    key: 'chainedSequences',
    label: 'Chained sequences list (Enchaînement séquence)',
    type: ESetting.DS_AUTO_SUGGEST,
  },
];

const appearanceSettings: TSetting[] = [
  {
    key: 'colorPrimary',
    label: 'Primary color',
    type: ESetting.COLOR_PICKER,
  },
  {
    key: 'colorDanger',
    label: 'Danger color',
    type: ESetting.COLOR_PICKER,
  },
  {
    key: 'colorAccent',
    label: 'Accent color',
    type: ESetting.COLOR_PICKER,
  },
  {
    key: 'colorDangerWash',
    label: 'Danger wash color',
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
