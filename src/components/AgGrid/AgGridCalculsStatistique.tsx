import {
  FC,
  MutableRefObject,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IoMdClose } from 'react-icons/io';
import { FaCalculator } from 'react-icons/fa';
import { FaCopy } from 'react-icons/fa6';
import { IColumn } from './AgGrid.config';
import { buildFilterQueries } from './AgGrid.filtering';
import { writeTextToClipboard } from './AgGrid.clipboard';
import {
  StatisticCalculations,
  type AgGridStatisticsColumn,
  type CalculsStatistiquePayload,
  type StatisticCalculationItem,
  type StatsOperation,
} from './StatisticCalculations';

export type {
  AgGridStatisticsColumn,
  CalculsStatistiquePayload,
  StatisticCalculationItem,
  StatsOperation,
  StatisticFieldDescriptor,
} from './StatisticCalculations';

export { StatisticCalculations, getStatisticCellValue } from './StatisticCalculations';

/** @deprecated Prefer {@link StatisticCalculations.fromAgGridColumns} */
export const selectStatisticsColumns = StatisticCalculations.fromAgGridColumns;

export type CalculsStatistiqueResultDatasource = {
  getValue: () => Promise<unknown>;
  addListener: (event: 'changed', handler: () => void) => void;
  removeListener: (event: 'changed', handler: () => void) => void;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Scalar not yet written by 4D (null) or empty string; object/array counts as ready. */
function isCalculStatistiqueScalarReady(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/**
 * Qodly often assigns the bound scalar after `emit` resolves. Poll and listen until data exists
 * or timeout (avoids immediate getValue() === null).
 */
async function waitForCalculStatistiqueScalar(
  ds: CalculsStatistiqueResultDatasource,
  options: { intervalMs?: number; maxMs?: number } = {},
): Promise<unknown> {
  const intervalMs = options.intervalMs ?? 100;
  const maxMs = options.maxMs ?? 12000;
  const deadline = Date.now() + maxMs;

  const read = async (): Promise<unknown> => {
    try {
      return await ds.getValue();
    } catch {
      return undefined;
    }
  };

  let value = await read();
  if (isCalculStatistiqueScalarReady(value)) return value;

  return await new Promise((resolve) => {
    let finished = false;
    const finish = (v: unknown) => {
      if (finished) return;
      finished = true;
      ds.removeListener('changed', onChanged);
      resolve(v);
    };

    const onChanged = () => {
      void read().then((v) => {
        if (isCalculStatistiqueScalarReady(v)) finish(v);
      });
    };
    ds.addListener('changed', onChanged);

    const poll = async () => {
      while (Date.now() < deadline) {
        await delay(intervalMs);
        if (finished) return;
        const v = await read();
        if (isCalculStatistiqueScalarReady(v)) {
          finish(v);
          return;
        }
      }
      if (!finished) finish(await read());
    };
    void poll();
  });
}

export type AgGridCalculsStatistiqueProps = {
  translation: (key: string) => string;
  showToolbarStatistics: boolean;
  statisticsColumns: AgGridStatisticsColumn[];
  columnsRef: MutableRefObject<IColumn[]>;
  gridRef: RefObject<AgGridReact | null>;
  emit: (name: string, data?: unknown) => Promise<void>;
  calculStatistiqueResultDS: CalculsStatistiqueResultDatasource | null | undefined;
};

export const AgGridCalculsStatistique: FC<AgGridCalculsStatistiqueProps> = ({
  translation,
  showToolbarStatistics,
  statisticsColumns,
  columnsRef,
  gridRef,
  emit,
  calculStatistiqueResultDS: resultDsProp,
}) => {
  const calculStatistiqueResultDS = resultDsProp ?? null;
  const [showStatisticsDialog, setShowStatisticsDialog] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [selectedOperations, setSelectedOperations] = useState<StatsOperation[]>([
    ...StatisticCalculations.ALL_OPERATIONS,
  ]);
  const [statsResponse, setStatsResponse] = useState<unknown>(null);
  const [lastCalculations, setLastCalculations] = useState<StatisticCalculationItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const operationLabel = useCallback(
    (op: StatsOperation) => {
      const map: Record<StatsOperation, string> = {
        sum: translation('Sum'),
        average: translation('Average'),
        min: translation('Min'),
        max: translation('Max'),
      };
      return map[op];
    },
    [translation],
  );

  const calculations = useMemo(
    (): StatisticCalculationItem[] =>
      StatisticCalculations.buildCalculationItemsForAgGrid(
        statisticsColumns,
        selectedColumnIds,
        selectedOperations,
      ),
    [statisticsColumns, selectedColumnIds, selectedOperations],
  );

  /** One row per field: from last request, or inferred from `{ results: [...] }` on the datasource. */
  const pivotFieldRows = useMemo(() => {
    const m = new Map<string, { columnTitle: string; columnSource: string }>();
    for (const c of lastCalculations) {
      if (!m.has(c.columnTitle)) {
        m.set(c.columnTitle, {
          columnTitle: c.columnTitle,
          columnSource: c.columnSource,
        });
      }
    }
    let rows = Array.from(m.values());
    if (rows.length === 0 && statsResponse != null) {
      rows = StatisticCalculations.fieldRowsFromResultsResponse(statsResponse);
    }
    return rows;
  }, [lastCalculations, statsResponse]);

  const toggleColumn = (colId: string) => {
    setSelectedColumnIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId],
    );
  };

  const toggleOperation = (op: StatsOperation) => {
    setSelectedOperations((prev) =>
      prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op],
    );
  };

  const selectAllColumns = () => {
    setSelectedColumnIds(statisticsColumns.map((c) => c.colId));
  };

  const clearColumns = () => setSelectedColumnIds([]);

  const selectAllOperations = () =>
    setSelectedOperations([...StatisticCalculations.ALL_OPERATIONS]);

  const clearOperations = () => setSelectedOperations([]);

  const openCalculsStatistiqueDialog = () => {
    setStatsError(null);
    setStatsResponse(null);
    setLastCalculations([]);
    if (statisticsColumns.length > 0) {
      setSelectedColumnIds(statisticsColumns.map((c) => c.colId));
      setSelectedOperations([...StatisticCalculations.ALL_OPERATIONS]);
    } else {
      setSelectedColumnIds([]);
      setSelectedOperations([]);
    }
    setShowStatisticsDialog(true);
  };

  const runCalculsStatistique = async () => {
    if (calculations.length === 0) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const filterModel = gridRef.current?.api?.getFilterModel() ?? {};
      const filterQueries = buildFilterQueries(filterModel, columnsRef.current);
      const filterQuery = filterQueries.filter(Boolean).join(' AND ');
      const payload: CalculsStatistiquePayload = StatisticCalculations.buildPayload(
        filterQuery,
        calculations,
      );
      setLastCalculations(calculations);
      await emit('oncalculstatistique', payload);
      if (!calculStatistiqueResultDS) {
        setStatsResponse(null);
        setStatsError(
          translation(
            'Set property Calculs statistique result to a scalar datasource, and use the same datasource as the return target of your On Calculs statistique method in Studio.',
          ),
        );
        return;
      }
      const value = await waitForCalculStatistiqueScalar(calculStatistiqueResultDS);
      setStatsResponse(value);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatsError(msg);
    } finally {
      setStatsLoading(false);
    }
  };

  const copyStatisticsToClipboard = useCallback(async () => {
    if (pivotFieldRows.length === 0) return;
    const text = StatisticCalculations.buildCopyTsv(statsResponse, pivotFieldRows);
    await writeTextToClipboard(text);
  }, [pivotFieldRows, statsResponse]);

  useEffect(() => {
    if (!calculStatistiqueResultDS) return;
    let disposed = false;

    const sync = async () => {
      try {
        const v = await calculStatistiqueResultDS.getValue();
        if (!disposed && showStatisticsDialog) {
          setStatsResponse(v);
        }
      } catch {
        /* ignore */
      }
    };

    const onChanged = () => {
      void sync();
    };

    void sync();
    calculStatistiqueResultDS.addListener('changed', onChanged);
    return () => {
      disposed = true;
      calculStatistiqueResultDS.removeListener('changed', onChanged);
    };
  }, [calculStatistiqueResultDS, showStatisticsDialog]);

  const canCalculate =
    statisticsColumns.length > 0 && calculations.length > 0 && !statsLoading;

  if (!showToolbarStatistics) {
    return null;
  }

  return (
    <>
      <div className="statistics-section">
        <button
          type="button"
          onClick={openCalculsStatistiqueDialog}
          className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
          style={{
            width: '31px',
            height: '31px',
            borderRadius: '8px',
            borderColor: '#0000001A',
            color: '#44444C',
          }}
          disabled={statisticsColumns.length === 0}
          title={translation('Calculs statistique')}
          aria-label={translation('Calculs statistique')}
        >
          <FaCalculator />
        </button>
      </div>

      {showStatisticsDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowStatisticsDialog(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 rounded-t-xl border-b border-slate-200 px-5 py-4">
              <div>
                <span
                  className="text-sm tracking-wide"
                  style={{ color: '#0A0A0A', fontSize: '21px', fontWeight: 500 }}
                >
                  {translation('Calculs statistique')}
                </span>
                <span
                  className="mt-1 block text-sm"
                  style={{ color: '#4A5565', fontSize: '14px' }}
                >
                  {translation(
                    'Select one or more columns and one or more calculation modes. The server receives every combination. Bind Calculs statistique result to the scalar datasource used as the event return.',
                  )}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center"
                style={{ color: '#6A7282' }}
                onClick={() => setShowStatisticsDialog(false)}
              >
                <IoMdClose />
              </button>
            </div>
            <div>
              {statisticsColumns.length === 0 ? (
                <div
                  className="bg-slate-50 px-3 py-2"
                  style={{ color: '#4A5565', fontSize: '14px' }}
                >
                  {translation(
                    'No columns with type number are configured in grid properties',
                  )}
                </div>
              ) : (
                <>
                  <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-5 py-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <label
                          className="text-sm font-medium"
                          style={{ color: '#364153', fontSize: '14px' }}
                        >
                          {translation('Columns')}
                        </label>
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            className="text-blue-700 underline"
                            onClick={selectAllColumns}
                          >
                            {translation('Select all')}
                          </button>
                          <button
                            type="button"
                            className="text-slate-600 underline"
                            onClick={clearColumns}
                          >
                            {translation('Clear')}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/80 p-3">
                        {statisticsColumns.map((column) => (
                          <label
                            key={column.colId}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                            style={{ color: '#44444C' }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedColumnIds.includes(column.colId)}
                              onChange={() => toggleColumn(column.colId)}
                              className="rounded border-slate-300"
                            />
                            <span>{column.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className="text-sm font-medium"
                          style={{ color: '#364153', fontSize: '14px' }}
                        >
                          {translation('Operations')}
                        </span>
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            className="text-blue-700 underline"
                            onClick={selectAllOperations}
                          >
                            {translation('Select all')}
                          </button>
                          <button
                            type="button"
                            className="text-slate-600 underline"
                            onClick={clearOperations}
                          >
                            {translation('Clear')}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {StatisticCalculations.ALL_OPERATIONS.map((op) => (
                          <label
                            key={op}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            style={{
                              borderColor: selectedOperations.includes(op)
                                ? '#2B5797'
                                : '#0000001A',
                              backgroundColor: selectedOperations.includes(op)
                                ? 'rgba(43, 87, 151, 0.08)'
                                : '#fff',
                              color: '#44444C',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedOperations.includes(op)}
                              onChange={() => toggleOperation(op)}
                              className="rounded border-slate-300"
                            />
                            {operationLabel(op)}
                          </label>
                        ))}
                      </div>
                    </div>
                    {calculations.length > 0 && (
                      <p className="text-xs text-slate-500">
                        {translation('Combinations')}: {calculations.length}
                      </p>
                    )}
                    {(statsLoading ||
                      statsError != null ||
                      statsResponse != null ||
                      lastCalculations.length > 0) && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        {statsLoading && (
                          <p className="text-sm text-slate-600">{translation('Loading')}</p>
                        )}
                        {statsError != null && (
                          <p className="whitespace-pre-wrap text-sm text-red-600">{statsError}</p>
                        )}
                        {!statsLoading &&
                          statsError == null &&
                          (pivotFieldRows.length > 0 || statsResponse != null) && (
                          <div className="space-y-2">
                            {pivotFieldRows.length > 0 ? (
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
                                  <table className="w-full border-collapse text-left text-sm">
                                    <thead className="bg-slate-100/90">
                                      <tr>
                                        <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-800">
                                          {translation('Field')}
                                        </th>
                                        {StatisticCalculations.ALL_OPERATIONS.map((op) => (
                                          <th
                                            key={op}
                                            className="border-b border-l border-slate-200 px-3 py-2.5 text-center font-semibold text-slate-800"
                                          >
                                            {operationLabel(op)}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pivotFieldRows.map((row) => (
                                        <tr
                                          key={row.columnTitle}
                                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80"
                                        >
                                          <td className="px-3 py-2 font-medium text-slate-900">
                                            {row.columnTitle}
                                          </td>
                                          {StatisticCalculations.ALL_OPERATIONS.map((op) => {
                                            const cell = StatisticCalculations.getCellValue(
                                              statsResponse,
                                              row.columnTitle,
                                              op,
                                              row.columnSource,
                                            );
                                            const cellText =
                                              cell === undefined
                                                ? '—'
                                                : StatisticCalculations.formatDisplayValue(cell);
                                            return (
                                              <td
                                                key={op}
                                                className="border-l border-slate-100 px-3 py-2 text-center font-mono tabular-nums text-slate-900"
                                              >
                                                {cellText}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-md border px-2 py-1 text-xs"
                                  style={{
                                    borderColor: '#0000001A',
                                    color: '#44444C',
                                    height: '31px',
                                  }}
                                  onClick={() => void copyStatisticsToClipboard()}
                                  title={translation('Copy')}
                                  aria-label={translation('Copy')}
                                >
                                  <FaCopy size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <pre className="max-h-48 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-slate-800">
                                  {StatisticCalculations.formatDisplayValue(statsResponse)}
                                </pre>
                                <button
                                  type="button"
                                  className="shrink-0 rounded-md border px-2 py-1 text-xs"
                                  style={{
                                    borderColor: '#0000001A',
                                    color: '#44444C',
                                    height: '31px',
                                  }}
                                  onClick={() => void writeTextToClipboard(String(statsResponse))}
                                  title={translation('Copy')}
                                  aria-label={translation('Copy')}
                                >
                                  <FaCopy size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex justify-end gap-2 border-t border-slate-200 p-4"
                    style={{ borderTop: '1px solid #E5E7EB' }}
                  >
                    <button
                      type="button"
                      className="rounded-md border px-3 py-2 flex text-center items-center justify-center"
                      style={{
                        height: '31px',
                        borderRadius: '6px',
                        borderColor: '#0000001A',
                        color: '#44444C',
                        fontSize: '12px',
                      }}
                      onClick={() => {
                        setStatsResponse(null);
                        setStatsError(null);
                        setLastCalculations([]);
                      }}
                    >
                      {translation('Clear result')}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border  px-3 py-2 text-sm text-white flex text-center items-center justify-center"
                      onClick={() => void runCalculsStatistique()}
                      disabled={!canCalculate}
                      style={{
                        background: '#2B5797',
                        height: '31px',
                        fontSize: '12px',
                      }}
                    >
                      {translation('Calculate')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
