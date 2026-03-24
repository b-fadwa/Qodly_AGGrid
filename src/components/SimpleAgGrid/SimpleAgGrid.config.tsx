import {
  EComponentKind,
  T4DComponentConfig,
  isDatasourcePayload,
  isAttributePayload,
  getDataTransferSourceID,
  splitDatasourceID,
  Settings,
  T4DComponentDatasourceDeclaration,
  IExostiveElementProps,
} from '@ws-ui/webform-editor';
import { MdOutlineTableChart } from 'react-icons/md';
import capitalize from 'lodash/capitalize';
import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';
import SimpleAgGridSettings, { BasicSettings } from './SimpleAgGrid.settings';
import { generate } from 'short-uuid';

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
    displayName: 'SimpleAgGrid',
    kind: EComponentKind.BASIC,
    props: {
      name: '',
      iterable: true,
      classNames: [],
      events: [],
    },
    related: {
      settings: Settings(SimpleAgGridSettings, BasicSettings),
    },
  },
  info: {
    settings: SimpleAgGridSettings,
    sanityCheck: {
      keys: [
        { name: 'datasource', require: true, isDatasource: true },
        { name: 'currentElement', require: false, isDatasource: false },
      ],
    },
    displayName: 'SimpleAgGrid',
    exposed: true,
    icon: MdOutlineTableChart,
    events: [
      {
        label: 'On Set Value',
        value: 'onsetvalue',
      },
      {
        label: 'On Row DnD',
        value: 'onrowdnd',
      },
      {
        label: 'On Save Row',
        value: 'onsaverow',
      },
    ],
    datasources: {
      declarations: (props) => {
        const { columns, currentElement = '', datasource = '' } = props;
        const declarations: T4DComponentDatasourceDeclaration[] = [
          { path: datasource, iterable: true },
        ];
        if (currentElement) {
          declarations.push({ path: currentElement });
        }
        if (columns) {
          const { id: ds, namespace } = splitDatasourceID(datasource?.trim()) || {};
          const { id: currentDs, namespace: currentDsNamespace } =
            splitDatasourceID(currentElement) || {};

          if (!ds && !currentDs) {
            return;
          }

          columns.forEach((col: any) => {
            if (currentDs && currentDsNamespace === namespace) {
              const colSrcID = `${currentDs}.${col.source.trim()}`;
              declarations.push({
                path: namespace ? `${namespace}:${colSrcID}` : colSrcID,
              });
            }
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
        const new_props = cloneDeep(
          query.node(nodeId).get().data.props,
        ) as IExostiveElementProps;
        payload.forEach((item) => {
          if (isDatasourcePayload(item)) {
            if (
              item.source.type === 'entitysel' ||
              (item.source.type === 'scalar' && item.source.dataType === 'array')
            ) {
              new_props.datasource = getDataTransferSourceID(item);
            }
            if (
              item.source.type === 'entity' ||
              (item.source.type === 'scalar' && item.source.dataType === 'object')
            ) {
              new_props.currentElement = getDataTransferSourceID(item);
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
              new_props.currentElement = getDataTransferSourceID(item);
            } else {
              if (findIndex(new_props.columns, { source: item.attribute.name }) === -1)
                new_props.columns = [
                  ...(new_props.columns || []),
                  {
                    title: capitalize(item.attribute.name),
                    source: item.attribute.name,
                    width: 150,
                    flex: 1,
                    editable: true,
                    sorting: true,
                    id: generate(),
                    dataType: item.attribute.type || 'string',
                  } as any,
                ];
            }
          }
        });
        return {
          [nodeId]: new_props,
        };
      },
    },
  },
  defaultProps: {
    columns: [],
    rowCssField: '',
    style: {
      height: '600px',
    },
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
} as T4DComponentConfig<ISimpleAgGridProps>;

export interface ISimpleAgGridProps extends webforms.ComponentProps {
  columns: ISimpleColumn[];
  currentElement?: string;
  rowCssField: string;
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
}

export interface ISimpleColumn {
  title: string;
  source: string;
  width: number;
  flex: number;
  editable: boolean;
  sorting: boolean;
  id: string;
  dataType: string;
}
