import {
  useDataLoader,
  useRenderer,
  useSources,
  useDsChangeHandler,
  entitySubject,
  EntityActions,
  useEnhancedNode,
  useWebformPath,
  useEnhancedEditor,
} from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IGetRowsParams,
  SortModelItem,
  StateUpdatedEvent,
  ModuleRegistry,
  ColumnHoverModule,
  themeQuartz,
} from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import { format } from 'date-fns';
import { Element } from '@ws-ui/craftjs-core';
import { selectResolver } from '@ws-ui/webform-editor';
import CustomCell from '../AgGrid/CustomCell';
import { IFullAgGridProps } from './FullAgGrid.config';

ModuleRegistry.registerModules([ColumnHoverModule]);

const FullAgGrid: FC<IFullAgGridProps> = ({
  datasource,
  state = '',
  currentSelection = '',
  spacing,
  accentColor,
  backgroundColor,
  textColor,
  fontSize,
  borderColor,
  wrapperBorderRadius,
  oddRowBackgroundColor,
  rowBorder,
  columnBorder,
  headerBackgroundColor,
  headerTextColor,
  headerColumnBorder,
  headerVerticalPaddingScale,
  headerFontSize,
  headerFontWeight,
  cellHorizontalPaddingScale,
  rowVerticalPaddingScale,
  iconSize,
  enableCellFocus,
  enableColumnHover,
  multiSelection,
  style,
  disabled = false,
  saveLocalStorage,
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [
      'onrowclick',
      'onrowdblclick',
      'onheaderclick',
      'oncellclick',
      'oncelldblclick',
      'oncellkeydown',
      'oncellmouseover',
      'oncellmouseout',
      'oncellmousedown',
      'onsavestate',
    ],
  });
  const { resolver } = useEnhancedEditor(selectResolver);
  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });
  const { id: nodeID } = useEnhancedNode();
  const prevSortModelRef = useRef<SortModelItem[]>([]);
  const gridRef = useRef<AgGridReact>(null);
  const searchDs = useMemo(() => {
    if (ds) {
      const clone: any = cloneDeep(ds);
      clone.id = `${clone.id}_clone`;
      clone.children = {};
      return clone;
    }
    return null;
  }, [ds?.id, (ds as any)?.entitysel]);

  const { fetchIndex, fetchPage } = useDataLoader({
    source: ds,
  });

  const { fetchPage: fetchClone } = useDataLoader({
    source: searchDs,
  });

  const path = useWebformPath();
  const stateDS = window.DataSource.getSource(state, path);
  const currentSelectionDS = window.DataSource.getSource(currentSelection, path);

  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [_count, setCount] = useState(0);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  // views management
  const [viewName, setViewName] = useState<string>('');
  // view = name + columnState
  const [savedViews, setSavedViews] = useState<{ name: string, columnState?: any }[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');
  // all properties for columns customizer
  const [allProperties, setAllProperties] = useState<any[]>([]);

  const [columnVisibility, setColumnVisibility] = useState<any[]>([]);
  const [initialColumnState, setInitialColumnState] = useState<any>(null); // Store the initial AG Grid column state

  useEffect(() => {
    if (!ds) return;
    const processedEntities = new Set(); // Set to track processed entities and prevent duplicates
    const formattedProperties = Object.values(ds.dataclass.getAllAttributes()).map((item: any) => ({
      name: item.name,
      kind: item.kind,
      type: item.type,
      isDate: item.type === 'date',
      isImage: item.type === 'image',
      isString: item.type === 'string',
      isNumber: item.type === 'long',
      isBoolean: item.type === 'bool',
      isDuration: item.type === 'duration',
      isRelated: item.kind === 'relatedEntities' || item.kind === 'relatedEntity',
    }));

    const combinedProperties: any[] = [];

    // Recursively process related entities and their attributes
    const processAttributes = (attributes: any[], dataClassName: string, depth: number = 0) => {
      attributes.forEach((item: any) => {
        const uniquePath = dataClassName + item.name;
        if (
          (item.kind === 'relatedEntities' ||
            item.kind === 'relatedEntity' ||
            (item.kind === 'calculated' && item.behavior === 'relatedEntities')) &&
          depth == 0
        ) {
          const dataType = item.type.includes('Selection')
            ? item.type.replace('Selection', '')
            : item.type;
          if (processedEntities.has(uniquePath)) return;
          processedEntities.add(uniquePath);
          // Get related entity attributes
          const relatedEntityAttributes = Object.values(
            (ds.dataclass._private.datastore as any)[dataType].getAllAttributes(),
          );
          relatedEntityAttributes.forEach((attr: any) => {
            if (attr.kind === 'storage' && !processedEntities.has(uniquePath + '.' + attr.name)) {
              combinedProperties.push({
                name: uniquePath + '.' + attr.name,
                kind: attr.kind,
                type: attr.type,
                isDate: attr.type === 'date',
                isImage: attr.type === 'image',
                isString: attr.type === 'string',
                isNumber: attr.type === 'long',
                isBoolean: attr.type === 'bool',
                isDuration: attr.type === 'duration',
                isRelated: attr.kind === 'relatedEntities' || attr.kind === 'relatedEntity',
              });
              processedEntities.add(uniquePath + '.' + attr.name); // Mark this attribute as processed
            }
          });
          // Recurse on the related entity attributes to find deeper related entities
          processAttributes(relatedEntityAttributes, uniquePath + '.', depth + 1);
        } else if (item.kind === 'storage' && !processedEntities.has(uniquePath)) {
          // Handle non-related entities (storage)
          combinedProperties.push({
            name: uniquePath,
            kind: item.kind,
            type: item.type,
            isDate: item.type === 'date',
            isImage: item.type === 'image',
            isString: item.type === 'string',
            isNumber: item.type === 'long',
            isBoolean: item.type === 'bool',
            isDuration: item.type === 'duration',
            isRelated: item.kind === 'relatedEntities' || item.kind === 'relatedEntity',
          });
          processedEntities.add(uniquePath);
        }
      });
    };
    const topLevelAttributes = Object.values(ds.dataclass.getAllAttributes()).filter(
      (item) =>
        item.kind === 'relatedEntities' ||
        item.kind === 'relatedEntity' ||
        (item.kind === 'calculated' && item.behavior === 'relatedEntities'),
    );
    processAttributes(topLevelAttributes, '');
    setAllProperties([...combinedProperties, ...formattedProperties]); // add the processed properties too
  }, []);

  //normalize allProperties as columns in AgGrid.render.tsx
  const normalizedColumns = useMemo(() => {
    return allProperties
      .filter(prop => prop.name)
      .map(prop => ({
        title: prop.name,
        kind: prop.kind,
        source: prop.name,
        hidden: false,
        locked: false,
        sorting: true,
        filtering: true,
        sizing: true,
        width: 150,
        flex: 1,
        format: null,
        dataType:
          prop.type === "long" || prop.type === "number"
            ? "number"
            : prop.type === "date"
              ? "date"
              : "text",
      }));
  }, [allProperties]);


  // Load saved views from localStorage/stateDS on init
  useEffect(() => {
    if (saveLocalStorage) {
      const stored = localStorage.getItem(`savedViews_${nodeID}`);
      if (stored) {
        setSavedViews(JSON.parse(stored));
      }
    } else if (stateDS) {
      // Load from stateDS the saved views
      stateDS.getValue().then((data: any) => {
        if (data && data.savedViews) {
          setSavedViews(data.savedViews);
        }
      })
    }
  }, []);

  //to deselct if current selection ds value is cleared from outside 
  useEffect(() => {
    if (!currentSelectionDS) return;

    const listener = async (/* event */) => {
      const value = await currentSelectionDS.getValue();
      if (value.length === 0) {
        gridRef.current?.api?.deselectAll();
      }
    };
    listener();
    currentSelectionDS.addListener('changed', listener);
    return () => {
      currentSelectionDS.removeListener('changed', listener);
    };
  }, [currentSelectionDS]);

  //very initial state of columns
  const initialColumnVisibility = useMemo(
    () => {
      return normalizedColumns.map((col: any) => ({
        field: col.title,
        isHidden: (col.hidden as boolean) || false,
        pinned: null as 'left' | 'right' | null,
      }));
    },
    [normalizedColumns]
  );

  // initialize columnVisibility when initialColumnVisibility becomes available
  useEffect(() => {
    if (initialColumnVisibility && initialColumnVisibility.length > 0 && columnVisibility.length === 0) {
      setColumnVisibility(initialColumnVisibility);
    }
  }, [initialColumnVisibility]);

  const colDefs: ColDef[] = useMemo(() => {
    return normalizedColumns.map((col: any) => {
      const colState = columnVisibility.find((c) => c.field === col.title) || { isHidden: false, pinned: null };
      const dataType = col.type || col.dataType;
      return {
        field: col.title,
        hide: colState.isHidden,
        pinned: colState.pinned,
        cellRendererParams: {
          format: col.format,
          dataType,
        },
        lockPosition: false,
        sortable: dataType !== 'image' && dataType !== 'object',
        resizable: true,
        width: undefined,
        flex: undefined,
        filter:
          dataType === 'text' || dataType === 'string'
            ? 'agTextColumnFilter'
            : dataType === 'long' || dataType === 'number'
              ? 'agNumberColumnFilter'
              : dataType === 'date'
                ? 'agDateColumnFilter'
                : false,
        filterParams: {
          filterOptions:
            dataType === 'text' || dataType === 'string'
              ? ['contains', 'equals', 'notEqual', 'startsWith', 'endsWith']
              : dataType === 'long' || dataType === 'number'
                ? [
                  'equals',
                  'notEqual',
                  'greaterThan',
                  'greaterThanOrEqual',
                  'lessThan',
                  'lessThanOrEqual',
                  'inRange',
                ]
                : dataType === 'date'
                  ? ['equals', 'notEqual', 'greaterThan', 'lessThan', 'inRange']
                  : [],
          defaultOption: 'equals',
        },
      } as ColDef;
    });
  }, [normalizedColumns, columnVisibility]);


  const defaultColDef = useMemo<ColDef>(() => {
    return {
      minWidth: 100,
      sortingOrder: ['asc', 'desc'],
      cellRenderer: CustomCell,
    };
  }, []);

  const theme = themeQuartz.withParams({
    spacing,
    accentColor,
    backgroundColor,
    textColor,
    fontSize,
    oddRowBackgroundColor,
    borderColor,
    rowBorder,
    columnBorder,
    wrapperBorderRadius,
    headerBackgroundColor,
    headerTextColor,
    headerColumnBorder,
    headerVerticalPaddingScale,
    headerFontSize,
    headerFontWeight,
    cellHorizontalPaddingScale,
    rowVerticalPaddingScale,
    iconSize,
    foregroundColor: textColor,
    borderRadius: wrapperBorderRadius,
    rangeSelectionBorderColor: !enableCellFocus ? 'transparent' : undefined,
  });

  const { updateCurrentDsValue } = useDsChangeHandler({
    source: ds,
    currentDs: currentElement,
    selected,
    setSelected,
    scrollIndex: scrollIndex,
    setScrollIndex,
    setCount,
    fetchIndex,
    onDsChange: ({ length, selected }) => {
      if (!gridRef.current) return;
      gridRef.current.api?.refreshInfiniteCache();
      if (selected >= 0) {
        updateCurrentDsValue({
          index: selected < length ? selected : 0,
          forceUpdate: true,
        });
      }
    },
    onCurrentDsChange: (selected) => {
      if (!gridRef.current) return;
      const rowNode = gridRef.current.api?.getRowNode(selected.toString());
      gridRef.current.api?.ensureIndexVisible(selected);
      rowNode?.setSelected(true);
      entitySubject.next({
        action: EntityActions.UPDATE,
        payload: {
          nodeID,
          rowIndex: selected,
        },
      });
    },
  });

  // useEffect(() => {
  //   console.log({ allProperties })
  // }, [allProperties]);

  // useEffect(() => {
  //   console.log({ normalizedColumns })
  // }, [normalizedColumns]);


  useEffect(() => {
    if (!normalizedColumns.length) return;
    // Get storage attributes
    const topLevelStorageColumns = normalizedColumns.filter(
      (col) => col.kind === 'storage' && !col.title.includes('.')
    );
    // Get related entity columns (with dots)
    const relatedColumns = normalizedColumns.filter((col) => col.title.includes('.'));
    // Combine: top-level first, then related
    const orderedProperties = [...topLevelStorageColumns, ...relatedColumns];
    // First 10 are visible, rest are hidden
    const firstTenNames = new Set(orderedProperties.slice(0, 10).map((col) => col.title));
    const initialColumnState = normalizedColumns.map((col) => ({
      field: col.title,
      isHidden: !firstTenNames.has(col.title),
      pinned: null,
    }))
    setColumnVisibility(initialColumnState);
    setInitialColumnState(initialColumnState);
  }, [normalizedColumns,]);



  const onRowClicked = useCallback(async (event: any) => {
    if (!ds || multiSelection) return;
    await updateCurrentDsValue({
      index: event.rowIndex,
    });
    emit('onrowclick');
  }, []);

  const onRowDoubleClicked = useCallback(async (event: any) => {
    if (!ds || multiSelection) return;
    await updateCurrentDsValue({
      index: event.rowIndex,
    });
    emit('onrowdblclick');
  }, []);

  const onCellClicked = useCallback((event: any) => {
    if (!ds) return;
    emit('oncellclick', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellDoubleClicked = useCallback((event: any) => {
    if (!ds) return;
    emit('oncelldblclick', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onHeaderClicked = useCallback((event: any) => {
    emit('onheaderclick', {
      column: event.column,
    });
  }, []);

  const onCellMouseOver = useCallback((event: any) => {
    emit('oncellmouseover', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellMouseOut = useCallback((event: any) => {
    emit('oncellmouseout', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellMouseDown = useCallback((event: any) => {
    emit('oncellmousedown', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellKeyDown = useCallback((event: any) => {
    emit('oncellkeydown', {
      column: event.column.getColId(),
      value: event.value,
      key: event.event.key,
    });
  }, []);

  const onSelectionChanged = useCallback(async (event: any) => {
    if (currentElement || !multiSelection) return; // handled by onRowClicked
    if (!currentSelectionDS) return;

    const selectedRows = event.api.getSelectedRows();
    await currentSelectionDS.setValue(null, selectedRows);
  }, []);

  const onStateUpdated = useCallback((params: StateUpdatedEvent) => {
    if (params.sources.length === 1 && params.sources.includes('rowSelection')) return; // to avoid multiple triggers when selecting a row
    if (params.type === 'stateUpdated' && !params.sources.includes('gridInitializing')) {
      const columnState = params.api.getColumnState();
      const filterModel = params.api.getFilterModel();
      if (saveLocalStorage) {
        localStorage.setItem(`gridState_${nodeID}`, JSON.stringify({ columnState, filterModel }));
      } else if (stateDS) {
        // Save combined data to stateDS
        stateDS.getValue().then((currentData: any) => {
          const gridData = {
            ...currentData,
            columnState,
            filterModel
          };
          stateDS.setValue(null, gridData);
        })
      }
      emit('onsavestate', { columnState, filterModel });
    }
  }, []);

  const getState = useCallback(async (params: any) => {
    if (saveLocalStorage) {
      const storedState = localStorage.getItem(`gridState_${nodeID}`);
      if (storedState) {
        params.api.applyColumnState({ state: JSON.parse(storedState), applyOrder: true });
      }
    } else if (stateDS) {
      const dsValue = await stateDS?.getValue();
      if (dsValue && dsValue.columnState) {
        params.api.applyColumnState({ state: dsValue.columnState, applyOrder: true });
        if (dsValue.filterModel) {
          params.api.setFilterModel(dsValue.filterModel);
        }
      }
    }
  }, []);

  const buildFilterQuery = useCallback((filter: any, source: string): string => {
    const filterType = filter.filterType;
    const filterValue = filter.filter;
    switch (filterType) {
      case 'text':
        switch (filter.type) {
          case 'contains':
            return `${source} == "@${filterValue}@"`;
          case 'equals':
            return `${source} == "${filterValue}"`;
          case 'notEqual':
            return `${source} != "${filterValue}"`;
          case 'startsWith':
            return `${source} begin "${filterValue}"`;
          case 'endsWith':
            return `${source} == "@${filterValue}"`;
          default:
            return '';
        }
      case 'number':
        switch (filter.type) {
          case 'equals':
            return `${source} == ${filterValue}`;
          case 'notEqual':
            return `${source} != ${filterValue}`;
          case 'greaterThan':
            return `${source} > ${filterValue}`;
          case 'greaterThanOrEqual':
            return `${source} >= ${filterValue}`;
          case 'lessThan':
            return `${source} < ${filterValue}`;
          case 'lessThanOrEqual':
            return `${source} <= ${filterValue}`;
          case 'inRange':
            return `${source} >= ${filter.filter} AND ${source} <= ${filter.filterTo}`;
          default:
            return '';
        }
      case 'date':
        const dateFrom = new Date(filter.dateFrom);
        switch (filter.type) {
          case 'equals':
            return `${source} == ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'notEqual':
            return `${source} != ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'lessThan':
            return `${source} < ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'greaterThan':
            return `${source} > ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'inRange':
            return `${source} > ${format(dateFrom, 'yyyy-MM-dd')} AND ${source} < ${format(new Date(filter.dateTo), 'yyyy-MM-dd')}`;
          default:
            return '';
        }
      default:
        return '';
    }
  }, []);

  const buildFilterQueries = useCallback(
    (filterModel: any, props: any[]): string[] => {
      return Object.keys(filterModel).map((key) => {
        const filter = filterModel[key];
        const column = props.find((col) => col.name === key);
        if (!column) return '';
        const source = column.name;
        if (filter.operator && filter.conditions) {
          const conditionQueries = filter.conditions.map((condition: any) =>
            buildFilterQuery(condition, source),
          );
          return `(${conditionQueries.join(` ${filter.operator} `)})`;
        } else {
          return buildFilterQuery(filter, source);
        }
      });
    },
    [buildFilterQuery],
  );

  const applySorting = useCallback(async (params: IGetRowsParams, props: any[], ds: any) => {
    if (params.sortModel.length > 0 && !isEqual(params.sortModel, prevSortModelRef.current)) {
      prevSortModelRef.current = params.sortModel;
      const sortingString = params.sortModel
        .map((sort) => `${props.find((c) => c.title === sort.colId)?.source} ${sort.sort}`)
        .join(', ');
      await ds.orderBy(sortingString);
    }
  }, []);

  const getSelectedRow = useCallback(async (api: GridApi) => {
    // select current element
    if (multiSelection) return;
    if (currentElement && selected === -1) {
      try {
        let index = -1;
        if (currentElement.type === 'entity') {
          const entity = (currentElement as any).getEntity();
          if (entity) {
            const pos = entity.getPos();
            const ownerSel = entity.getSelection();
            const sel = (ds as any)?.getSelection();
            if (sel && sel !== ownerSel) {
              // fixes qs#461
              sel.findEntityPosition(entity).then((posInSel: number) => {
                if (posInSel === pos) {
                  const rowNode = api.getRowNode(pos.toString());
                  api.ensureIndexVisible(pos, 'middle');
                  rowNode?.setSelected(true);
                }
              });
            } else {
              index = pos;
            }
          }
        } else if (
          currentElement.type === 'scalar' &&
          currentElement.dataType === 'object' &&
          currentElement.parentSource
        ) {
          index = (currentElement as any).getPos();
        }
        const rowNode = api.getRowNode(index.toString());
        (ds as any)?.getSelection().getServerRef() !==
          (searchDs as any).getSelection().getServerRef() &&
          api.ensureIndexVisible(index, 'middle');
        rowNode?.setSelected(true);
      } catch (e) {
        // proceed
      }
    }
  }, []);

  // Ref to hold the fetchData function=>force it to be updated when dependencies change
  const fetchDataRef = useRef<(
    params: IGetRowsParams,
    loaderFn: (start: number, count: number) => Promise<any[]>
  ) => Promise<{ entities: any[], rowData: any[] }>>(
    async () => ({ entities: [], rowData: [] })
  );


  useEffect(() => {
    if (!normalizedColumns.length) return;

    fetchDataRef.current = async (params: IGetRowsParams) => {
      // your existing fetchData logic
      let entities = await fetchPage(params.startRow, params.endRow - params.startRow);
      const rowData = entities.map((data: any) => {
        const row: any = {};
        normalizedColumns.forEach((col) => {
          row[col.title] = data[col.source];
        });
        return row;
      });
      return { entities, rowData };
    };
  }, [normalizedColumns]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // save initial column state on first load
    setInitialColumnState(params.api.getColumnState());
    params.api.setGridOption('datasource', {
      getRows: async (rowParams: IGetRowsParams) => {
        let entities: any[] = [];
        let rowData: any[] = [];
        let length = 0;
        if (!isEqual(rowParams.filterModel, {})) {
          const filterQueries = buildFilterQueries(rowParams.filterModel, normalizedColumns);
          const queryStr = filterQueries.filter(Boolean).join(' AND ');
          const { entitysel } = searchDs as any;
          const dataSetName = entitysel?.getServerRef();
          (searchDs as any).entitysel = searchDs.dataclass.query(queryStr, {
            dataSetName,
            filterAttributes: searchDs.filterAttributesText || searchDs._private.filterAttributes,
          });
          await applySorting(rowParams, normalizedColumns, searchDs);
          if (fetchDataRef.current) {
            const result = await fetchDataRef.current(rowParams, fetchClone);
            entities = result.entities;
            rowData = result.rowData;
            length = searchDs.entitysel._private.selLength;
          }
        } else {
          await applySorting(rowParams, normalizedColumns, ds);
          if (fetchDataRef.current) {
            const result = await fetchDataRef.current(rowParams, fetchPage);
            entities = result.entities;
            rowData = result.rowData;
            length = (ds as any).entitysel._private.selLength;
          }
        }
        if (Array.isArray(entities)) {
          rowParams.successCallback(rowData, length);
        } else {
          rowParams.failCallback();
        }
        getSelectedRow(params.api);
      },
    });
    getState(params);
  }, []);

  const handleColumnToggle = (colField: string) => {
    setColumnVisibility(prev =>
      prev.map(c => c.field === colField ? { ...c, isHidden: !c.isHidden } : c)
    );
  };

  const resetColumnview = () => {
    if (!gridRef.current) return;
    // Restore the first 10 visible columns logic
    setColumnVisibility(initialColumnState);
    gridRef.current.api.applyColumnState({
      state: initialColumnState.map((col: any) => ({
        colId: col.field,
        hide: col.isHidden,
        pinned: col.pinned ?? null,
      })),
      applyOrder: true,
    });
    //Clear all filters
    gridRef.current.api.setFilterModel(null);
    setSelectedView('');
  };

  const handlePinChange = (colField: string, value: string) => {
    setColumnVisibility(prev =>
      prev.map(col => {
        if (col.field !== colField) return col;
        //  pinnedValue : 'left' | 'right' | null
        const pinnedValue = value === 'unpinned' ? null : (value as 'left' | 'right');
        return {
          ...col,
          pinned: pinnedValue,
        };
      })
    );
  };

  // views actions
  const saveNewView = () => {
    if (!viewName.trim()) return;
    const columnState = gridRef.current?.api?.getColumnState();
    const filterModel = gridRef.current?.api?.getFilterModel();
    const newView = { name: viewName, columnState, filterModel };
    const updatedViews: any = [...savedViews, newView];
    setSavedViews(updatedViews);
    if (saveLocalStorage) {
      localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    } else if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const gridData = {
          ...currentData,
          savedViews: updatedViews
        };
        stateDS.setValue(null, gridData);
      })
    }
    setViewName('');
  }

  const loadView = () => {
    const view: any = savedViews.find(view => view.name === selectedView);
    if (!view) return;
    if (view.columnState && gridRef.current?.api) {
      gridRef.current.api.applyColumnState({ state: view.columnState, applyOrder: true });
      // Restore filter model of selected view
      if (view.filterModel) {
        gridRef.current.api.setFilterModel(view.filterModel);
      }
      const updatedVisibility = view.columnState.map((col: any) => ({
        field: col.colId,
        isHidden: col.hide || false,
        pinned: col.pinned || null,
      }));
      setColumnVisibility(updatedVisibility);
    }
  };

  const deleteView = () => {
    const updatedViews = savedViews.filter(view => view.name !== selectedView);
    setSavedViews(updatedViews);
    if (saveLocalStorage) {
      localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    } else if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const gridData = {
          ...currentData,
          savedViews: updatedViews
        };
        stateDS.setValue(null, gridData);
      })
    }
    resetColumnview()
  }

  const updateView = () => {
    const columnState = gridRef.current?.api?.getColumnState();
    const filterModel = gridRef.current?.api?.getFilterModel();
    const updatedViews = savedViews.map(view => {
      if (view.name === selectedView) {
        return { ...view, columnState, filterModel };
      }
      return view;
    });
    setSavedViews(updatedViews);
    if (saveLocalStorage) {
      localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    } else if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const gridData = {
          ...currentData,
          savedViews: updatedViews
        };
        stateDS.setValue(null, gridData);
      })
    }
  }

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      {datasource ? (
        <div className="flex flex-col gap-2 h-full">
          {/* AGGrid header actions */}
          <div className="grid-header flex gap-2 items-center cursor-pointer flex-wrap">
            {/* actions section */}
            <div className="actions-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
              <span className="actions-title font-semibold">Actions:</span>
              <div className="flex gap-2">
                <Element id="agGridActions" is={resolver.StyleBox} canvas />
              </div>
            </div>
            {/* columns customizer button */}
            <div className="customizer-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
              <span className="customizer-title font-semibold">View:</span>
              <div className="flex gap-2">
                <button
                  className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                  onClick={() => setShowPropertiesDialog(true)}
                >
                  Customize columns
                </button>
                <button
                  className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                  onClick={resetColumnview}
                >
                  Reset default view
                </button>
              </div>
            </div>
            {/* new view section */}
            <div className="view-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
              <span className="view-title font-semibold">Save view:</span>
              <div className="flex gap-2">
                <input type="text" placeholder="View name" className="view-input rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" value={viewName} onChange={(e: any) => { setViewName(e.target.value) }} />
                <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={saveNewView}>Save new</button>
              </div>
            </div>
            {/* saved views section */}
            <div className="views-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
              <span className="views-title font-semibold">Saved views:</span>
              <div className="flex gap-2">
                <select
                  value={selectedView}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800"
                  onChange={(e: any) => { setSelectedView(e.target.value) }}>
                  <option value="">Select view</option>
                  {savedViews.map((view, _) => (
                    <option value={view.name}>{view.name}</option>
                  ))}
                </select>
                <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={loadView}>Load</button>
                <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={updateView}>Overwrite</button>
                <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={deleteView}>Delete</button>

              </div>
            </div>
          </div>
          {/* columns customizer dialog */}
          {showPropertiesDialog && (
            <div
              className="customizer-dialog fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[1000]"
              onClick={() => setShowPropertiesDialog(false)}
            >
              <div
                className="bg-white rounded-lg overflow-y-auto shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
                style={{
                  maxHeight: '80vh',
                  minWidth: '50%'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4 bg-gray-100 p-4 bottom-px">
                  <div className='flex flex-col'>
                    <h1 className="text-lg font-bold">COLUMN STATE</h1>
                    <span>Show or hide columns for this grid view</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 bg-gray-300 text-gray-700 p-2"
                    onClick={() => setShowPropertiesDialog(false)}           >
                    Close
                  </button>
                </div>
                {normalizedColumns.length === 0 ? (
                  <li>No properties found.</li>
                ) : (() => {
                  // Get top-level storage columns (no dots in name)
                  const topLevelStorageColumns = columnVisibility.filter((column) => {
                    const propMeta = normalizedColumns.find((p) => p.title === column.field);
                    return propMeta?.kind === 'storage' && !column.field.includes('.');
                  });
                  // Get related entity columns (with dots)
                  const relatedColumns = columnVisibility.filter((column) => {
                    return column.field.includes('.');
                  });
                  // Combine: top-level first, then related
                  const toDisplay = [...topLevelStorageColumns, ...relatedColumns];
                  return toDisplay.map((column, idx) => {
                    if (column.field === "ag-Grid-SelectionColumn") return null;
                    // const isInFirstTen = firstTenNames.has(column.field);
                    return (
                      <div
                        key={idx}
                        className="w-full bg-white rounded-md shadow-sm flex items-center gap-2 px-4 py-2 mb-2 text-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={!column.isHidden}
                          onChange={() => handleColumnToggle(column.field)}
                        />
                        <span>{column.field}</span>
                        <select
                          value={column.pinned || "unpinned"}
                          className="ml-auto border border-gray-300 rounded-md p-1"
                          onChange={(e) => handlePinChange(column.field, e.target.value)}
                        >
                          <option value="unpinned">Unpinned</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
          <AgGridReact
            ref={gridRef}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            onRowClicked={onRowClicked}
            onSelectionChanged={onSelectionChanged}
            onRowDoubleClicked={onRowDoubleClicked}
            onGridReady={onGridReady}
            rowModelType="infinite"
            rowSelection={{
              mode: multiSelection ? 'multiRow' : 'singleRow',
              enableClickSelection: !multiSelection,
              checkboxes: multiSelection,
            }}
            cacheBlockSize={100}
            maxBlocksInCache={10}
            cacheOverflowSize={2}
            maxConcurrentDatasourceRequests={1}
            rowBuffer={0}
            onStateUpdated={onStateUpdated}
            onCellClicked={onCellClicked}
            onCellDoubleClicked={onCellDoubleClicked}
            onColumnHeaderClicked={onHeaderClicked}
            onCellMouseDown={onCellMouseDown}
            onCellMouseOut={onCellMouseOut}
            onCellMouseOver={onCellMouseOver}
            onCellKeyDown={onCellKeyDown}
            theme={theme}
            className={cn({ 'pointer-events-none opacity-40': disabled })}
            columnHoverHighlight={enableColumnHover}
          />
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error</p>
        </div>
      )}
    </div>
  );
};

export default FullAgGrid;