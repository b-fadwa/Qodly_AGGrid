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
import { MdOutlinePrint } from 'react-icons/md';
import PrintSettingsSettings, { BasicSettings } from './PrintSettings.settings';

export interface IPrintSettingsProps extends webforms.ComponentProps {
  /** Scalar object used to discover printable fields. Accepts AG Grid view state or any nested object. */
  state?: string;
  /** Scalar object containing the live print-settings draft. */
  format?: string;
  /** Scalar array containing named print format records. */
  formats?: string;
  accentColor?: string;
}

export default {
  craft: {
    displayName: 'PrintSettings',
    kind: EComponentKind.BASIC,
    props: { name: '', classNames: [], events: [] },
    related: { settings: Settings(PrintSettingsSettings, BasicSettings) },
  },
  info: {
    settings: PrintSettingsSettings,
    sanityCheck: {
      keys: [
        { name: 'state', require: true, isDatasource: true },
        { name: 'format', require: false, isDatasource: false },
        { name: 'formats', require: false, isDatasource: false },
      ],
    },
    displayName: 'Print Settings',
    exposed: true,
    icon: MdOutlinePrint,
    events: [
      { label: 'On Load', value: 'onload' },
      { label: 'On Help', value: 'onhelp' },
      { label: 'On Validate', value: 'onvalidate' },
      { label: 'On Cancel', value: 'oncancel' },
      { label: 'On Save Format', value: 'onsaveformat' },
      { label: 'On Update Format', value: 'onupdateformat' },
      { label: 'On Delete Format', value: 'ondeleteformat' },
    ],
    datasources: {
      declarations: (props) => {
        const { state = '', format = '', formats = '' } = props as IExostiveElementProps & {
          state?: string;
          format?: string;
          formats?: string;
        };
        const declarations: T4DComponentDatasourceDeclaration[] = [];
        if (state) declarations.push({ path: state });
        if (format) declarations.push({ path: format });
        if (formats) declarations.push({ path: formats, iterable: true });
        return declarations;
      },
      set: (nodeId, query, payload) => {
        const next = cloneDeep(query.node(nodeId).get().data.props) as IExostiveElementProps & {
          state?: string;
          format?: string;
          formats?: string;
        };
        payload.forEach((item) => {
          if (isDatasourcePayload(item)) {
            const source = getDataTransferSourceID(item);
            if (item.source.type === 'scalar' && item.source.dataType === 'array') {
              next.formats = source;
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
    format: '',
    formats: '',
    accentColor: '#6B8AD4',
    style: { width: '100%', height: '620px' },
  },
} as T4DComponentConfig<IPrintSettingsProps>;
