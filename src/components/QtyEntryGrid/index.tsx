import config, { IQtyEntryGridProps } from './QtyEntryGrid.config';
import { T4DComponent, useEnhancedEditor } from '@ws-ui/webform-editor';
import Build from './QtyEntryGrid.build';
import Render from './QtyEntryGrid.render';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  EventApiModule,
  ModuleRegistry,
  RenderApiModule,
  RowApiModule,
  RowStyleModule,
  TextEditorModule,
  ValidationModule,
} from 'ag-grid-community';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  RowApiModule,
  ColumnApiModule,
  ValidationModule,
  CellStyleModule,
  RowStyleModule,
  TextEditorModule,
  EventApiModule,
  RenderApiModule,
]);

const QtyEntryGrid: T4DComponent<IQtyEntryGridProps> = (props) => {
  const { enabled } = useEnhancedEditor((state) => ({ enabled: state.options.enabled }));
  return enabled ? <Build {...props} /> : <Render {...props} />;
};

QtyEntryGrid.craft = config.craft;
QtyEntryGrid.info = config.info;
QtyEntryGrid.defaultProps = config.defaultProps;

export default QtyEntryGrid;

