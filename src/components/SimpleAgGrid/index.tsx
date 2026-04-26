import config, { ISimpleAgGridProps } from './SimpleAgGrid.config';
import { T4DComponent, useEnhancedEditor } from '@ws-ui/webform-editor';
import Build from './SimpleAgGrid.build';
import Render from './SimpleAgGrid.render';
import {
  ClientSideRowModelModule,
  InfiniteRowModelModule,
  ColumnApiModule,
  RowApiModule,
  ScrollApiModule,
  ValidationModule,
  CellStyleModule,
  RowStyleModule,
  PinnedRowModule,
  ModuleRegistry,
  RowDragModule,
  TextEditorModule,
  EventApiModule,
  RenderApiModule,
  RowSelectionModule,
} from 'ag-grid-community';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  InfiniteRowModelModule,
  RowApiModule,
  ScrollApiModule,
  ColumnApiModule,
  ValidationModule,
  CellStyleModule,
  RowStyleModule,
  PinnedRowModule,
  RowDragModule,
  TextEditorModule,
  EventApiModule,
  RenderApiModule,
  RowSelectionModule,
]);

const SimpleAgGrid: T4DComponent<ISimpleAgGridProps> = (props) => {
  const { enabled } = useEnhancedEditor((state) => ({
    enabled: state.options.enabled,
  }));

  return enabled ? <Build {...props} /> : <Render {...props} />;
};

SimpleAgGrid.craft = config.craft;
SimpleAgGrid.info = config.info;
SimpleAgGrid.defaultProps = config.defaultProps;

export default SimpleAgGrid;
