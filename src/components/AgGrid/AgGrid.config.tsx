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
import { MdOutlineGridOn } from 'react-icons/md';
import capitalize from 'lodash/capitalize';
import cloneDeep from 'lodash/cloneDeep';
import findIndex from 'lodash/findIndex';
import AgGridSettings, { BasicSettings } from './AgGrid.settings';
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
    displayName: 'AgGrid',
    kind: EComponentKind.BASIC,
    props: {
      name: '',
      classNames: [],
      events: [],
    },
    related: {
      settings: Settings(AgGridSettings, BasicSettings),
    },
  },
  info: {
    settings: AgGridSettings,
    sanityCheck: {
      keys: [
        { name: 'datasource', require: true, isDatasource: true },
        { name: 'currentElement', require: false, isDatasource: false },
        { name: 'state', require: false, isDatasource: false },
      ],
    },
    displayName: 'AgGrid',
    exposed: true,
    icon: MdOutlineGridOn,
    events: [
      {
        label: 'On Row Click',
        value: 'onrowclick',
      },
      {
        label: 'On Row Double Click',
        value: 'onrowdblclick',
      },
      {
        label: 'On Header Click',
        value: 'onheaderclick',
      },
      {
        label: 'On Cell Click',
        value: 'oncellclick',
      },
      {
        label: 'On Cell Double Click',
        value: 'oncelldblclick',
      },
      {
        label: 'On Cell Key Down',
        value: 'oncellkeydown',
      },
      {
        label: 'On Cell Mouse Over',
        value: 'oncellmouseover',
      },
      {
        label: 'On Cell Mouse Out',
        value: 'oncellmouseout',
      },
      {
        label: 'On Cell Mouse Down',
        value: 'oncellmousedown',
      },
      {
        label: 'On SaveState',
        value: 'onsavestate',
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

          columns.forEach((col) => {
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
        const new_props = cloneDeep(query.node(nodeId).get().data.props) as IExostiveElementProps;
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
                    sorting: false,
                    filtering: false,
                    locked: false,
                    sizing: true,
                    id: generate(),
                    ...(item.attribute.type === 'image'
                      ? {
                          dataType: item.attribute.type,
                        }
                      : item.attribute.type === 'bool'
                        ? {
                            dataType: item.attribute.type,
                            format: 'boolean',
                          }
                        : ['blob', 'object'].includes(item.attribute.type)
                          ? {}
                          : {
                              format: '',
                              dataType: item.attribute.type,
                            }),
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
    state: '',
    saveLocalStorage: false,
    style: {
      height: '300px',
    },
    spacing: '8px',
    accentColor: '#2196F3',
    backgroundColor: '#fff',
    textColor: '#000',
    fontSize: '14px',
    oddRowBackgroundColor: '',
    borderColor: '#e0e0e0',
    wrapperBorderRadius: '4px',
    headerBackgroundColor: '',
    headerTextColor: '',
    rowBorder: true,
    columnBorder: false,
    enableCellFocus: true,
    headerColumnBorder: false,
    headerVerticalPaddingScale: 1,
    headerFontSize: '14px',
    headerFontWeight: 700,
    cellHorizontalPaddingScale: 1.3,
    rowVerticalPaddingScale: 1.2,
    iconSize: '16px',
  },
} as T4DComponentConfig<IAgGridProps>;

export interface IAgGridProps extends webforms.ComponentProps {
  columns: IColumn[];
  state?: string;
  saveLocalStorage: boolean;
  spacing: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: string;
  oddRowBackgroundColor: string;
  borderColor: string;
  wrapperBorderRadius: string;
  rowBorder: boolean;
  columnBorder: boolean;
  headerBackgroundColor: string;
  headerTextColor: string;
  headerColumnBorder: boolean;
  headerVerticalPaddingScale: number;
  headerFontSize: string;
  headerFontWeight: number;
  cellHorizontalPaddingScale: number;
  rowVerticalPaddingScale: number;
  iconSize: string;
  enableCellFocus?: boolean;
}

export interface IColumn {
  title: string;
  source: string;
  sorting: boolean;
  filtering: boolean;
  locked: boolean;
  sizing: boolean;
  width: number;
  format: string;
  id: string;
  dataType: string;
  flex: number;
}
