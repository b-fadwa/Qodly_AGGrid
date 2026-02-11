import config, { IFullAgGridProps } from './FullAgGrid.config';
import { T4DComponent, useEnhancedEditor } from '@ws-ui/webform-editor';
import Build from './FullAgGrid.build';
import Render from './FullAgGrid.render';

const FullAgGrid: T4DComponent<IFullAgGridProps> = (props) => {
  const { enabled } = useEnhancedEditor((state) => ({
    enabled: state.options.enabled,
  }));

  return enabled ? <Build {...props} /> : <Render {...props} />;
};

FullAgGrid.craft = config.craft;
FullAgGrid.info = config.info;
FullAgGrid.defaultProps = config.defaultProps;

export default FullAgGrid;
