import { T4DComponent, useEnhancedEditor } from '@ws-ui/webform-editor';
import config, { IExportSettingsProps } from './ExportSettings.config';
import Build from './ExportSettings.build';
import Render from './ExportSettings.render';

const ExportSettings: T4DComponent<IExportSettingsProps> = (props) => {
  const { enabled } = useEnhancedEditor((state) => ({ enabled: state.options.enabled }));
  return enabled ? <Build {...props} /> : <Render {...props} />;
};

ExportSettings.craft = config.craft;
ExportSettings.info = config.info;
ExportSettings.defaultProps = config.defaultProps;

export default ExportSettings;
