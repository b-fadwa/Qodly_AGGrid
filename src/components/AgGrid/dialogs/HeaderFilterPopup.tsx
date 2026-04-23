import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { GoTrash } from 'react-icons/go';
import type { IColumn } from '../AgGrid.config';
import {
  buildAgGridFilterModelFromAdvancedRules,
  getAdvancedRulesFromFilterModel,
  getColumnAgGridFilterType,
  getColumnFilterOperators,
  type FilterOperatorDescriptor,
  type QodlyFilterCombinator,
  withAdvancedRulesOnFilterModel,
} from '../AgGrid.filtering';

interface ConditionDraft {
  id: string;
  operator: string;
  value: string;
  value2: string;
}

interface HeaderFilterPopupProps {
  open: boolean;
  anchorRect: DOMRect | null;
  column: IColumn | null;
  colId: string | null;
  currentEntry: any;
  currentModel: any;
  showDateFinancialToggle: boolean;
  dateFinancialFilterEnabled: boolean;
  onDateFinancialFilterEnabledChange: (enabled: boolean) => void;
  translation: (key: string) => string;
  onApply: (nextModel: any | null) => void;
  onClose: () => void;
}

const ZERO_INPUT_OPERATORS = new Set(['isTrue', 'isFalse', 'blank', 'notBlank']);
const mk = (): string => `h_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
const boolOps = (ops: FilterOperatorDescriptor[]) =>
  ops.some((o) => o.key === 'isTrue' || o.key === 'isFalse');
const defaultOp = (ops: FilterOperatorDescriptor[]) =>
  boolOps(ops) ? '' : (ops[0]?.key ?? 'equals');

const parseEntry = (entry: any, ops: FilterOperatorDescriptor[]): ConditionDraft[] => {
  const fallback = defaultOp(ops);
  if (!entry || typeof entry !== 'object') {
    return [{ id: mk(), operator: fallback, value: '', value2: '' }];
  }
  const conditions = Array.isArray(entry.conditions) ? entry.conditions : [entry];
  const rows = conditions.map((c: any) => ({
    id: mk(),
    operator: c?.type ?? fallback,
    value:
      c?.filter != null
        ? String(c.filter)
        : c?.dateFrom != null
          ? String(c.dateFrom)
          : c?.value != null
            ? String(c.value)
            : '',
    value2: c?.filterTo != null ? String(c.filterTo) : c?.dateTo != null ? String(c.dateTo) : '',
  }));
  return rows.length ? rows : [{ id: mk(), operator: fallback, value: '', value2: '' }];
};

const toCondition = (
  row: ConditionDraft,
  filterType: 'text' | 'number' | 'date' | 'qodlyRefSelect',
): any | null => {
  if (!row.operator) return null;
  if (ZERO_INPUT_OPERATORS.has(row.operator)) return { filterType, type: row.operator };
  if (filterType === 'date') {
    if (!row.value) return null;
    return { filterType, type: row.operator, dateFrom: row.value, dateTo: row.value2 || null };
  }
  if (filterType === 'qodlyRefSelect') {
    const num = Number(String(row.value ?? '').trim());
    if (!Number.isFinite(num)) return null;
    return { filterType, type: row.operator, value: num };
  }
  if (!row.value) return null;
  return { filterType, type: row.operator, filter: row.value, filterTo: row.value2 || undefined };
};

const filled = (row: ConditionDraft, ops: FilterOperatorDescriptor[]) => {
  const op = ops.find((o) => o.key === row.operator);
  const inputs = op?.inputs ?? 1;
  if (inputs === 0) return true;
  if (inputs === 1) return String(row.value ?? '').trim().length > 0;
  return String(row.value ?? '').trim().length > 0 && String(row.value2 ?? '').trim().length > 0;
};

const normalize = (rows: ConditionDraft[], ops: FilterOperatorDescriptor[]): ConditionDraft[] => {
  const fallback = defaultOp(ops);
  const safe = rows.length ? rows : [{ id: mk(), operator: fallback, value: '', value2: '' }];
  const lastFilled = [...safe]
    .map((row, idx) => (filled(row, ops) ? idx : -1))
    .reduce((acc, idx) => Math.max(acc, idx), -1);
  const desired = Math.max(1, lastFilled + 2);
  const next = safe.slice(0, desired);
  while (next.length < desired) next.push({ id: mk(), operator: fallback, value: '', value2: '' });
  return next;
};

const normalizeCombinator = (value: any): QodlyFilterCombinator =>
  value === 'OR' || value === 'EXCEPT' ? value : 'AND';

const rulesFromPlainFilterModel = (
  model: any,
): Array<{ field: string; combinator: QodlyFilterCombinator; condition: any }> => {
  if (!model || typeof model !== 'object') return [];
  const rules: Array<{ field: string; combinator: QodlyFilterCombinator; condition: any }> = [];
  Object.keys(model).forEach((field) => {
    if (field === '__qodlyAdvancedRules') return;
    const entry = model[field];
    if (!entry || typeof entry !== 'object') return;
    if (Array.isArray(entry.conditions)) {
      const columnCombinator = normalizeCombinator(entry.qodlyCombinator ?? entry.operator);
      const rowCombinator = normalizeCombinator(entry.operator);
      entry.conditions.forEach((condition: any, index: number) => {
        rules.push({
          field,
          condition,
          combinator: index === 0 ? columnCombinator : rowCombinator,
        });
      });
      return;
    }
    rules.push({
      field,
      condition: entry,
      combinator: normalizeCombinator(entry.qodlyCombinator),
    });
  });
  return rules;
};

const styles = {
  panel: {
    position: 'fixed',
    width: '250px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: '70vh',
    overflow: 'auto',
    background: '#F3F4F6',
    border: '1px solid #0000001A',
    borderRadius: '8px',
    boxShadow: '0 16px 24px rgba(0, 0, 0, 0.12)',
    zIndex: 100001,
  } as React.CSSProperties,
  control: {
    height: '32px',
    borderRadius: '5px',
    border: '1px solid #CBD5E1',
    color: '#44444C',
    fontSize: '13px',
    padding: '0 12px',
    background: '#FFFFFF',
  } as React.CSSProperties,
  trash: {
    width: '31px',
    minWidth: '31px',
    height: '31px',
    borderRadius: '8px',
    color: 'rgb(236, 123, 128)',
    borderColor: 'rgb(236, 123, 128)',
    backgroundColor: 'rgba(236, 123, 128, 0.2)',
  } as React.CSSProperties,
};

export const HeaderFilterPopup: FC<HeaderFilterPopupProps> = ({
  open,
  anchorRect,
  column,
  colId,
  currentEntry,
  currentModel,
  showDateFinancialToggle,
  dateFinancialFilterEnabled,
  onDateFinancialFilterEnabledChange,
  translation,
  onApply,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const operators = useMemo(() => (column ? getColumnFilterOperators(column) : []), [column]);
  const filterType = useMemo(() => getColumnAgGridFilterType(column), [column]);
  const inputType = useMemo(() => {
    const dt = String(column?.dataType ?? '')
      .trim()
      .toLowerCase();
    if (dt === 'date') return 'date';
    if (['word', 'short', 'long', 'number', 'long64', 'duration'].includes(dt)) return 'number';
    return 'text';
  }, [column]);
  const activeRules = useMemo(() => getAdvancedRulesFromFilterModel(currentModel), [currentModel]);
  const [rows, setRows] = useState<ConditionDraft[]>([]);
  const [rowCombinator, setRowCombinator] = useState<QodlyFilterCombinator>('AND');
  const [columnCombinator, setColumnCombinator] = useState<QodlyFilterCombinator>('AND');
  const [dateFinancialFilterDraft, setDateFinancialFilterDraft] = useState<boolean>(false);
  const hasOtherColumns = useMemo(() => {
    if (!colId) return false;
    if (activeRules.some((r) => r.field !== colId)) return true;
    return Object.keys(currentModel ?? {}).some((k) => k !== '__qodlyAdvancedRules' && k !== colId);
  }, [activeRules, currentModel, colId]);

  useEffect(() => {
    if (!open || !colId) return;
    setDateFinancialFilterDraft(Boolean(dateFinancialFilterEnabled));
    const forCol = activeRules.filter((r) => r.field === colId);
    if (forCol.length) {
      const parsed = forCol.map((r) => parseEntry(r.condition, operators)[0]);
      setRows(normalize(parsed, operators));
      setColumnCombinator(forCol[0]?.combinator ?? 'AND');
      setRowCombinator(forCol[1]?.combinator ?? 'AND');
      return;
    }
    setRows(normalize(parseEntry(currentEntry, operators), operators));
    const entryCombinator =
      currentEntry?.qodlyCombinator === 'OR' || currentEntry?.qodlyCombinator === 'EXCEPT'
        ? currentEntry.qodlyCombinator
        : currentEntry?.operator === 'OR' || currentEntry?.operator === 'EXCEPT'
          ? currentEntry.operator
          : 'AND';
    setColumnCombinator(entryCombinator);
    const rowOp = Array.isArray(currentEntry?.conditions) ? currentEntry?.operator : 'AND';
    setRowCombinator(rowOp === 'OR' || rowOp === 'EXCEPT' ? rowOp : 'AND');
  }, [open, colId, currentEntry, operators, activeRules, dateFinancialFilterEnabled]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (!open || !column || !colId || !anchorRect || !filterType) return null;

  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 20);
  const left = Math.min(Math.max(12, anchorRect.left), Math.max(12, window.innerWidth - 372));

  const applyRules = (
    nextRules: Array<{ field: string; combinator: QodlyFilterCombinator; condition: any }>,
  ) => {
    const agMirror = buildAgGridFilterModelFromAdvancedRules(nextRules);
    const nextModel = withAdvancedRulesOnFilterModel(agMirror, nextRules);
    onApply(nextModel);
  };

  return (
    <div ref={panelRef} style={{ ...styles.panel, top, left }}>
      <div className="border-b border-[#D1D5DB] p-2 flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-[#111827]">{column.title}</div>
        {hasOtherColumns ? (
          <select
            value={columnCombinator}
            onChange={(e) => {
              const next = e.target.value as QodlyFilterCombinator;
              setColumnCombinator(next);
            }}
            style={{ ...styles.control, width: '120px', height: '28px', fontSize: '12px' }}
          >
            <option value="AND">{translation('AND')}</option>
            <option value="OR">{translation('OR')}</option>
            <option value="EXCEPT">{translation('EXCEPT')}</option>
          </select>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-2">
        {rows.map((row, idx) => {
          const selectedOp =
            operators.find((op) => op.key === row.operator) ?? operators[0] ?? null;
          const inputs = selectedOp?.inputs ?? 1;
          const canDelete = rows.length > 1;
          return (
            <div key={row.id}>
              {idx > 0 ? (
                <div className="mb-1 flex items-center justify-center gap-5 text-[12px] text-[#2D2D35]">
                  {(['AND', 'OR', 'EXCEPT'] as QodlyFilterCombinator[]).map((option) => (
                    <label key={option} className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={rowCombinator === option}
                        onChange={() => setRowCombinator(option)}
                      />
                      <span>{translation(option)}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <div className="mb-1 flex items-center gap-2">
                <select
                  style={{ ...styles.control, flex: 1 }}
                  value={row.operator}
                  onChange={(e) => {
                    const nextOperator = e.target.value;
                    setRows((prev) => {
                      return normalize(
                        prev.map((r) =>
                          r.id === row.id
                            ? { ...r, operator: nextOperator, value: '', value2: '' }
                            : r,
                        ),
                        operators,
                      );
                    });
                  }}
                >
                  {boolOps(operators) ? (
                    <option value="" disabled>
                      {translation('Choose one')}
                    </option>
                  ) : null}
                  {operators.map((op) => (
                    <option key={op.key} value={op.key}>
                      {translation(op.label)}
                    </option>
                  ))}
                </select>
                {inputs === 0 && canDelete ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg border"
                    style={styles.trash}
                    onClick={() => {
                      setRows((prev) => {
                        return normalize(
                          prev.filter((r) => r.id !== row.id),
                          operators,
                        );
                      });
                    }}
                  >
                    <GoTrash size={14} />
                  </button>
                ) : null}
              </div>
              {inputs >= 1 ? (
                <div className="mb-1 flex items-center gap-2">
                  <input
                    type={inputType}
                    value={row.value}
                    placeholder={translation('Filter...')}
                    style={{ ...styles.control, width: '100%' }}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setRows((prev) => {
                        return normalize(
                          prev.map((r) => (r.id === row.id ? { ...r, value: nextValue } : r)),
                          operators,
                        );
                      });
                    }}
                  />
                  {canDelete ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border"
                      style={styles.trash}
                      onClick={() => {
                        setRows((prev) => {
                          return normalize(
                            prev.filter((r) => r.id !== row.id),
                            operators,
                          );
                        });
                      }}
                    >
                      <GoTrash size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {inputs === 2 ? (
                <input
                  type={inputType}
                  value={row.value2}
                  placeholder={translation('Filter...')}
                  style={{ ...styles.control, width: '100%' }}
                  onChange={(e) => {
                    const nextValue2 = e.target.value;
                    setRows((prev) => {
                      return normalize(
                        prev.map((r) => (r.id === row.id ? { ...r, value2: nextValue2 } : r)),
                        operators,
                      );
                    });
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <>
        {showDateFinancialToggle ? (
          <div className="flex items-center justify-center gap-2 border-t border-[#D1D5DB] bg-[#ECECEC] p-2">
            <label
              className="mr-auto inline-flex items-center gap-1.5"
              style={{ color: '#44444C', fontSize: '12px', fontWeight: 500 }}
            >
              <input
                type="checkbox"
                checked={dateFinancialFilterDraft}
                onChange={(e) => setDateFinancialFilterDraft(e.target.checked)}
              />
              <span>{translation('filter by fiscal year')}</span>
            </label>
          </div>
        ) : null}
      </>
      <div className="flex items-center justify-center gap-2 border-t border-[#D1D5DB] bg-[#ECECEC] p-2">
        <button
          type="button"
          style={{ ...styles.control, borderColor: '#0000001A', width: 'auto' }}
          onClick={() => {
            applyRules([]);
          }}
        >
          {translation('Clear filters')}
        </button>
        <button
          type="button"
          style={{
            ...styles.control,
            background: '#2B5797',
            color: '#FFFFFF',
            borderColor: '#2B5797',
            width: 'auto',
          }}
          onClick={() => {
            const built = rows
              .map((r) => toCondition(r, filterType))
              .filter((v): v is any => v !== null);
            const baseRules = activeRules.length
              ? activeRules
              : rulesFromPlainFilterModel(currentModel);
            const remaining = baseRules.filter((r) => r.field !== colId);
            if (!built.length) {
              onDateFinancialFilterEnabledChange(dateFinancialFilterDraft);
              applyRules(remaining);
              onClose();
              return;
            }
            const nextRules = [
              ...remaining,
              ...built.map((condition, index) => ({
                field: colId,
                condition,
                combinator: (index === 0
                  ? remaining.length
                    ? columnCombinator
                    : 'AND'
                  : rowCombinator) as QodlyFilterCombinator,
              })),
            ];
            onDateFinancialFilterEnabledChange(dateFinancialFilterDraft);
            applyRules(nextRules);
            onClose();
          }}
        >
          {translation('Apply')}
        </button>
      </div>
    </div>
  );
};
