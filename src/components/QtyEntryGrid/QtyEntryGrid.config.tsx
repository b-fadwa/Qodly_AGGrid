import {
  EComponentKind,
  getDataTransferSourceID,
  IExostiveElementProps,
  isAttributePayload,
  isDatasourcePayload,
  Settings,
  splitDatasourceID,
  T4DComponentConfig,
  T4DComponentDatasourceDeclaration,
} from '@ws-ui/webform-editor';
import { MdOutlineTableChart } from 'react-icons/md';
import capitalize from 'lodash/capitalize';
import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';
import { generate } from 'short-uuid';
import QtyEntryGridSettings, { BasicSettings } from './QtyEntryGrid.settings';

const types: string[] = [
  'bool',
  'word',
  'string',
  'text',
  'uuid',
  'short',
  'long',
  'number',
  'long64',
  'duration',
  'object',
  'date',
  'image',
  'blob',
];

export default {
  craft: {
    displayName: 'QtyEntryGrid',
    kind: EComponentKind.BASIC,
    props: {
      name: '',
      iterable: true,
      classNames: [],
      events: [],
    },
    related: {
      settings: Settings(QtyEntryGridSettings, BasicSettings),
    },
  },
  info: {
    settings: QtyEntryGridSettings,
    sanityCheck: {
      keys: [{ name: 'datasource', require: true, isDatasource: true }],
    },
    displayName: 'QtyEntryGrid',
    exposed: true,
    icon: MdOutlineTableChart,
    events: [
      {
        label: 'On Cell Value Changed',
        value: 'oncellvaluechanged',
      },
    ],
    datasources: {
      declarations: (props) => {
        const { columns, datasource = '' } = props;
        const declarations: T4DComponentDatasourceDeclaration[] = [{ path: datasource, iterable: true }];

        if (columns) {
          const { id: ds, namespace } = splitDatasourceID(datasource?.trim()) || {};
          if (!ds) return declarations;

          columns.forEach((col: any) => {
            const colSrcID = `${ds}.[].${col.source.trim()}`;
            const iterable = ds.startsWith('$');
            declarations.push({
              path: namespace ? `${namespace}:${colSrcID}` : colSrcID,
              iterable,
            });
          });
        }

        return declarations;
      },

      set: (nodeId, query, payload) => {
        const new_props = cloneDeep(query.node(nodeId).get().data.props) as IExostiveElementProps;

        payload.forEach((item) => {
          if (isDatasourcePayload(item)) {
            if (
              item.source.type === 'entitysel' ||
              (item.source.type === 'scalar' && item.source.dataType === 'array')
            ) {
              new_props.datasource = getDataTransferSourceID(item);
            }
          } else if (isAttributePayload(item)) {
            if (
              item.attribute.kind === 'relatedEntities' ||
              item.attribute.type?.includes('Selection') ||
              item.attribute.behavior === 'relatedEntities'
            ) {
              new_props.datasource = getDataTransferSourceID(item);
            } else if (
              item.attribute.kind === 'relatedEntity' ||
              item.attribute.behavior === 'relatedEntity' ||
              !types.includes(item.attribute.type)
            ) {
              // ignore: this component is meant for collections only
            } else {
              if (findIndex(new_props.columns, { source: item.attribute.name }) === -1) {
                new_props.columns = [
                  ...(new_props.columns || []),
                  {
                    title: capitalize(item.attribute.name),
                    source: item.attribute.name,
                    width: 150,
                    flex: 1,
                    editable: false,
                    sorting: true,
                    hidden: false,
                    id: generate(),
                    ...(item.attribute.type === 'image'
                      ? { dataType: item.attribute.type, format: '' }
                      : item.attribute.type === 'bool'
                        ? { dataType: item.attribute.type, format: 'boolean' }
                        : ['blob', 'object'].includes(item.attribute.type)
                          ? { dataType: item.attribute.type || 'object', format: '' }
                          : { format: '', dataType: item.attribute.type || 'string' }),
                  } as any,
                ];
              }
            }
          }
        });

        return { [nodeId]: new_props };
      },
    },
  },
  defaultProps: {
    columns: [],
    style: { height: '600px' },
    spacing: '8px',
    accentColor: '#2196F3',
    backgroundColor: '#fff',
    textColor: '#000',
    fontSize: '14px',
    borderColor: '#e0e0e0',
    wrapperBorderRadius: '4px',
    headerBackgroundColor: '',
    headerTextColor: '',
    rowBorder: true,
    columnBorder: false,
  },
} as T4DComponentConfig<IQtyEntryGridProps>;

export interface IQtyEntryGridProps extends webforms.ComponentProps {
  datasource?: string;
  columns: IQtyEntryColumn[];
  spacing: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: string;
  borderColor: string;
  wrapperBorderRadius: string;
  rowBorder: boolean;
  columnBorder: boolean;
  headerBackgroundColor: string;
  headerTextColor: string;
  disabled?: boolean;
}

export interface IQtyEntryColumn {
  title: string;
  source: string;
  width: number;
  flex: number;
  /** When true, this column is editable in runtime. */
  editable: boolean;
  sorting: boolean;
  hidden?: boolean;
  format?: string;
  id: string;
  dataType: string;
}
