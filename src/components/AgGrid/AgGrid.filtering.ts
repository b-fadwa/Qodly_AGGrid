import { format } from 'date-fns';

export const MAX_FILTER_CONDITIONS = 10;

/** Columns whose `source` contains this marker (case-insensitive, e.g. `_R_` or `_r_`) use the ref-backed select filter. */
export const REF_SOURCE_MARKER = '_R_';

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

const splitRawCollectionValues = (raw: any): string[] =>
  String(raw ?? '')
    .replace(/\\n/g, '\n')
    .split(/[\n\r,]+/g)
    .map((value) => value.trim())
    .filter(Boolean);

const parseNumberCollectionValues = (raw: any): number[] => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return [raw];
  return splitRawCollectionValues(raw)
    .map((value) => toFiniteNumber(value))
    .filter((value): value is number => value !== null);
};

export const isBooleanLikeColumn = (column: any): boolean =>
  normalizeDataType(column?.dataType) === 'bool' ||
  (normalizeDataType(column?.dataType) === 'number' &&
    ['checkbox', 'icon', 'boolean'].includes(column?.format));

export const extractRefDatasetKeyFromSource = (source: string | undefined): string | null => {
  if (!source) return null;
  const lower = source.toLowerCase();
  const needle = REF_SOURCE_MARKER.toLowerCase();
  const i = lower.indexOf(needle);
  if (i === -1) return null;
  const key = source.slice(i + REF_SOURCE_MARKER.length).trim();
  return key || null;
};

/** i18n path `keys.<key>` where key is `refDatasetKey` + option index (e.g. `16069` + `1` → `160691`). */
export const refOptionI18nCompositeKey = (refDatasetKey: string, optionIndex: number): string =>
  `${String(refDatasetKey).trim()}${optionIndex}`;

export const isRefBackedSourceColumn = (column: any): boolean =>
  extractRefDatasetKeyFromSource(column?.source) !== null;

/** Stored in the grid filter model for ref-backed columns; used by `buildFilterQuery`. */
export const QODLY_REF_SELECT_FILTER_TYPE = 'qodlyRefSelect' as const;

export const getColumnFilterType = (column: any, isBooleanColumn: boolean): string | false => {
  if (!column?.filtering) return false;
  if (isRefBackedSourceColumn(column)) return 'qodlyRefSelectFilter';
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
          displayName: 'True',
          predicate: (_: any[], cellValue: any) => cellValue === true,
          numberOfInputs: 0,
        },
        {
          displayKey: 'isFalse',
          displayName: 'False',
          predicate: (_: any[], cellValue: any) => cellValue === false,
          numberOfInputs: 0,
        },
      ]
    : isTextDataType(column?.dataType)
      ? [
          'contains',
          'equals',
          {
            displayKey: 'inCollection',
            displayName: 'in collection',
            predicate: (filterValues: any[], cellValue: any) => {
              const values = splitRawCollectionValues(filterValues?.[0]);
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
    defaultOption: isBooleanColumn
      ? 'empty'
      : isTextDataType(column?.dataType)
        ? 'contains'
        : 'equals',
    maxNumConditions: isBooleanColumn ? 1 : MAX_FILTER_CONDITIONS,
    buttons: ['apply'],
  };
};

const splitCollectionValues = (raw: any): string[] => splitRawCollectionValues(raw);

const joinWithOr = (queries: string[]) =>
  queries.length > 1 ? `(${queries.join(' OR ')})` : (queries[0] ?? '');

export type QodlyFilterCombinator = 'AND' | 'OR' | 'EXCEPT';

export interface QodlyAdvancedRule {
  field: string;
  combinator: QodlyFilterCombinator;
  condition: any;
}

export const QODLY_ADVANCED_RULES_KEY = '__qodlyAdvancedRules';

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
    case QODLY_REF_SELECT_FILTER_TYPE: {
      const raw = filter.value ?? filter.filter;
      const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
      if (!Number.isFinite(num)) return '';
      return `${source} == ${num}`;
    }
    default:
      return '';
  }
};

/* ------------------------------------------------------------------ *
 * Operator descriptors used by the advanced-filter modal.
 *
 * The modal must offer the *exact same* operators as the per-column
 * filter popups (so toggling between header and modal stays consistent).
 * We derive the descriptors from `getColumnFilterParams(...).filterOptions`
 * so the source of truth stays in this file.
 * ------------------------------------------------------------------ */

export interface FilterOperatorDescriptor {
  /** Matches AG Grid's `filterModel[col].type` (built-in name or custom `displayKey`). */
  key: string;
  /** Display label (English; localized via `useI18n` at the call site if desired). */
  label: string;
  /** Number of value inputs to render (0, 1 or 2). */
  inputs: 0 | 1 | 2;
}

const BUILT_IN_OPERATOR_LABEL: Record<string, string> = {
  contains: 'Contains',
  notContains: 'Does not contain',
  equals: 'Equals',
  notEqual: 'Not equal',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  greaterThan: 'Greater than',
  greaterThanOrEqual: 'Greater than or equal',
  lessThan: 'Less than',
  lessThanOrEqual: 'Less than or equal',
  inRange: 'Between',
  blank: 'Is empty',
  notBlank: 'Is not empty',
  empty: 'Choose one',
};

const BUILT_IN_OPERATOR_INPUTS: Record<string, 0 | 1 | 2> = {
  contains: 1,
  notContains: 1,
  equals: 1,
  notEqual: 1,
  startsWith: 1,
  endsWith: 1,
  greaterThan: 1,
  greaterThanOrEqual: 1,
  lessThan: 1,
  lessThanOrEqual: 1,
  inRange: 2,
  blank: 0,
  notBlank: 0,
  empty: 0,
};

export const getColumnFilterOperators = (column: any): FilterOperatorDescriptor[] => {
  // Ref-backed (`*_R_*`) columns should behave like a select: one value, equals only.
  if (getColumnAgGridFilterType(column) === QODLY_REF_SELECT_FILTER_TYPE) {
    return [{ key: 'equals', label: BUILT_IN_OPERATOR_LABEL.equals ?? 'equals', inputs: 1 }];
  }
  const isBoolean = isBooleanLikeColumn(column);
  const params = getColumnFilterParams(column, isBoolean);
  return ((params.filterOptions ?? []) as any[])
    .map((option): FilterOperatorDescriptor | null => {
      if (typeof option === 'string') {
        if (option === 'empty') return null; // the AG Grid placeholder, not a real operator
        return {
          key: option,
          label: BUILT_IN_OPERATOR_LABEL[option] ?? option,
          inputs: BUILT_IN_OPERATOR_INPUTS[option] ?? 1,
        };
      }
      if (option && typeof option === 'object' && option.displayKey) {
        return {
          key: option.displayKey,
          label: option.displayName ?? option.displayKey,
          inputs: ((option.numberOfInputs ?? 1) as 0 | 1 | 2),
        };
      }
      return null;
    })
    .filter((d): d is FilterOperatorDescriptor => d !== null);
};

/** AG Grid `filterModel` `filterType` discriminator for a given column. */
export const getColumnAgGridFilterType = (
  column: any,
): 'text' | 'number' | 'date' | typeof QODLY_REF_SELECT_FILTER_TYPE | null => {
  const isBoolean = isBooleanLikeColumn(column);
  const filterComponent = getColumnFilterType(column, isBoolean);
  switch (filterComponent) {
    case 'agTextColumnFilter':
      return 'text';
    case 'agNumberColumnFilter':
      return 'number';
    case 'agDateColumnFilter':
      return 'date';
    case 'qodlyRefSelectFilter':
      return QODLY_REF_SELECT_FILTER_TYPE;
    default:
      return null;
  }
};

export const getAdvancedRulesFromFilterModel = (model: any): QodlyAdvancedRule[] => {
  const raw = model?.[QODLY_ADVANCED_RULES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r: any) => r && typeof r === 'object' && r.field && r.condition)
    .map((r: any) => ({
      field: String(r.field),
      combinator: r.combinator === 'OR' || r.combinator === 'EXCEPT' ? r.combinator : 'AND',
      condition: r.condition,
    }));
};

export const stripAdvancedRulesFromFilterModel = (model: any): Record<string, any> => {
  if (!model || typeof model !== 'object' || Array.isArray(model)) return {};
  const next: Record<string, any> = { ...model };
  delete next[QODLY_ADVANCED_RULES_KEY];
  return next;
};

export const withAdvancedRulesOnFilterModel = (
  baseModel: any,
  rules: QodlyAdvancedRule[],
): Record<string, any> => {
  const base = stripAdvancedRulesFromFilterModel(baseModel);
  if (!rules.length) return base;
  return {
    ...base,
    [QODLY_ADVANCED_RULES_KEY]: rules,
  };
};

export const buildAgGridFilterModelFromAdvancedRules = (
  rules: QodlyAdvancedRule[],
): Record<string, any> => {
  const normalizeCombinator = (value: any): QodlyFilterCombinator =>
    value === 'OR' || value === 'EXCEPT' ? value : 'AND';
  const next: Record<string, any> = {};
  rules.forEach((rule) => {
    const columnCombinator = normalizeCombinator(rule.combinator);
    const existing = next[rule.field];
    if (!existing) {
      next[rule.field] = {
        ...rule.condition,
        /** Cross-column combinator used when rebuilding popup/modal state from plain filterModel. */
        qodlyCombinator: columnCombinator,
      };
      return;
    }
    if (rule.combinator !== 'AND' && rule.combinator !== 'OR') return;
    if (existing.conditions && Array.isArray(existing.conditions)) {
      existing.operator = rule.combinator;
      existing.conditions.push(rule.condition);
      return;
    }
    next[rule.field] = {
      filterType: existing.filterType,
      operator: rule.combinator,
      conditions: [existing, rule.condition],
      qodlyCombinator: normalizeCombinator(existing.qodlyCombinator),
    };
  });
  return next;
};

export const buildFilterQueries = (filterModel: any, columns: any[]): string[] => {
  const advancedRules = getAdvancedRulesFromFilterModel(filterModel);
  if (advancedRules.length) {
    const compiled = advancedRules
      .map((rule) => {
        const column = columns.find(
          (col) =>
            col.source === rule.field ||
            col.title === rule.field ||
            String(col.id ?? '') === rule.field,
        );
        if (!column) return null;
        const source = column.source;
        const query = buildFilterQuery(rule.condition, source, column);
        if (!query) return null;
        return { query, combinator: rule.combinator };
      })
      .filter((item): item is { query: string; combinator: QodlyFilterCombinator } => item !== null);
    if (!compiled.length) return [];
    let chain = `(${compiled[0].query})`;
    for (let i = 1; i < compiled.length; i += 1) {
      const part = compiled[i];
      chain = `(${chain}) ${part.combinator} (${part.query})`;
    }
    return [chain];
  }

  return Object.keys(filterModel).map((key) => {
    if (key === QODLY_ADVANCED_RULES_KEY) return '';
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
    } else {
      return buildFilterQuery(filter, source, column);
    }
  });
};
