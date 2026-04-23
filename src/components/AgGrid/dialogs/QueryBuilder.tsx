import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { GoTrash } from 'react-icons/go';
import type { IColumn } from '../AgGrid.config';
import type { Translation } from '../state/sorts';
import {
  buildAgGridFilterModelFromAdvancedRules,
  getAdvancedRulesFromFilterModel,
  getColumnAgGridFilterType,
  getColumnFilterOperators,
  type FilterOperatorDescriptor,
  type QodlyFilterCombinator,
  withAdvancedRulesOnFilterModel,
} from '../AgGrid.filtering';

/**
 * Delay applied to value-input changes before pushing them up to AG Grid.
 * Without it, every keystroke would call `setFilterModel`, which fires
 * `filterChanged` and triggers a server fetch per character. 400ms feels
 * snappy while keeping a single request per "typed token".
 */
const VALUE_DEBOUNCE_MS = 400;

const COLLECTION_OPERATOR_KEY = 'inCollection';

const parseCollectionTokens = (raw: string): string[] =>
  String(raw ?? '')
    .replace(/\\n/g, '\n')
    .split(/[\n\r,]+/g)
    .map((v) => v.trim())
    .filter(Boolean);

const joinCollectionTokens = (tokens: string[]): string => tokens.join(', ');

/* ------------------------------------------------------------------ *
 *  Internal flat representation
 *
 *  The dialog edits a flat `Rule[]` list, but persists everything as
 *  AG Grid's native `filterModel` so the per-column header popups stay
 *  in lockstep. Two-way conversion lives in this file.
 * ------------------------------------------------------------------ */

export type ColumnCombinator = QodlyFilterCombinator;

export interface FilterRule {
  /** Stable id for React keys (UUIDish, not persisted). */
  id: string;
  /** Column key (== AG Grid column id, normally `column.source`). */
  field: string;
  /** Operator key — matches AG Grid `filterModel[col].type`. */
  operator: string;
  value: string;
  value2?: string;
  /** Combinator joining this rule with the previous global rule. */
  combinator?: ColumnCombinator;
}

interface QueryBuilderProps {
  translation: Translation;
  columns: IColumn[];
  filterModel: any;
  onChange: (nextModel: any) => void;
}

/* ----------------------- conversion helpers ----------------------- */

const newId = (): string => `r_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

const findColumnByKey = (columns: IColumn[], key: string): IColumn | undefined =>
  columns.find((c) => c.source === key || c.title === key || String(c.id ?? '') === key);

const filterableColumns = (columns: IColumn[]): IColumn[] =>
  columns.filter((c) => getColumnAgGridFilterType(c) !== null && c.filtering);

/** Read a value from a single AG Grid condition payload. */
const readConditionValues = (
  condition: any,
  filterType: string | null,
): { value: string; value2: string } => {
  if (!condition || typeof condition !== 'object') return { value: '', value2: '' };
  if (filterType === 'date') {
    return {
      value: condition.dateFrom != null ? String(condition.dateFrom) : '',
      value2: condition.dateTo != null ? String(condition.dateTo) : '',
    };
  }
  return {
    value:
      condition.filter != null
        ? String(condition.filter)
        : condition.value != null
          ? String(condition.value)
          : '',
    value2: condition.filterTo != null ? String(condition.filterTo) : '',
  };
};

/** Convert an AG Grid `filterModel` to the modal's flat rule list. */
export const filterModelToRules = (model: any, columns: IColumn[]): FilterRule[] => {
  if (!model || typeof model !== 'object') return [];
  const readCombinator = (value: any): ColumnCombinator =>
    value === 'OR' || value === 'EXCEPT' ? value : 'AND';
  const advancedRules = getAdvancedRulesFromFilterModel(model);
  if (advancedRules.length) {
    const mapped = advancedRules.map((rule, index) => {
      const column = findColumnByKey(columns, rule.field);
      const filterType = getColumnAgGridFilterType(column);
      const { value, value2 } = readConditionValues(rule.condition, filterType);
      return {
        id: newId(),
        field: rule.field,
        operator: rule.condition?.type ?? '',
        value,
        value2,
        combinator: index === 0 ? undefined : rule.combinator,
      };
    });
    return mapped;
  }
  const rules: FilterRule[] = [];
  for (const colKey of Object.keys(model)) {
    const entry = model[colKey];
    const column = findColumnByKey(columns, colKey);
    const filterType = getColumnAgGridFilterType(column);
    if (Array.isArray(entry?.conditions)) {
      const combinator: ColumnCombinator = entry.operator === 'OR' ? 'OR' : 'AND';
      entry.conditions.forEach((condition: any, index: number) => {
        const { value, value2 } = readConditionValues(condition, filterType);
        rules.push({
          id: newId(),
          field: colKey,
          operator: condition?.type ?? '',
          value,
          value2,
          combinator: index === 0 ? undefined : combinator,
        });
      });
    } else {
      const { value, value2 } = readConditionValues(entry, filterType);
      const isFirstRule = rules.length === 0;
      rules.push({
        id: newId(),
        field: colKey,
        operator: entry?.type ?? '',
        value,
        value2,
        combinator: isFirstRule
          ? undefined
          : readCombinator(entry?.qodlyCombinator ?? entry?.operator),
      });
    }
  }
  return rules;
};

/** Convert a flat rule list back to an AG Grid `filterModel`. Empty rules are dropped. */
export const rulesToFilterModel = (rules: FilterRule[], columns: IColumn[]): any => {
  const compiled = rules
    .map((rule, index) => ({ rule, index }))
    .map(({ rule, index }) => {
      if (!rule.field || !rule.operator) return null;
      const column = findColumnByKey(columns, rule.field);
      const filterType = getColumnAgGridFilterType(column);
      if (!filterType) return null;
      const condition = buildCondition(rule, filterType);
      if (!condition) return null;
      return {
        field: rule.field,
        condition,
        combinator: (index === 0 ? 'AND' : (rule.combinator ?? 'AND')) as ColumnCombinator,
      };
    })
    .filter(
      (item): item is { field: string; condition: any; combinator: ColumnCombinator } =>
        item !== null,
    );
  const agMirror = buildAgGridFilterModelFromAdvancedRules(compiled);
  const nextModel = withAdvancedRulesOnFilterModel(agMirror, compiled);
  return nextModel;
};

const ZERO_INPUT_OPERATORS = new Set(['isTrue', 'isFalse', 'blank', 'notBlank']);

const buildCondition = (rule: FilterRule, filterType: string): any | null => {
  if (ZERO_INPUT_OPERATORS.has(rule.operator)) {
    return { filterType, type: rule.operator };
  }

  if (filterType === 'date') {
    if (!rule.value) return null;
    return {
      filterType,
      type: rule.operator,
      dateFrom: rule.value,
      dateTo: rule.value2 || null,
    };
  }
  if (filterType === 'qodlyRefSelect') {
    const num = Number(String(rule.value).trim());
    if (!Number.isFinite(num)) return null;
    return { filterType, type: rule.operator, value: num };
  }
  const normalizedValue =
    rule.operator === COLLECTION_OPERATOR_KEY
      ? joinCollectionTokens(parseCollectionTokens(rule.value))
      : rule.value;
  if (normalizedValue === '' || normalizedValue == null) return null;
  return {
    filterType,
    type: rule.operator,
    filter: normalizedValue,
    filterTo: rule.value2 || undefined,
  };
};

/* ------------------------------- UI ------------------------------- */

const primaryButtonStyle: React.CSSProperties = {
  background: '#2B5797',
  color: '#FFFFFF',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  height: '31px',
  padding: '0 12px',
  border: '1px solid #2B5797',
};

const neutralButtonStyle: React.CSSProperties = {
  background: '#FFFFFF',
  color: '#44444C',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  height: '31px',
  padding: '0 12px',
  border: '1px solid #0000001A',
};

const selectStyle: React.CSSProperties = {
  height: '31px',
  borderRadius: '6px',
  border: '1px solid #0000001A',
  color: '#44444C',
  fontSize: '12px',
  padding: '0 8px',
  background: '#FFFFFF',
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  flex: 1,
  minWidth: '120px',
};

const inputTypeFor = (column: IColumn | undefined): 'text' | 'number' | 'date' => {
  const dt = String(column?.dataType ?? '')
    .trim()
    .toLowerCase();
  if (dt === 'date') return 'date';
  if (['word', 'short', 'long', 'number', 'long64', 'duration'].includes(dt)) return 'number';
  return 'text';
};

/** Stable-ish deep equality for AG Grid `filterModel` snapshots (small JSON trees). */
const sameModel = (a: any, b: any): boolean => {
  try {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  } catch {
    return false;
  }
};

export const QueryBuilder: FC<QueryBuilderProps> = ({
  translation,
  columns,
  filterModel,
  onChange,
}) => {
  const visibleColumns = useMemo(() => filterableColumns(columns), [columns]);

  // Own the rule list locally so "+ Rule" can add an empty row that isn't
  // representable in AG Grid's filterModel yet. The model is only emitted
  // (and the header popups only update) once a rule becomes compilable.
  const [rules, setRules] = useState<FilterRule[]>(() => filterModelToRules(filterModel, columns));
  // Tracks the last model *we* sent upstream, so external changes (header
  // popup edits, saved-filter loads) can re-seed the rule list without
  // clobbering in-progress rows that the user is still typing into.
  const lastEmittedRef = useRef<any>(filterModel);
  // Debounce timer + columns ref for the value-input path.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (sameModel(filterModel, lastEmittedRef.current)) return;
    lastEmittedRef.current = filterModel;
    setRules(filterModelToRules(filterModel, columns));
  }, [filterModel, columns]);

  // Cancel any pending debounced emit on unmount so we don't push a stale
  // model after the dialog is closed.
  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  const flushNow = (nextRules: FilterRule[]) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const model = rulesToFilterModel(nextRules, columnsRef.current);
    lastEmittedRef.current = model;
    onChangeRef.current(model);
  };

  /**
   * Push the rules immediately. Used for structural changes (add/remove rule,
   * column/operator/combinator change) where the user expects an instant grid
   * update.
   */
  const emit = (nextRules: FilterRule[]) => {
    setRules(nextRules);
    flushNow(nextRules);
  };

  /**
   * Push the rules after a short delay. Used for value-input typing so the
   * server isn't pinged for every keystroke (e.g. typing "ABAD" used to send
   * a request for "A", "AB", "ABA", "ABAD"). The debounce coalesces those
   * into a single fetch when the user pauses.
   */
  const emitDebounced = (nextRules: FilterRule[]) => {
    setRules(nextRules);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const model = rulesToFilterModel(nextRules, columnsRef.current);
      lastEmittedRef.current = model;
      onChangeRef.current(model);
    }, VALUE_DEBOUNCE_MS);
  };

  const updateRule = (index: number, patch: Partial<FilterRule>) => {
    const next = rules.slice();
    next[index] = { ...next[index], ...patch };
    emit(next);
  };

  /** Same as `updateRule` but doesn't fire a request until typing pauses. */
  const updateRuleValue = (index: number, patch: Partial<FilterRule>) => {
    const next = rules.slice();
    next[index] = { ...next[index], ...patch };
    emitDebounced(next);
  };

  const removeRule = (index: number) => {
    const next = rules.slice();
    next.splice(index, 1);
    emit(next);
  };

  const addRule = () => {
    const defaultColumn = visibleColumns[0];
    if (!defaultColumn) return;
    const operators = getColumnFilterOperators(defaultColumn);
    const defaultOp = operators[0]?.key ?? 'equals';
    const next = rules.concat({
      id: newId(),
      field: defaultColumn.source ?? defaultColumn.title,
      operator: defaultOp,
      value: '',
    });
    emit(next);
  };

  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        background: '#FFFFFF',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={addRule}
          disabled={visibleColumns.length === 0}
        >
          {`+ ${translation('Rule')}`}
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-sm" style={{ color: '#94A3B8', padding: '6px 2px' }}>
          {translation('No rules')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule, index) => {
            return (
              <div key={rule.id} className="flex flex-col gap-2">
                {index > 0 && (
                  <CombinatorBadge
                    translation={translation}
                    value={rule.combinator ?? 'AND'}
                    onChange={(next) => updateRule(index, { combinator: next })}
                  />
                )}
                <RuleRow
                  translation={translation}
                  columns={visibleColumns}
                  rule={rule}
                  onChange={(patch) => updateRule(index, patch)}
                  onValueChange={(patch) => updateRuleValue(index, patch)}
                  onValueCommit={() => flushNow(rules)}
                  onRemove={() => removeRule(index)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface CombinatorBadgeProps {
  translation: Translation;
  value: ColumnCombinator;
  onChange: (next: ColumnCombinator) => void;
}

const CombinatorBadge: FC<CombinatorBadgeProps> = ({ translation, value, onChange }) => {
  return (
    <div className="flex items-center gap-2 pl-3">
      {(['AND', 'OR', 'EXCEPT'] as ColumnCombinator[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          style={value === option ? primaryButtonStyle : neutralButtonStyle}
        >
          {translation(option)}
        </button>
      ))}
    </div>
  );
};

interface RuleRowProps {
  translation: Translation;
  columns: IColumn[];
  rule: FilterRule;
  /** Apply a structural change (column/operator) immediately. */
  onChange: (patch: Partial<FilterRule>) => void;
  /** Apply a value-input change after the debounce period. */
  onValueChange: (patch: Partial<FilterRule>) => void;
  /** Flush any pending value change right now (on blur / Enter). */
  onValueCommit: () => void;
  onRemove: () => void;
}

const RuleRow: FC<RuleRowProps> = ({
  translation,
  columns,
  rule,
  onChange,
  onValueChange,
  onValueCommit,
  onRemove,
}) => {
  const column = columns.find((c) => c.source === rule.field || c.title === rule.field);
  const operators = useMemo<FilterOperatorDescriptor[]>(
    () => getColumnFilterOperators(column),
    [column],
  );
  const operatorDescriptor = operators.find((op) => op.key === rule.operator) ?? operators[0];
  const inputCount = operatorDescriptor?.inputs ?? 1;
  const htmlInputType = inputTypeFor(column);
  const isCollection = operatorDescriptor?.key === COLLECTION_OPERATOR_KEY;
  const collectionTokens = useMemo(() => parseCollectionTokens(rule.value), [rule.value]);

  const onFieldChange = (nextKey: string) => {
    const nextColumn = columns.find((c) => c.source === nextKey || c.title === nextKey);
    const nextOperators = getColumnFilterOperators(nextColumn);
    const nextOperator = nextOperators.some((op) => op.key === rule.operator)
      ? rule.operator
      : (nextOperators[0]?.key ?? 'equals');
    onChange({ field: nextKey, operator: nextOperator, value: '', value2: '' });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '8px',
      }}
    >
      <select
        style={{ ...selectStyle, minWidth: '160px' }}
        value={rule.field}
        onChange={(e) => onFieldChange(e.target.value)}
      >
        <option value="">{translation('Select field')}</option>
        {columns.map((c) => {
          const key = c.source ?? c.title;
          return (
            <option key={key} value={key}>
              {c.title || key}
            </option>
          );
        })}
      </select>

      <select
        style={{ ...selectStyle, minWidth: '160px' }}
        value={operatorDescriptor?.key ?? ''}
        onChange={(e) => onChange({ operator: e.target.value })}
      >
        {operators.map((op) => (
          <option key={op.key} value={op.key}>
            {translation(op.label)}
          </option>
        ))}
      </select>

      {inputCount >= 1 && (
        <div style={{ flex: 1, minWidth: '160px' }}>
          {isCollection && collectionTokens.length ? (
            <div className="mb-1 flex flex-wrap gap-1">
              {collectionTokens.map((token) => (
                <button
                  key={token}
                  type="button"
                  title={translation('Remove')}
                  onClick={() => {
                    const next = collectionTokens.filter((t) => t !== token);
                    onValueChange({ value: joinCollectionTokens(next) });
                  }}
                  style={{
                    border: '1px solid rgba(99, 143, 207, 0.4)',
                    background: 'rgba(99, 143, 207, 0.15)',
                    color: '#2B5797',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {token} ×
                </button>
              ))}
            </div>
          ) : null}

          {isCollection ? (
            <textarea
              placeholder={translation('Enter values separated by commas')}
              style={{
                ...inputStyle,
                width: '100%',
                minHeight: '56px',
                resize: 'vertical',
                paddingTop: '6px',
                paddingBottom: '6px',
              }}
              value={rule.value}
              onChange={(e) => onValueChange({ value: e.target.value })}
              onBlur={onValueCommit}
            />
          ) : (
            <input
              type={htmlInputType}
              placeholder={translation('Value')}
              style={{ ...inputStyle, width: '100%' }}
              value={rule.value}
              onChange={(e) => onValueChange({ value: e.target.value })}
              onBlur={onValueCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onValueCommit();
              }}
            />
          )}
        </div>
      )}
      {inputCount >= 2 && (
        <input
          type={htmlInputType}
          placeholder={translation('Value 2')}
          style={inputStyle}
          value={rule.value2 ?? ''}
          onChange={(e) => onValueChange({ value2: e.target.value })}
          onBlur={onValueCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onValueCommit();
          }}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        title={translation('Delete')}
        style={{
          width: '31px',
          height: '31px',
          borderRadius: '8px',
          border: '1px solid #EC7B80',
          background: '#EC7B8033',
          color: '#EC7B80',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <GoTrash size={14} />
      </button>
    </div>
  );
};
