import {
  PrintFormatValue,
  PrintSettingsColumn,
  PrintSubtotalRule,
  SubtotalFunction,
  printColumnId,
} from './PrintSettings.types';

export const DATE_FORMATS = [
  'DD-MM-YYYY',
  'YYYY-WW',
  'YYYY-MM',
  'YYYY-TT',
  'YYYY-SS',
  'YYYY',
  'DD-MM-YYYY dddd',
];

export const SUBTOTAL_FUNCTIONS: Array<{ value: SubtotalFunction; label: string }> = [
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'min', label: 'Smallest value' },
  { value: 'max', label: 'Largest value' },
  { value: 'count', label: 'Count' },
  { value: 'product', label: 'Product' },
  { value: 'standardDeviation', label: 'Standard deviation' },
  { value: 'standardDeviationPopulation', label: 'Standard deviation (population)' },
  { value: 'variance', label: 'Variance' },
  { value: 'variancePopulation', label: 'Variance (population)' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function humanizePath(path: string): string {
  const segment = path.split('.').pop()?.replace(/\[\]/g, '') || path;
  const spaced = segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : path;
}

function inferDataType(value: unknown): string {
  if (typeof value === 'string' && /^!!\d{4}-\d{2}-\d{2}(?:[T ][^!]*)?!!$/.test(value)) {
    return 'date';
  }
  if (value instanceof Date) return 'date';
  // JSON does not preserve the source schema's integer/real distinction. Treat numeric
  // values as real unless an AG Grid column-state entry explicitly provides another type.
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (isRecord(value)) return 'object';
  return 'string';
}

/** Build printable field descriptors from AG Grid view state or a nested scalar object. */
export function extractPrintColumns(state: unknown): PrintSettingsColumn[] {
  if (!isRecord(state)) return [];

  if (Array.isArray(state.columnState)) {
    return state.columnState
      .filter(isRecord)
      .map((column, index) => {
        const source = String(column.colId ?? column.field ?? column.source ?? `column-${index + 1}`);
        return {
          id: source,
          source,
          title: String(
            column.headerName ?? column.displayName ?? column.label ?? column.title ?? humanizePath(source),
          ),
          dataType: String(column.dataType ?? column.type ?? 'string'),
          format: typeof column.format === 'string' ? column.format : '',
          hidden: Boolean(column.hide ?? column.hidden),
        };
      });
  }

  const byPath = new Map<string, PrintSettingsColumn>();
  const visitedObjects = new WeakSet<object>();
  let visitedNodes = 0;
  const visit = (value: unknown, path: string, depth: number) => {
    visitedNodes += 1;
    if (!path || byPath.size >= 250 || visitedNodes > 5000 || depth > 12) return;
    if ((Array.isArray(value) || isRecord(value)) && visitedObjects.has(value)) return;
    if (Array.isArray(value) || isRecord(value)) visitedObjects.add(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      const samples = value.slice(0, 3);
      if (samples.some(isRecord)) {
        samples.filter(isRecord).forEach((sample) => {
          Object.entries(sample).forEach(([key, child]) => visit(child, `${path}[].${key}`, depth + 1));
        });
      } else {
        byPath.set(path, {
          id: path,
          source: path,
          title: humanizePath(path),
          dataType: inferDataType(value[0]),
        });
      }
      return;
    }
    if (isRecord(value)) {
      Object.entries(value).forEach(([key, child]) => visit(child, `${path}.${key}`, depth + 1));
      return;
    }
    byPath.set(path, {
      id: path,
      source: path,
      title: humanizePath(path),
      dataType: inferDataType(value),
      format: inferDataType(value) === 'date' ? DATE_FORMATS[0] : '',
    });
  };

  Object.entries(state).forEach(([key, value]) => visit(value, key, 0));
  return [...byPath.values()];
}

export function normalizePrintFormat(
  candidate: unknown,
  columns: PrintSettingsColumn[],
): PrintFormatValue {
  const raw: Record<string, unknown> = isRecord(candidate) ? candidate : {};
  const configuredIds = columns.map(printColumnId);
  const configuredSet = new Set(configuredIds);
  const incomingState = Array.isArray(raw.columnState) ? raw.columnState : [];
  const seen = new Set<string>();
  const columnState = incomingState
    .map((item) => {
      const record = isRecord(item) ? item : {};
      return { colId: String(record.colId ?? ''), hidden: Boolean(record.hidden) };
    })
    .filter((item) => {
      if (!item.colId || !configuredSet.has(item.colId) || seen.has(item.colId)) return false;
      seen.add(item.colId);
      return true;
    });
  configuredIds.forEach((colId) => {
    if (!seen.has(colId)) {
      const column = columns[configuredIds.indexOf(colId)];
      columnState.push({ colId, hidden: Boolean(column?.hidden) });
    }
  });

  const dateFormats: Record<string, string> = {};
  if (isRecord(raw.dateFormats)) {
    Object.entries(raw.dateFormats).forEach(([key, value]) => {
      if (typeof value === 'string') dateFormats[key] = value;
    });
  }
  columns.forEach((column, index) => {
    if (column.dataType !== 'date') return;
    const colId = printColumnId(column, index);
    if (!dateFormats[colId]) dateFormats[colId] = column.format || DATE_FORMATS[0];
  });

  const subtotals = Array.isArray(raw.subtotals)
    ? raw.subtotals
        .map((item, index): PrintSubtotalRule => {
          const rule = isRecord(item) ? item : {};
          const fn = SUBTOTAL_FUNCTIONS.some((entry) => entry.value === rule.function)
            ? (rule.function as SubtotalFunction)
            : 'sum';
          return {
            id: String(rule.id || `subtotal-${index + 1}`),
            breakColumn: String(rule.breakColumn || ''),
            function: fn,
            targetColumns: Array.isArray(rule.targetColumns)
              ? rule.targetColumns.map(String).filter((id) => configuredSet.has(id))
              : [],
          };
        })
        .filter((rule) => configuredSet.has(rule.breakColumn))
    : [];

  return {
    representation: raw.representation === 'table' ? 'table' : 'list',
    columnState,
    dateFormats,
    subtotals,
  };
}
