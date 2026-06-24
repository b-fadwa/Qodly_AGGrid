import { T4DComponent, useEnhancedEditor } from '@ws-ui/webform-editor';
import config, { IPrintSettingsProps } from './PrintSettings.config';
import Build from './PrintSettings.build';
import Render from './PrintSettings.render';

const PrintSettings: T4DComponent<IPrintSettingsProps> = (props) => {
  const { enabled } = useEnhancedEditor((state) => ({ enabled: state.options.enabled }));
  return enabled ? <Build {...props} /> : <Render {...props} />;
};

PrintSettings.craft = config.craft;
PrintSettings.info = config.info;
PrintSettings.defaultProps = config.defaultProps;

export default PrintSettings;

