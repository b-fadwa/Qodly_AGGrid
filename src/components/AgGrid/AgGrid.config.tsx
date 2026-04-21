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
      iterable: true,
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
        { name: 'view', require: false, isDatasource: false },
        { name: 'views', require: false, isDatasource: false },
        { name: 'filter', require: false, isDatasource: false },
        { name: 'filters', require: false, isDatasource: false },
        { name: 'sort', require: false, isDatasource: false },
        { name: 'sorts', require: false, isDatasource: false },
        { name: 'dateFinancial', require: false, isDatasource: true },
        { name: 'calculStatistiqueResult', require: false, isDatasource: false },
      ],
    },
    displayName: 'AgGrid',
    exposed: true,
    icon: MdOutlineGridOn,
    events: [
      { label: 'On Row Click', value: 'onrowclick' },
      { label: 'On Row Double Click', value: 'onrowdblclick' },
      { label: 'On Header Click', value: 'onheaderclick' },
      { label: 'On Cell Click', value: 'oncellclick' },
      { label: 'On Cell Double Click', value: 'oncelldblclick' },
      { label: 'On Cell Key Down', value: 'oncellkeydown' },
      { label: 'On Cell Mouse Over', value: 'oncellmouseover' },
      { label: 'On Cell Mouse Out', value: 'oncellmouseout' },
      { label: 'On Cell Mouse Down', value: 'oncellmousedown' },

      { label: 'On Save View', value: 'onsaveview' },
      { label: 'On Load View', value: 'onloadview' },
      { label: 'On Load Views (list)', value: 'onloadviews' },
      { label: 'On Update View', value: 'onupdateview' },
      { label: 'On Delete View', value: 'ondeleteview' },

      { label: 'On Save Filter', value: 'onsavefilter' },
      { label: 'On Load Filter', value: 'onloadfilter' },
      { label: 'On Load Filters (list)', value: 'onloadfilters' },
      { label: 'On Update Filter', value: 'onupdatefilter' },
      { label: 'On Delete Filter', value: 'ondeletefilter' },

      { label: 'On Save Sort', value: 'onsavesort' },
      { label: 'On Load Sort', value: 'onloadsort' },
      { label: 'On Load Sorts (list)', value: 'onloadsorts' },
      { label: 'On Update Sort', value: 'onupdatesort' },
      { label: 'On Delete Sort', value: 'ondeletesort' },

      { label: 'On Calculs statistique', value: 'oncalculstatistique' },
    ],
    datasources: {
      declarations: (props) => {
        const {
          columns,
          currentElement = '',
          datasource = '',
          view = '',
          views = '',
          filter = '',
          filters = '',
          sort = '',
          sorts = '',
          dateFinancial = '',
          calculStatistiqueResult = '',
        } = props as IExostiveElementProps & {
          view?: string;
          views?: string;
          filter?: string;
          filters?: string;
          sort?: string;
          sorts?: string;
          dateFinancial?: string;
          calculStatistiqueResult?: string;
        };
        const declarations: T4DComponentDatasourceDeclaration[] = [
          { path: datasource, iterable: true },
        ];
        if (currentElement) {
          declarations.push({ path: currentElement });
        }
        if (view) declarations.push({ path: view });
        if (views) declarations.push({ path: views, iterable: true });
        if (filter) declarations.push({ path: filter });
        if (filters) declarations.push({ path: filters, iterable: true });
        if (sort) declarations.push({ path: sort });
        if (sorts) declarations.push({ path: sorts, iterable: true });
        if (dateFinancial?.trim()) {
          declarations.push({ path: dateFinancial.trim() });
        }
        if (calculStatistiqueResult?.trim()) {
          declarations.push({ path: calculStatistiqueResult.trim() });
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
                    hidden: false,
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
    view: '',
    views: '',
    filter: '',
    filters: '',
    sort: '',
    sorts: '',
    dateFinancial: '',
    calculStatistiqueResult: '',
    currentSelection: '',
    multiSelection: false,
    style: {
      height: '600px',
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
    enableColumnHover: true,
    headerColumnBorder: false,
    headerVerticalPaddingScale: 1,
    headerFontSize: '14px',
    headerFontWeight: 700,
    cellHorizontalPaddingScale: 1.3,
    rowVerticalPaddingScale: 1.2,
    iconSize: '16px',
    rowCssField: '',
    showToolbarActions: true,
    showToolbarView: true,
    showToolbarSorting: true,
    showToolbarFiltering: true,
    showToolbarStatistics: false,
    showToolbarSaveView: true,
    showToolbarSavedViews: true,
    showRecordCount: true,
    showRowNumbers: false,
  },
} as T4DComponentConfig<IAgGridProps>;

export interface IAgGridProps extends webforms.ComponentProps {
  columns: IColumn[];
  /** Scalar object: live `columnState` (order / width / pinning / hide). */
  view?: string;
  /** Scalar array: saved list of named views (columnState). */
  views?: string;
  /** Scalar object: live `filterModel` (+ fiscal-year toggle). */
  filter?: string;
  /** Scalar array: saved list of named filters. */
  filters?: string;
  /** Scalar object: live `sortModel`. */
  sort?: string;
  /** Scalar array: saved list of named sorts. */
  sorts?: string;
  /** Scalar datasource (4D Date): used to add `Date_Document >= Date_Financial` to server queries when valid. */
  dateFinancial?: string;
  /**
   * Scalar datasource that receives the **On Calculs statistique** method result (same binding as the event’s return in Studio).
   * `emit()` does not return the server value; the grid reads it from this source after the event runs.
   */
  calculStatistiqueResult?: string;
  currentSelection?: string;
  multiSelection: boolean;
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
  enableColumnHover?: boolean;
  showColumnActions?: boolean;
  showCopyActions: boolean;
  /** Toolbar: Actions slot (agGridActions) */
  showToolbarActions?: boolean;
  /** Toolbar: View (customize columns, reset default view) */
  showToolbarView?: boolean;
  /** Toolbar: Advanced sorting */
  showToolbarSorting?: boolean;
  /** Toolbar: Advanced filtering (named filter sets) */
  showToolbarFiltering?: boolean;
  /** Toolbar: Calculs statistique (numeric column aggregates) */
  showToolbarStatistics?: boolean;
  /** Toolbar: Save new view */
  showToolbarSaveView?: boolean;
  /** Toolbar: Load / overwrite / delete saved views */
  showToolbarSavedViews?: boolean;
  /** Show total row count below the toolbar (matches active filter / clone when filtering). */
  showRecordCount?: boolean;
  /** Pinned left row index column (not part of Columns / saved colDef). */
  showRowNumbers?: boolean;
  rowCssField?: string;
}

export interface IColumn {
  title: string;
  source: string;
  sorting: boolean;
  filtering: boolean;
  locked: boolean;
  hidden: boolean;
  sizing: boolean;
  width: number;
  format: string;
  id: string;
  dataType: string;
  flex: number;
}
