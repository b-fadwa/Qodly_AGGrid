import {
  EComponentKind,
  getDataTransferSourceID,
  IExostiveElementProps,
  isDatasourcePayload,
  Settings,
  T4DComponentConfig,
  T4DComponentDatasourceDeclaration,
} from '@ws-ui/webform-editor';
import cloneDeep from 'lodash/cloneDeep';
import { MdOutlineFileDownload } from 'react-icons/md';
import ExportSettingsSettings, { BasicSettings } from './ExportSettings.settings';

export interface IExportSettingsProps extends webforms.ComponentProps {
  /** Scalar object used to discover exportable fields. Accepts AG Grid view state or any nested object. */
  state?: string;
  /** Scalar object containing the live export-settings draft. */
  export?: string;
  /** Scalar array containing named export records. */
  exports?: string;
  accentColor?: string;
}

export default {
  craft: {
    displayName: 'ExportSettings',
    kind: EComponentKind.BASIC,
    props: { name: '', classNames: [], events: [] },
    related: { settings: Settings(ExportSettingsSettings, BasicSettings) },
  },
  info: {
    settings: ExportSettingsSettings,
    sanityCheck: {
      keys: [
        { name: 'state', require: true, isDatasource: true },
        { name: 'export', require: false, isDatasource: false },
        { name: 'exports', require: false, isDatasource: false },
      ],
    },
    displayName: 'Export Settings',
    exposed: true,
    icon: MdOutlineFileDownload,
    events: [
      { label: 'On Load', value: 'onload' },
      { label: 'On Help', value: 'onhelp' },
      { label: 'On Validate', value: 'onvalidate' },
      { label: 'On Cancel', value: 'oncancel' },
      { label: 'On Save Export', value: 'onsaveexport' },
      { label: 'On Update Export', value: 'onupdateexport' },
      { label: 'On Delete Export', value: 'ondeleteexport' },
    ],
    datasources: {
      declarations: (props) => {
        const { state = '', export: exportBinding = '', exports = '' } = props as IExostiveElementProps & {
          state?: string;
          export?: string;
          exports?: string;
        };
        const declarations: T4DComponentDatasourceDeclaration[] = [];
        if (state) declarations.push({ path: state });
        if (exportBinding) declarations.push({ path: exportBinding });
        if (exports) declarations.push({ path: exports, iterable: true });
        return declarations;
      },
      set: (nodeId, query, payload) => {
        const next = cloneDeep(query.node(nodeId).get().data.props) as IExostiveElementProps & {
          state?: string;
          export?: string;
          exports?: string;
        };
        payload.forEach((item) => {
          if (isDatasourcePayload(item)) {
            const source = getDataTransferSourceID(item);
            if (item.source.type === 'scalar' && item.source.dataType === 'array') {
              next.exports = source;
            } else if (item.source.type === 'scalar' && item.source.dataType === 'object') {
              next.state = source;
            }
          }
        });
        return { [nodeId]: next };
      },
    },
  },
  defaultProps: {
    state: '',
    export: '',
    exports: '',
    accentColor: '#6B8AD4',
    style: { width: '100%', height: '520px' },
  },
} as T4DComponentConfig<IExportSettingsProps>;
