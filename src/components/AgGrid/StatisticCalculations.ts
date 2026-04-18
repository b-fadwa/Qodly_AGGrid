import { IColumn } from './AgGrid.config';
import { isBooleanLikeColumn } from './AgGrid.filtering';

export type StatsOperation = 'sum' | 'average' | 'min' | 'max';

export type StatisticCalculationItem = {
  columnTitle: string;
  columnSource: string;
  dataType: string;
  operation: StatsOperation;
};

/** Generic numeric field — use for any dataclass / entity / custom catalogue (not only Ag Grid). */
export type StatisticFieldDescriptor = {
  /** Stable id used for selection (matches datasource field / grid colId). */
  id: string;
  label: string;
  source: string;
  dataType: string;
};

/** Ag Grid toolbar: same as {@link StatisticFieldDescriptor} with `colId` alias for UI state. */
export type AgGridStatisticsColumn = StatisticFieldDescriptor & {
  colId: string;
};

export type CalculsStatistiquePayload = {
  filterQuery: string;
  calculations: StatisticCalculationItem[];
};

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Reusable statistic request/response helpers for Qodly grids, lists, or any numeric field set.
 * Use {@link StatisticCalculations.fromAgGridColumns} for Ag Grid, or build
 * {@link StatisticFieldDescriptor} arrays yourself for other dataclasses.
 */
export class StatisticCalculations {
  static readonly ALL_OPERATIONS: readonly StatsOperation[] = [
    'sum',
    'average',
    'min',
    'max',
  ];

  /** Ag Grid: columns whose datatype is `number` (excludes boolean-style number columns). */
  static fromAgGridColumns(columns: IColumn[]): AgGridStatisticsColumn[] {
    const isNumberType = (col: IColumn) =>
      String(col.dataType ?? '')
        .trim()
        .toLowerCase() === 'number' && !isBooleanLikeColumn(col);
    return columns
      .filter((col) => isNumberType(col))
      .map((col) => {
        const stableId =
          String(col.source ?? '')
            .trim() !== ''
            ? col.source
            : col.title;
        return {
          id: stableId,
          colId: stableId,
          label: col.title,
          source: col.source,
          dataType: col.dataType,
        };
      });
  }

  /** Convert generic fields to Ag Grid column shape (id duplicated as colId). */
  static toAgGridColumns(fields: StatisticFieldDescriptor[]): AgGridStatisticsColumn[] {
    return fields.map((f) => ({
      ...f,
      colId: f.id,
    }));
  }

  static toFieldDescriptors(columns: AgGridStatisticsColumn[]): StatisticFieldDescriptor[] {
    return columns.map((c) => ({
      id: c.colId,
      label: c.label,
      source: c.source,
      dataType: c.dataType,
    }));
  }

  /**
   * Cartesian product of selected field ids × selected operations.
   * Works with any {@link StatisticFieldDescriptor} list (your dataclass attributes, etc.).
   */
  static buildCalculationItems(
    fields: StatisticFieldDescriptor[],
    selectedFieldIds: string[],
    selectedOperations: StatsOperation[],
  ): StatisticCalculationItem[] {
    const byId = new Map(fields.map((f) => [f.id, f] as const));
    const out: StatisticCalculationItem[] = [];
    const opSet = new Set(selectedOperations);
    for (const id of selectedFieldIds) {
      const f = byId.get(id);
      if (!f) continue;
      for (const op of StatisticCalculations.ALL_OPERATIONS) {
        if (!opSet.has(op)) continue;
        out.push({
          columnTitle: f.label,
          columnSource: f.source,
          dataType: f.dataType,
          operation: op,
        });
      }
    }
    return out;
  }

  /** Same as {@link buildCalculationItems} but takes Ag Grid column rows from the component. */
  static buildCalculationItemsForAgGrid(
    columns: AgGridStatisticsColumn[],
    selectedColumnIds: string[],
    selectedOperations: StatsOperation[],
  ): StatisticCalculationItem[] {
    return StatisticCalculations.buildCalculationItems(
      StatisticCalculations.toFieldDescriptors(columns),
      selectedColumnIds,
      selectedOperations,
    );
  }

  static buildPayload(
    filterQuery: string,
    calculations: StatisticCalculationItem[],
  ): CalculsStatistiquePayload {
    return { filterQuery, calculations };
  }

  /** French-style numbers: spaces as thousands, comma decimals. */
  static formatNumberFr(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    if (typeof value === 'string') {
      const normalized = value
        .replace(/\u202f|\u00a0|\s/g, '')
        .replace(',', '.');
      const n = Number(normalized);
      if (Number.isFinite(n)) {
        return new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(n);
      }
    }
    return formatJson(value);
  }

  static formatDisplayValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return StatisticCalculations.formatNumberFr(value);
    }
    if (typeof value === 'string') {
      const normalized = value
        .replace(/\u202f|\u00a0|\s/g, '')
        .replace(',', '.');
      if (normalized !== '' && Number.isFinite(Number(normalized))) {
        return StatisticCalculations.formatNumberFr(value);
      }
    }
    if (typeof value === 'object') {
      return formatJson(value);
    }
    return String(value);
  }

  /** JSON string from scalar DS, optional wrapper object, or `Results` / `Operation` casing from 4D. */
  static unwrapResultsPayload(response: unknown): Record<string, unknown> | null {
    const parsed = StatisticCalculations.coerceToObjectRoot(response);
    if (!parsed) return null;
    return StatisticCalculations.unwrapNestedResultsContainer(parsed);
  }

  private static coerceToObjectRoot(response: unknown): Record<string, unknown> | null {
    if (response === undefined || response === null) return null;
    if (typeof response === 'string') {
      const t = response.trim();
      if (
        (t.startsWith('{') && t.endsWith('}')) ||
        (t.startsWith('[') && t.endsWith(']'))
      ) {
        try {
          return StatisticCalculations.coerceToObjectRoot(JSON.parse(t));
        } catch {
          return null;
        }
      }
      return null;
    }
    if (Array.isArray(response)) {
      const first = response[0];
      if (
        first &&
        typeof first === 'object' &&
        StatisticCalculations.looksLikeResultRow(first as Record<string, unknown>)
      ) {
        return { results: response };
      }
      return null;
    }
    if (typeof response !== 'object') return null;
    return response as Record<string, unknown>;
  }

  private static looksLikeResultRow(o: Record<string, unknown>): boolean {
    const title =
      o.columnTitle ?? o.ColumnTitle ?? o.column ?? o.Column;
    const op = o.operation ?? o.Operation;
    return (
      typeof title === 'string' &&
      title.trim() !== '' &&
      (typeof op === 'string' || typeof op === 'number')
    );
  }

  /** If the payload is `{ data: { results } }` or only `value` holds the object. */
  private static unwrapNestedResultsContainer(
    root: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (StatisticCalculations.getResultsArray(root) != null) return root;
    const inner =
      root.data ??
      root.value ??
      root.result ??
      root.payload ??
      root.Data ??
      root.Value;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const innerObj = StatisticCalculations.coerceToObjectRoot(inner);
      if (innerObj && StatisticCalculations.getResultsArray(innerObj) != null) {
        return innerObj;
      }
    }
    return root;
  }

  private static getResultsArray(
    root: Record<string, unknown>,
  ): unknown[] | null {
    const candidates = [
      root.results,
      root.Results,
      ...Object.entries(root)
        .filter(([k, v]) => k.toLowerCase() === 'results' && Array.isArray(v))
        .map(([, v]) => v),
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
    return null;
  }

  static normalizeOperationToken(raw: unknown): StatsOperation | undefined {
    if (raw === undefined || raw === null) return undefined;
    const s = String(raw).trim().toLowerCase();
    if (s === 'mean' || s === 'avg') return 'average';
    if (s === 'minimum') return 'min';
    if (s === 'maximum') return 'max';
    if (s === 'sum' || s === 'average' || s === 'min' || s === 'max') return s;
    return undefined;
  }

  private static resultRowOperationMatches(
    row: Record<string, unknown>,
    expected: StatsOperation,
  ): boolean {
    const raw = row.operation ?? row.Operation;
    return StatisticCalculations.normalizeOperationToken(raw) === expected;
  }

  /** Unique field rows inferred from `{ results: [{ columnTitle, ... }] }` (backend shape). */
  static fieldRowsFromResultsResponse(
    response: unknown,
  ): Array<{ columnTitle: string; columnSource: string }> {
    const root = StatisticCalculations.unwrapResultsPayload(response);
    if (!root) return [];
    const results = StatisticCalculations.getResultsArray(root);
    if (!results) return [];
    const m = new Map<string, { columnTitle: string; columnSource: string }>();
    for (const item of results) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const ct = o.columnTitle ?? o.ColumnTitle;
      if (typeof ct !== 'string' || !ct.trim()) continue;
      if (!m.has(ct)) {
        m.set(ct, {
          columnTitle: ct,
          columnSource:
            typeof o.columnSource === 'string'
              ? o.columnSource
              : typeof o.ColumnSource === 'string'
                ? o.ColumnSource
                : '',
        });
      }
    }
    return Array.from(m.values());
  }

  private static resultsRowMatchesField(
    x: Record<string, unknown>,
    columnTitle: string,
    columnSource: string,
  ): boolean {
    const ct = x.columnTitle ?? x.ColumnTitle;
    const cs = x.columnSource ?? x.ColumnSource;
    if (typeof ct === 'string' && typeof columnTitle === 'string') {
      if (ct === columnTitle || ct.trim() === columnTitle.trim()) return true;
    }
    if (columnSource && typeof columnSource === 'string') {
      if (typeof cs === 'string' && cs === columnSource) return true;
      if (typeof ct === 'string' && ct === columnSource) return true;
    }
    return false;
  }

  /**
   * Read one cell from the scalar result object returned by the server.
   * Supports `results[]`, nested by column title, flat `title|op` keys, and `values` bag.
   */
  static getCellValue(
    response: unknown,
    columnTitle: string,
    operation: StatsOperation,
    columnSource: string,
  ): unknown {
    const r = StatisticCalculations.unwrapResultsPayload(response);
    if (r === null) return undefined;

    const resultsItems = StatisticCalculations.getResultsArray(r);
    if (resultsItems) {
      const row = resultsItems.find(
        (x) =>
          x &&
          typeof x === 'object' &&
          StatisticCalculations.resultsRowMatchesField(
            x as Record<string, unknown>,
            columnTitle,
            columnSource,
          ) &&
          StatisticCalculations.resultRowOperationMatches(
            x as Record<string, unknown>,
            operation,
          ),
      );
      if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>;
        if ('value' in o) return o.value;
        if ('Value' in o) return o.Value;
      }
    }

    const byCol = r[columnTitle];
    if (byCol && typeof byCol === 'object' && !Array.isArray(byCol)) {
      const v = (byCol as Record<string, unknown>)[operation];
      if (v !== undefined) return v;
    }

    const keyTitle = `${columnTitle}|${operation}`;
    if (keyTitle in r) return r[keyTitle];
    const keySource = `${columnSource}|${operation}`;
    if (columnSource && keySource in r) return r[keySource];

    const values = r.values;
    if (values && typeof values === 'object' && !Array.isArray(values)) {
      const vs = values as Record<string, unknown>;
      if (keyTitle in vs) return vs[keyTitle];
      if (columnSource && keySource in vs) return vs[keySource];
    }

    return undefined;
  }

  /**
   * TSV: header `field\tsum\taverage\tmin\tmax`, then one row per field with four metric columns.
   */
  static buildCopyTsv(
    response: unknown,
    fieldRows: Array<{ columnTitle: string; columnSource: string }>,
  ): string {
    const ops = [...StatisticCalculations.ALL_OPERATIONS];
    const lines = [['field', ...ops].join('\t')];
    for (const f of fieldRows) {
      const cells = [f.columnTitle.trim() || '—'];
      for (const op of ops) {
        const raw = StatisticCalculations.getCellValue(
          response,
          f.columnTitle,
          op,
          f.columnSource,
        );
        cells.push(
          raw === undefined ? '—' : StatisticCalculations.formatNumberFr(raw) || '—',
        );
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
}

/** @deprecated Use {@link StatisticCalculations.getCellValue} */
export const getStatisticCellValue = (
  response: unknown,
  columnTitle: string,
  operation: StatsOperation,
  columnSource: string,
): unknown =>
  StatisticCalculations.getCellValue(response, columnTitle, operation, columnSource);
