import { format } from 'date-fns';

export const MAX_FILTER_CONDITIONS = 10;

const NUMERIC_DATA_TYPES = new Set(['word', 'short', 'long', 'number', 'long64', 'duration']);
const TEXT_DATA_TYPES = new Set(['text', 'string', 'uuid']);
const NON_FILTERABLE_DATA_TYPES = new Set(['image', 'object', 'blob']);

const normalizeDataType = (dataType: string | undefined): string =>
  String(dataType ?? '')
    .trim()
    .toLowerCase();

const isNumericDataType = (dataType: string | undefined): boolean =>
  NUMERIC_DATA_TYPES.has(normalizeDataType(dataType));
const isTextDataType = (dataType: string | undefined): boolean =>
  TEXT_DATA_TYPES.has(normalizeDataType(dataType));
const isNonFilterableDataType = (dataType: string | undefined): boolean =>
  NON_FILTERABLE_DATA_TYPES.has(normalizeDataType(dataType));

const toFiniteNumber = (value: any): number | null => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumberCollectionValues = (raw: any): number[] => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return [raw];
  return String(raw ?? '')
    .split(',')
    .map((value) => toFiniteNumber(value))
    .filter((value): value is number => value !== null);
};

export const isBooleanLikeColumn = (column: any): boolean =>
  normalizeDataType(column?.dataType) === 'bool' ||
  (normalizeDataType(column?.dataType) === 'number' &&
    ['checkbox', 'icon', 'boolean'].includes(column?.format));

export const getColumnFilterType = (column: any, isBooleanColumn: boolean): string | false => {
  if (!column?.filtering) return false;
  if (isBooleanColumn) return 'agNumberColumnFilter';
  if (isTextDataType(column?.dataType)) return 'agTextColumnFilter';
  if (isNumericDataType(column?.dataType)) return 'agTextColumnFilter';
  if (normalizeDataType(column?.dataType) === 'date') return 'agDateColumnFilter';
  if (isNonFilterableDataType(column?.dataType)) return false;
  return 'agTextColumnFilter';
};

export const getColumnFilterParams = (column: any, isBooleanColumn: boolean) => {
  const isNumericColumn = !isBooleanColumn && isNumericDataType(column?.dataType);
  const filterOptions = isBooleanColumn
    ? [
        'empty',
        {
          displayKey: 'isTrue',
          displayName: 'true',
          predicate: (_: any[], cellValue: any) => cellValue === true,
          numberOfInputs: 0,
        },
        {
          displayKey: 'isFalse',
          displayName: 'false',
          predicate: (_: any[], cellValue: any) => cellValue === false,
          numberOfInputs: 0,
        },
        'blank',
        'notBlank',
      ]
    : isTextDataType(column?.dataType)
      ? [
          'contains',
          'equals',
          {
            displayKey: 'inCollection',
            displayName: 'in collection',
            predicate: (filterValues: any[], cellValue: any) => {
              const values = String(filterValues?.[0] ?? '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
              return values.some((value) => String(cellValue) === value);
            },
            numberOfInputs: 1,
          },
          'notEqual',
          'startsWith',
          'endsWith',
        ]
      : isNumericColumn
        ? [
            {
              displayKey: 'equals',
              displayName: 'equals',
              predicate: (filterValues: any[], cellValue: any) => {
                const filterValue = toFiniteNumber(filterValues?.[0]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (filterValue === null || numericCellValue === null) return false;
                return numericCellValue === filterValue;
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'inCollection',
              displayName: 'in collection',
              predicate: (filterValues: any[], cellValue: any) => {
                const values = parseNumberCollectionValues(filterValues?.[0]);
                if (!values.length) return false;
                const numericCellValue = toFiniteNumber(cellValue);
                if (numericCellValue === null) return false;
                return values.some((value) => value === numericCellValue);
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'notEqual',
              displayName: 'not equal',
              predicate: (filterValues: any[], cellValue: any) => {
                const filterValue = toFiniteNumber(filterValues?.[0]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (filterValue === null || numericCellValue === null) return false;
                return numericCellValue !== filterValue;
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'greaterThan',
              displayName: 'greater than',
              predicate: (filterValues: any[], cellValue: any) => {
                const filterValue = toFiniteNumber(filterValues?.[0]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (filterValue === null || numericCellValue === null) return false;
                return numericCellValue > filterValue;
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'greaterThanOrEqual',
              displayName: 'greater than or equal',
              predicate: (filterValues: any[], cellValue: any) => {
                const filterValue = toFiniteNumber(filterValues?.[0]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (filterValue === null || numericCellValue === null) return false;
                return numericCellValue >= filterValue;
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'lessThan',
              displayName: 'less than',
              predicate: (filterValues: any[], cellValue: any) => {
                const filterValue = toFiniteNumber(filterValues?.[0]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (filterValue === null || numericCellValue === null) return false;
                return numericCellValue < filterValue;
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'lessThanOrEqual',
              displayName: 'less than or equal',
              predicate: (filterValues: any[], cellValue: any) => {
                const filterValue = toFiniteNumber(filterValues?.[0]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (filterValue === null || numericCellValue === null) return false;
                return numericCellValue <= filterValue;
              },
              numberOfInputs: 1,
            },
            {
              displayKey: 'inRange',
              displayName: 'in range',
              predicate: (filterValues: any[], cellValue: any) => {
                const from = toFiniteNumber(filterValues?.[0]);
                const to = toFiniteNumber(filterValues?.[1]);
                const numericCellValue = toFiniteNumber(cellValue);
                if (from === null || to === null || numericCellValue === null) return false;
                return numericCellValue >= from && numericCellValue <= to;
              },
              numberOfInputs: 2,
            },
          ]
        : normalizeDataType(column?.dataType) === 'date'
          ? ['equals', 'notEqual', 'greaterThan', 'lessThan', 'inRange']
          : isNonFilterableDataType(column?.dataType)
            ? []
            : ['contains', 'equals', 'notEqual', 'startsWith', 'endsWith'];

  return {
    filterOptions,
    defaultOption: isBooleanColumn ? 'empty' : 'equals',
    maxNumConditions: isBooleanColumn ? 1 : MAX_FILTER_CONDITIONS,
  };
};

const splitCollectionValues = (raw: any): string[] =>
  String(raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const joinWithOr = (queries: string[]) =>
  queries.length > 1 ? `(${queries.join(' OR ')})` : (queries[0] ?? '');

export const buildFilterQuery = (filter: any, source: string, column?: any): string => {
  const filterType = filter.filterType;
  const filterValue = filter.filter;
  const isNumericTextFilter = isNumericDataType(column?.dataType) && !isBooleanLikeColumn(column);

  switch (filterType) {
    case 'text':
      if (isNumericTextFilter) {
        switch (filter.type) {
          case 'equals': {
            const values = parseNumberCollectionValues(filterValue);
            if (!values.length) return '';
            if (values.length > 1)
              return joinWithOr(values.map((value) => `${source} == ${value}`));
            return `${source} == ${values[0]}`;
          }
          case 'inCollection': {
            const values = parseNumberCollectionValues(filterValue);
            if (!values.length) return '';
            return joinWithOr(values.map((value) => `${source} == ${value}`));
          }
          case 'notEqual': {
            const value = toFiniteNumber(filterValue);
            return value === null ? '' : `${source} != ${value}`;
          }
          case 'greaterThan': {
            const value = toFiniteNumber(filterValue);
            return value === null ? '' : `${source} > ${value}`;
          }
          case 'greaterThanOrEqual': {
            const value = toFiniteNumber(filterValue);
            return value === null ? '' : `${source} >= ${value}`;
          }
          case 'lessThan': {
            const value = toFiniteNumber(filterValue);
            return value === null ? '' : `${source} < ${value}`;
          }
          case 'lessThanOrEqual': {
            const value = toFiniteNumber(filterValue);
            return value === null ? '' : `${source} <= ${value}`;
          }
          case 'inRange': {
            const from = toFiniteNumber(filter.filter);
            const to = toFiniteNumber(filter.filterTo);
            if (from === null || to === null) return '';
            return `${source} >= ${from} AND ${source} <= ${to}`;
          }
          default:
            return '';
        }
      }
      switch (filter.type) {
        case 'contains': {
          const values = splitCollectionValues(filterValue);
          if (values.length > 1)
            return joinWithOr(values.map((value) => `${source} == "@${value}@"`));
          return `${source} == "@${filterValue}@"`;
        }
        case 'equals': {
          const values = splitCollectionValues(filterValue);
          if (values.length > 1)
            return joinWithOr(values.map((value) => `${source} == "${value}"`));
          return `${source} == "${filterValue}"`;
        }
        case 'inCollection': {
          const values = splitCollectionValues(filterValue);
          if (!values.length) return '';
          return joinWithOr(values.map((value) => `${source} == "${value}"`));
        }
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
        case 'empty':
          return '';
        case 'isTrue':
          return `${source} = true`;
        case 'isFalse':
          return `${source} = false`;
        case 'blank':
          return `${source} == null`;
        case 'notBlank':
          return `${source} != null`;
        case 'equals': {
          const values = parseNumberCollectionValues(filterValue);
          if (!values.length) return '';
          if (values.length > 1) return joinWithOr(values.map((value) => `${source} == ${value}`));
          return `${source} == ${values[0]}`;
        }
        case 'inCollection': {
          const values = parseNumberCollectionValues(filterValue);
          if (!values.length) return '';
          return joinWithOr(values.map((value) => `${source} == ${value}`));
        }
        case 'notEqual': {
          const value = toFiniteNumber(filterValue);
          return value === null ? '' : `${source} != ${value}`;
        }
        case 'greaterThan': {
          const value = toFiniteNumber(filterValue);
          return value === null ? '' : `${source} > ${value}`;
        }
        case 'greaterThanOrEqual': {
          const value = toFiniteNumber(filterValue);
          return value === null ? '' : `${source} >= ${value}`;
        }
        case 'lessThan': {
          const value = toFiniteNumber(filterValue);
          return value === null ? '' : `${source} < ${value}`;
        }
        case 'lessThanOrEqual': {
          const value = toFiniteNumber(filterValue);
          return value === null ? '' : `${source} <= ${value}`;
        }
        case 'inRange': {
          const from = toFiniteNumber(filter.filter);
          const to = toFiniteNumber(filter.filterTo);
          if (from === null || to === null) return '';
          return `${source} >= ${from} AND ${source} <= ${to}`;
        }
        default:
          return '';
      }
    case 'date': {
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
    }
    default:
      return '';
  }
};

export const buildFilterQueries = (filterModel: any, columns: any[]): string[] => {
  return Object.keys(filterModel).map((key) => {
    const filter = filterModel[key];
    const column = columns.find(
      (col) => col.title === key || col.source === key || String(col.id ?? '') === key,
    );
    if (!column) return '';
    const source = column.source;

    if (filter.operator && filter.conditions) {
      const conditionQueries = filter.conditions
        .map((condition: any) => buildFilterQuery(condition, source, column))
        .filter(Boolean);
      if (!conditionQueries.length) return '';
      return conditionQueries.length === 1
        ? conditionQueries[0]
        : `(${conditionQueries.join(` ${filter.operator} `)})`;
    }

    return buildFilterQuery(filter, source, column);
  });
};
