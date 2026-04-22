import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { GoTrash } from 'react-icons/go';
import type { IColumn } from '../AgGrid.config';
import {
  getColumnAgGridFilterType,
  getColumnFilterOperators,
  type FilterOperatorDescriptor,
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
  translation: (key: string) => string;
  onApply: (nextEntry: any | null) => void;
  onClose: () => void;
}

const panelStyle: React.CSSProperties = {
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
};

const selectStyle: React.CSSProperties = {
  height: '32px',
  borderRadius: '5px',
  border: '1px solid #CBD5E1',
  color: '#44444C',
  fontSize: '13px',
  padding: '0 12px',
  background: '#FFFFFF',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  width: '100%',
};

const neutralBtn: React.CSSProperties = {
  background: '#FFFFFF',
  color: '#44444C',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  height: '31px',
  padding: '0 12px',
  border: '1px solid #0000001A',
};

const primaryBtn: React.CSSProperties = {
  background: '#2B5797',
  color: '#FFFFFF',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  height: '31px',
  padding: '0 12px',
  border: '1px solid #2B5797',
};

const trashBtnStyle: React.CSSProperties = {
  width: '31px',
  minWidth: '31px',
  height: '31px',
  borderRadius: '8px',
  color: 'rgb(236, 123, 128)',
  borderColor: 'rgb(236, 123, 128)',
  backgroundColor: 'rgba(236, 123, 128, 0.2)',
};

const combinatorLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  color: '#2D2D35',
  cursor: 'pointer',
};

const ZERO_INPUT_OPERATORS = new Set(['isTrue', 'isFalse', 'blank', 'notBlank']);

const newId = (): string => `h_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

const getInputType = (column: IColumn | null): 'text' | 'number' | 'date' => {
  const dt = String(column?.dataType ?? '')
    .trim()
    .toLowerCase();
  if (dt === 'date') return 'date';
  if (['word', 'short', 'long', 'number', 'long64', 'duration'].includes(dt)) return 'number';
  return 'text';
};

const isBooleanOperatorList = (operators: FilterOperatorDescriptor[]): boolean =>
  operators.some((op) => op.key === 'isTrue' || op.key === 'isFalse');

const defaultOperatorFor = (operators: FilterOperatorDescriptor[]): string =>
  isBooleanOperatorList(operators) ? '' : (operators[0]?.key ?? 'equals');

const parseEntry = (entry: any, operators: FilterOperatorDescriptor[]): ConditionDraft[] => {
  const fallbackOp = defaultOperatorFor(operators);
  if (!entry || typeof entry !== 'object') {
    return [{ id: newId(), operator: fallbackOp, value: '', value2: '' }];
  }
  if (Array.isArray(entry.conditions)) {
    const rows = entry.conditions.map((c: any) => ({
      id: newId(),
      operator: c?.type ?? fallbackOp,
      value: c?.filter != null ? String(c.filter) : c?.dateFrom != null ? String(c.dateFrom) : '',
      value2: c?.filterTo != null ? String(c.filterTo) : c?.dateTo != null ? String(c.dateTo) : '',
    }));
    return rows.length ? rows : [{ id: newId(), operator: fallbackOp, value: '', value2: '' }];
  }
  return [
    {
      id: newId(),
      operator: entry?.type ?? fallbackOp,
      value:
        entry?.filter != null
          ? String(entry.filter)
          : entry?.dateFrom != null
            ? String(entry.dateFrom)
            : '',
      value2:
        entry?.filterTo != null
          ? String(entry.filterTo)
          : entry?.dateTo != null
            ? String(entry.dateTo)
            : '',
    },
  ];
};

const buildCondition = (
  draft: ConditionDraft,
  filterType: 'text' | 'number' | 'date' | 'qodlyRefSelect',
): any | null => {
  if (!draft.operator) return null;
  if (ZERO_INPUT_OPERATORS.has(draft.operator)) {
    return { filterType, type: draft.operator };
  }
  if (filterType === 'date') {
    if (!draft.value) return null;
    return {
      filterType,
      type: draft.operator,
      dateFrom: draft.value,
      dateTo: draft.value2 || null,
    };
  }
  if (filterType === 'qodlyRefSelect') {
    const num = Number(String(draft.value ?? '').trim());
    if (!Number.isFinite(num)) return null;
    return { filterType, type: draft.operator, value: num };
  }
  if (!draft.value) return null;
  return {
    filterType,
    type: draft.operator,
    filter: draft.value,
    filterTo: draft.value2 || undefined,
  };
};

const isDraftFilled = (draft: ConditionDraft, operators: FilterOperatorDescriptor[]): boolean => {
  const op = operators.find((candidate) => candidate.key === draft.operator) ?? null;
  const inputs = op?.inputs ?? 1;
  if (inputs === 0) return true;
  if (inputs === 1) return String(draft.value ?? '').trim().length > 0;
  return (
    String(draft.value ?? '').trim().length > 0 && String(draft.value2 ?? '').trim().length > 0
  );
};

const normalizeAutoConditionRows = (
  drafts: ConditionDraft[],
  operators: FilterOperatorDescriptor[],
): ConditionDraft[] => {
  const fallbackOp = defaultOperatorFor(operators);
  const safe = drafts.length
    ? drafts
    : [{ id: newId(), operator: fallbackOp, value: '', value2: '' }];
  const lastFilledIndex = [...safe]
    .map((draft, index) => (isDraftFilled(draft, operators) ? index : -1))
    .reduce((acc, index) => Math.max(acc, index), -1);
  const desiredCount = Math.max(1, lastFilledIndex + 2);
  const trimmed = safe.slice(0, desiredCount);
  while (trimmed.length < desiredCount) {
    trimmed.push({ id: newId(), operator: fallbackOp, value: '', value2: '' });
  }
  return trimmed;
};

export const HeaderFilterPopup: FC<HeaderFilterPopupProps> = ({
  open,
  anchorRect,
  column,
  colId,
  currentEntry,
  translation,
  onApply,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputType = getInputType(column);
  const operators = useMemo(() => (column ? getColumnFilterOperators(column) : []), [column]);
  const filterType = useMemo(() => {
    const t = getColumnAgGridFilterType(column);
    return t === null ? null : t;
  }, [column]);
  const isBooleanOnly = useMemo(() => isBooleanOperatorList(operators), [operators]);
  const [joiner, setJoiner] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    const next = normalizeAutoConditionRows(parseEntry(currentEntry, operators), operators);
    setConditions(next);
    setJoiner(currentEntry?.operator === 'OR' ? 'OR' : 'AND');
  }, [open, currentEntry, operators]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(e.target as Node)) return;
      onClose();
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
  const left = Math.min(Math.max(12, anchorRect.left), Math.max(12, window.innerWidth - 360 - 12));

  return (
    <div
      ref={panelRef}
      style={{
        ...panelStyle,
        top,
        left,
      }}
    >
      <div className="border-b border-[#D1D5DB] p-2">
        <div className="text-[12px] font-semibold text-[#111827]">{column.title}</div>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {conditions.map((row, index) => {
          const selectedOp =
            operators.find((op) => op.key === row.operator) ?? operators[0] ?? null;
          const inputs = selectedOp?.inputs ?? 1;
          const canRemoveQuickly = conditions.length > 1;
          return (
            <div key={row.id}>
              {index > 0 ? (
                <div className="mb-3 flex items-center justify-center gap-8">
                  <label style={combinatorLabel}>
                    <input
                      type="radio"
                      checked={joiner === 'AND'}
                      onChange={() => setJoiner('AND')}
                    />
                    <span>{translation('AND')}</span>
                  </label>
                  <label style={combinatorLabel}>
                    <input
                      type="radio"
                      checked={joiner === 'OR'}
                      onChange={() => setJoiner('OR')}
                    />
                    <span>{translation('OR')}</span>
                  </label>
                </div>
              ) : null}
              <div className="mb-3 flex items-center gap-2">
                <select
                  style={{ ...selectStyle, width: '100%', flex: 1 }}
                  value={row.operator}
                  onChange={(e) =>
                    setConditions((prev) =>
                      normalizeAutoConditionRows(
                        prev.map((condition) =>
                          condition.id === row.id
                            ? { ...condition, operator: e.target.value, value: '', value2: '' }
                            : condition,
                        ),
                        operators,
                      ),
                    )
                  }
                >
                  {isBooleanOnly ? (
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
                {inputs === 0 && canRemoveQuickly ? (
                  <button
                    type="button"
                    className="header-button-trash inline-flex items-center justify-center rounded-lg border"
                    style={trashBtnStyle}
                    onClick={() =>
                      setConditions((prev) =>
                        normalizeAutoConditionRows(
                          prev.length > 1
                            ? prev.filter((condition) => condition.id !== row.id)
                            : prev,
                          operators,
                        ),
                      )
                    }
                    title={translation('Delete')}
                    aria-label={translation('Delete')}
                  >
                    <GoTrash size={14} />
                  </button>
                ) : null}
              </div>
              {inputs >= 1 ? (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type={inputType}
                    value={row.value}
                    placeholder={translation('Filter...')}
                    onChange={(e) =>
                      setConditions((prev) =>
                        normalizeAutoConditionRows(
                          prev.map((condition) =>
                            condition.id === row.id
                              ? { ...condition, value: e.target.value }
                              : condition,
                          ),
                          operators,
                        ),
                      )
                    }
                    style={inputStyle}
                  />
                  {canRemoveQuickly ? (
                    <button
                      type="button"
                      className="header-button-trash inline-flex items-center justify-center rounded-lg border"
                      style={trashBtnStyle}
                      onClick={() =>
                        setConditions((prev) =>
                          normalizeAutoConditionRows(
                            prev.length > 1
                              ? prev.filter((condition) => condition.id !== row.id)
                              : prev,
                            operators,
                          ),
                        )
                      }
                      title={translation('Delete')}
                      aria-label={translation('Delete')}
                    >
                      <GoTrash size={14} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {inputs === 2 ? (
                <div>
                  <input
                    type={inputType}
                    value={row.value2}
                    placeholder={translation('Filter...')}
                    onChange={(e) =>
                      setConditions((prev) =>
                        normalizeAutoConditionRows(
                          prev.map((condition) =>
                            condition.id === row.id
                              ? { ...condition, value2: e.target.value }
                              : condition,
                          ),
                          operators,
                        ),
                      )
                    }
                    style={inputStyle}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-[#D1D5DB] bg-[#ECECEC] p-2">
        <button
          type="button"
          style={neutralBtn}
          onClick={() => {
            onApply(null);
            onClose();
          }}
        >
          {translation('Clear result')}
        </button>
        <button
          type="button"
          style={primaryBtn}
          onClick={() => {
            const built = conditions
              .map((c) => buildCondition(c, filterType))
              .filter((c): c is any => c !== null);
            if (!built.length) {
              onApply(null);
            } else if (built.length === 1) {
              onApply(built[0]);
            } else {
              onApply({
                filterType,
                operator: joiner,
                conditions: built,
              });
            }
            onClose();
          }}
        >
          {translation('Apply')}
        </button>
      </div>
    </div>
  );
};
