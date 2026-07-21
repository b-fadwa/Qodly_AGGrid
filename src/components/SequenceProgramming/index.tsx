import { T4DComponent, useEnhancedEditor } from '@ws-ui/webform-editor';
import config, { ISequenceProgrammingProps } from './SequenceProgramming.config';
import Build from './SequenceProgramming.build';
import Render from './SequenceProgramming.render';

const SequenceProgramming: T4DComponent<ISequenceProgrammingProps> = (props) => {
  const { enabled } = useEnhancedEditor((state) => ({ enabled: state.options.enabled }));
  return enabled ? <Build {...props} /> : <Render {...props} />;
};

SequenceProgramming.craft = config.craft;
SequenceProgramming.info = config.info;
SequenceProgramming.defaultProps = config.defaultProps;

export default SequenceProgramming;
