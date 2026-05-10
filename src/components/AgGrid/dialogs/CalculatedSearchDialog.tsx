import { FC, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { SortModelItem } from 'ag-grid-community';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import { TbDecimal } from 'react-icons/tb';
import {
  MdTextFields,
  MdLooksOne,
  MdCalendarToday,
  MdAccessTime,
  MdCheckBox,
  MdHelpOutline,
} from 'react-icons/md';

import type { SavedSort } from '../state/types';
import { getColumnAgGridFilterType, getColumnFilterOperators } from '../AgGrid.filtering';

type Translation = (key: string) => string;

/** Sentinel for the sort dropdown: no saved sort applied for this search. */
export const CALCULATED_SEARCH_SORT_NONE = 'none' as const;

function savedSortOptionKey(sort: SavedSort): string {
  return String(sort.id ?? sort.name ?? sort.title ?? '');
}

function findSavedSortByAnyKey(
  savedSorts: SavedSort[],
  key: string | number,
): SavedSort | undefined {
  const selectedKey = String(key ?? '').trim();
  if (!selectedKey) return undefined;
  return savedSorts.find(
    (sort) =>
      savedSortOptionKey(sort) === selectedKey ||
      sort.name === selectedKey ||
      sort.title === selectedKey ||
      (sort.id != null && String(sort.id) === selectedKey),
  );
}

/** Full AG Grid sort model for the dropdown choice (empty when “No sort”). */
function sortModelForSelectValue(savedSorts: SavedSort[], selectValue: string): SortModelItem[] {
  if (selectValue === CALCULATED_SEARCH_SORT_NONE) return [];
  const record = findSavedSortByAnyKey(savedSorts, selectValue);
  const model = record?.sortModel;
  if (!Array.isArray(model)) return [];
  return model.map((item) => ({ ...item }));
}

/** Search scope: entire dataset vs current selection (toolbar radios). */
export type CalculatedSearchScopeKind = 'global' | 'selection';

/** How the search result updates the current selection. */
export type CalculatedSearchTypeKind = 'replace' | 'add' | 'remove';

/** Payload emitted on **On Calculated search** (`oncalculatedsearch`). */
export type CalculatedSearchEmitPayload = {
  scope: {
    option: CalculatedSearchScopeKind;
  };
  searchType: {
    option: CalculatedSearchTypeKind;
  };
  /** AG Grid sort model levels (`colId` + `sort`); empty when “No sort” is chosen. */
  sort: SortModelItem[];
  /** Preferred saved-sort link. `sort` remains populated for backward compatibility. */
  linkedSortId?: string | number;
  /** Backward-compatible saved-sort link key. */
  linkedSort?: string | number;
  filterOnFiscalYears: boolean;
  /**
   * Search expression conditions in order.
   * Backward compatible: older saved payloads may omit this field.
   */
  expression?: CalculatedSearchExpression;
};

type SavedCalculatedSearch = {
  name: string;
  title?: string;
  id?: string | number;
  calculatedSearch: CalculatedSearchEmitPayload | null;
  [key: string]: unknown;
};

export type RelationTreeNode =
  | {
      /** Relation node returned by backend. */
      type?: 'toOne' | 'toMany' | string;
      tableId?: number;
      name?: string;
      label?: string;
      targetName?: string;
      link?: string;
      key: string;
      children?: RelationTreeNode[];
    }
  | {
      /** Attribute leaf (only appears under `toMany` relations). */
      type: 'attribute';
      tableId?: number;
      fieldId?: number;
      name?: string;
      label?: string;
      fieldType?: number;
      dataType?: string;
      link?: string;
      key: string;
      children?: never;
    };

function findSavedCalculatedSearch(
  list: SavedCalculatedSearch[],
  key: string,
): SavedCalculatedSearch | null {
  const selectedKey = String(key ?? '').trim();
  const hit = list.find(
    (r) =>
      r.name === selectedKey ||
      r.title === selectedKey ||
      (r.id != null && String(r.id) === selectedKey),
  );
  return hit ?? null;
}

function savedCalculatedSearchKey(record: SavedCalculatedSearch): string {
  return String(record.id ?? record.name ?? record.title ?? '');
}

function sortSelectValueForPayload(
  savedSorts: SavedSort[],
  payload: CalculatedSearchEmitPayload | null | undefined,
): string {
  const linked = payload?.linkedSortId ?? payload?.linkedSort;
  if (linked !== null && linked !== undefined && String(linked).trim() !== '') {
    const hit = findSavedSortByAnyKey(savedSorts, linked);
    return hit ? savedSortOptionKey(hit) : String(linked);
  }
  return CALCULATED_SEARCH_SORT_NONE;
}

const ACCENT = '#2B5797';

const styleSectionHeading: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  lineHeight: 1.25,
  textTransform: 'uppercase',
  margin: 0,
};

const styleLabel11: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: 1.25,
  color: '#475569',
};

const styleBody11: CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.375,
};

const styleBody11Tight: CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.25,
};

const styleControl14: CSSProperties = {
  width: '14px',
  height: '14px',
  flexShrink: 0,
  accentColor: ACCENT,
};

const styleCheckbox14: CSSProperties = {
  width: '14px',
  height: '14px',
  flexShrink: 0,
  accentColor: ACCENT,
};

function AttributeTypeIcon({ dataType }: { dataType?: string }) {
  const dt = String(dataType ?? '')
    .trim()
    .toLowerCase();
  const Icon =
    dt === 'text'
      ? MdTextFields
      : dt === 'integer'
        ? MdLooksOne
        : dt === 'real'
          ? TbDecimal
          : dt === 'date'
            ? MdCalendarToday
            : dt === 'time'
              ? MdAccessTime
              : dt === 'boolean'
                ? MdCheckBox
                : MdHelpOutline;

  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: '14px', height: '14px', color: '#64748B' }}
      aria-hidden
      title={dt || 'unknown'}
    >
      <Icon size={14} />
    </span>
  );
}

function TreeNodeRow({
  node,
  depth,
  expandedKeys,
  toggleKey,
  selectedKey,
  onSelect,
}: {
  node: RelationTreeNode;
  depth: number;
  expandedKeys: Set<string>;
  toggleKey: (key: string) => void;
  selectedKey: string | null;
  onSelect: (node: RelationTreeNode) => void;
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const expanded = expandedKeys.has(node.key);
  const isAttribute = node.type === 'attribute';
  const isSelected = selectedKey === node.key;
  return (
    <div className="select-none">
      <div
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-slate-50"
        style={{
          paddingLeft: `${6 + depth * 12}px`,
          background: isSelected ? 'rgba(43, 87, 151, 0.10)' : undefined,
        }}
      >
        <button
          type="button"
          className="inline-flex items-center justify-center"
          style={{
            width: '12px',
            height: '18px',
            cursor: hasChildren ? 'pointer' : 'default',
            color: '#64748B',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={hasChildren ? expanded : undefined}
          disabled={!hasChildren}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleKey(node.key);
          }}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : ''}
        </button>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          onClick={() => onSelect(node)}
          title={String(node.label ?? node.name ?? node.link ?? node.key)}
        >
          {isAttribute ? <AttributeTypeIcon dataType={(node as any).dataType} /> : null}
          <span className="truncate" style={{ fontSize: '12px' }}>
            {String(node.label ?? node.name ?? node.link ?? node.key)}
          </span>
        </button>
      </div>
      {hasChildren && expanded
        ? node.children!.map((child) => (
            <TreeNodeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              toggleKey={toggleKey}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}

type ConstraintTypeKind = 'count' | 'sum' | 'avg';

type ExpressionLogicKind = 'and' | 'or' | 'except';

export type CalculatedSearchExpressionCondition = {
  /** Logical operator connecting this row with the previous row (omitted for the first row). */
  logic?: ExpressionLogicKind;
  /** Selected node key from `relationTree`. */
  relationKey: string;
  /** Best-effort label (stored for display/debugging; backend should rely on `relationKey`). */
  label: string;
  /** Whether the selection is an attribute leaf. */
  isAttribute: boolean;
  constraint: {
    type: ConstraintTypeKind;
    from: number;
    to: number;
  };
  comparison?: {
    operator: string;
    /** Serialized as strings because inputs are string-based in the UI (including dates). */
    value?: string;
    value2?: string;
    entryMode?: 'free' | 'list';
  };
};

export type CalculatedSearchExpression = {
  conditions: CalculatedSearchExpressionCondition[];
};

function logicLabel(t: Translation, kind: ExpressionLogicKind): string {
  if (kind === 'and') return t('And');
  if (kind === 'or') return t('Or');
  return t('Except');
}

function normalizeDataType(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

function isReelLike(dt: string): boolean {
  const v = normalizeDataType(dt);
  return v === 'reel' || v === 'real';
}

function isDateLike(dt: string): boolean {
  return normalizeDataType(dt) === 'date';
}

function columnDataTypeFromAttribute(dt: string): string {
  const v = normalizeDataType(dt);
  // Match the same dataType buckets used by `AgGrid.filtering.ts`.
  if (v === 'text') return 'text';
  if (v === 'integer') return 'long';
  if (v === 'real' || v === 'reel') return 'number';
  if (v === 'boolean') return 'bool';
  if (v === 'date') return 'date';
  if (v === 'time') return 'text';
  return v || 'word';
}

function pseudoColumnForTarget(node: RelationTreeNode): any {
  const isAttribute = node.type === 'attribute';
  const title = String(node.label ?? node.name ?? node.link ?? node.key);
  const source = String(node.link ?? node.name ?? node.key);
  const attributeDt = isAttribute ? String((node as any).dataType ?? '') : '';
  return {
    id: String((node as any).fieldId ?? node.key ?? source),
    title,
    source,
    dataType: columnDataTypeFromAttribute(attributeDt),
    filtering: true,
    sorting: false,
    locked: false,
    hidden: false,
    sizing: true,
    width: 160,
    format: '',
    flex: 1,
    refValues: (node as any)?.refValues,
  };
}

function findTreePathByKey(tree: RelationTreeNode[], key: string): RelationTreeNode[] | null {
  const walk = (nodes: RelationTreeNode[], acc: RelationTreeNode[]): RelationTreeNode[] | null => {
    for (const node of nodes) {
      const nextAcc = acc.concat(node);
      if (node.key === key) return nextAcc;
      if (Array.isArray(node.children) && node.children.length) {
        const hit = walk(node.children, nextAcc);
        if (hit) return hit;
      }
    }
    return null;
  };
  if (!Array.isArray(tree) || !tree.length) return null;
  return walk(tree, []);
}

export const CalculatedSearchDialog: FC<{
  open: boolean;
  onClose: () => void;
  translation: Translation;
  relationTree: RelationTreeNode[];
  savedSorts: SavedSort[];
  /** Toolbar / grid selected saved sort name; synced when the dialog opens. */
  selectedSortKey: string;
  /** Current “filter on fiscal years” flag from the grid when the dialog opens. */
  filterOnFiscalYearsInitial: boolean;
  /** Saved calculated-search formats (names) shown in the bottom section. */
  savedCalculatedSearches: SavedCalculatedSearch[];
  /** Currently selected saved format — owned by the parent (toolbar + dialog parity). */
  selectedCalculatedSearch: SavedCalculatedSearch | null;
  setSelectedCalculatedSearch: (next: SavedCalculatedSearch | null) => void;
  onSave: (name: string, calculatedSearch: CalculatedSearchEmitPayload) => void;
  onLoad: (key: string) => void;
  onUpdate: (key: string, calculatedSearch: CalculatedSearchEmitPayload) => void;
  onDelete: (record: SavedCalculatedSearch) => void;
  /** Invoked when the user confirms; parent should `emit('oncalculatedsearch', payload)`. */
  onApply: (payload: CalculatedSearchEmitPayload) => void | Promise<void>;
}> = ({
  open,
  onClose,
  translation,
  relationTree,
  savedSorts,
  selectedSortKey: _selectedSortKey,
  filterOnFiscalYearsInitial,
  savedCalculatedSearches,
  selectedCalculatedSearch,
  setSelectedCalculatedSearch,
  onSave,
  onLoad,
  onUpdate,
  onDelete,
  onApply,
}) => {
  const [applyBusy, setApplyBusy] = useState(false);
  const [scopeOption, setScopeOption] = useState<CalculatedSearchScopeKind>('global');
  const [searchTypeOption, setSearchTypeOption] = useState<CalculatedSearchTypeKind>('replace');
  const [sortSelectValue, setSortSelectValue] = useState<string>(CALCULATED_SEARCH_SORT_NONE);
  const [filterOnFiscalYears, setFilterOnFiscalYears] = useState(true);
  const [formatName, setFormatName] = useState('');
  const [expandedRelationKeys, setExpandedRelationKeys] = useState<Set<string>>(() => new Set());
  const [selectedRelationNode, setSelectedRelationNode] = useState<RelationTreeNode | null>(null);
  const [constraintType, setConstraintType] = useState<ConstraintTypeKind>('count');
  const [constraintFrom, setConstraintFrom] = useState<number>(0);
  const [constraintTo, setConstraintTo] = useState<number>(0);
  const [targetOperator, setTargetOperator] = useState<string>('');
  const [targetValue, setTargetValue] = useState<string>('');
  const [targetValue2, setTargetValue2] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'free' | 'list'>('free');
  const [logicForNewCondition, setLogicForNewCondition] = useState<ExpressionLogicKind>('and');
  const [expression, setExpression] = useState<CalculatedSearchExpression>(() => ({
    conditions: [],
  }));
  const [selectedConditionIndex, setSelectedConditionIndex] = useState<number | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setScopeOption('global');
      setSearchTypeOption('replace');
      setSortSelectValue(CALCULATED_SEARCH_SORT_NONE);
      setFilterOnFiscalYears(filterOnFiscalYearsInitial);
      setFormatName('');
      setSelectedCalculatedSearch(null);
      setExpandedRelationKeys(new Set());
      setSelectedRelationNode(null);
      setConstraintType('count');
      setConstraintFrom(0);
      setConstraintTo(0);
      setTargetOperator('');
      setTargetValue('');
      setTargetValue2('');
      setEntryMode('free');
      setLogicForNewCondition('and');
      setExpression({ conditions: [] });
      setSelectedConditionIndex(null);
    }
    wasOpenRef.current = open;
  }, [open, filterOnFiscalYearsInitial, setSelectedCalculatedSearch]);

  const selectedIsAttribute = selectedRelationNode?.type === 'attribute';
  const selectedDataType = selectedIsAttribute
    ? String((selectedRelationNode as any)?.dataType ?? '')
    : '';
  const selectedIsReel = selectedIsAttribute ? isReelLike(selectedDataType) : false;
  const selectedIsDate = selectedIsAttribute ? isDateLike(selectedDataType) : false;

  useEffect(() => {
    // Constraint rules: everything defaults to Number(count), except reel supports sum/avg too.
    if (!selectedIsReel) {
      setConstraintType('count');
    }
  }, [selectedIsReel]);

  // Clamp numeric constraint inputs:
  // - max To is 999
  // - To min is From (and can be equal)
  // - From cannot exceed To after edits
  useEffect(() => {
    setConstraintFrom((prev) => {
      const n = Number.isFinite(prev) ? prev : 0;
      const clamped = Math.min(Math.max(0, n), 999);
      return clamped;
    });
    setConstraintTo((prev) => {
      const n = Number.isFinite(prev) ? prev : 0;
      const clamped = Math.min(Math.max(0, n), 999);
      return clamped;
    });
  }, []);

  useEffect(() => {
    setConstraintTo((prev) => {
      const next = Math.min(Math.max(prev, constraintFrom), 999);
      return next;
    });
  }, [constraintFrom]);

  const targetColumn = useMemo<any | null>(() => {
    if (!selectedRelationNode || !selectedIsAttribute) return null;
    return pseudoColumnForTarget(selectedRelationNode);
  }, [selectedRelationNode, selectedIsAttribute]);

  const targetFilterType = useMemo(() => getColumnAgGridFilterType(targetColumn), [targetColumn]);
  const targetOperators = useMemo(
    () => (targetColumn ? getColumnFilterOperators(targetColumn) : []),
    [targetColumn],
  );
  const targetIsBooleanOperators = useMemo(
    () => targetOperators.some((o) => o.key === 'isTrue' || o.key === 'isFalse'),
    [targetOperators],
  );
  const targetOperatorDescriptor = useMemo(() => {
    if (!targetOperators.length) return null;
    return targetOperators.find((o) => o.key === targetOperator) ?? targetOperators[0];
  }, [targetOperators, targetOperator]);
  const targetInputs = targetOperatorDescriptor?.inputs ?? 1;
  const targetHtmlInputType = useMemo<'text' | 'number' | 'date'>(() => {
    const dt = String(targetColumn?.dataType ?? '')
      .trim()
      .toLowerCase();
    if (dt === 'date') return 'date';
    if (['word', 'short', 'long', 'number', 'long64', 'duration'].includes(dt)) return 'number';
    return 'text';
  }, [targetColumn]);

  const targetRefOptions = useMemo(() => {
    if (targetFilterType !== 'qodlyRefSelect') return [];
    const rawRefValues: any = targetColumn?.refValues;
    const values: any[] | null = Array.isArray(rawRefValues)
      ? rawRefValues
      : typeof rawRefValues === 'string' && rawRefValues.trim()
        ? rawRefValues
            .split(/[\n\r,]+/g)
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
    const out: Array<{ value: number; label: string }> = [];
    if (!values) return out;
    values.forEach((v) => {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
      if (!Number.isFinite(n)) return;
      out.push({ value: n, label: String(n) });
    });
    return out;
  }, [targetColumn, targetFilterType]);

  useEffect(() => {
    // When the selected attribute changes, re-seed the operator like the header filter does.
    if (!targetColumn) {
      setTargetOperator('');
      setTargetValue('');
      setTargetValue2('');
      return;
    }
    const defaultOp = targetIsBooleanOperators ? '' : (targetOperators[0]?.key ?? '');
    setTargetOperator(defaultOp);
    setTargetValue('');
    setTargetValue2('');
  }, [targetColumn, targetOperators, targetIsBooleanOperators]);

  const selectedLabel = useMemo(() => {
    if (!selectedRelationNode) return '';
    const selfLabel = String(
      selectedRelationNode.label ??
        selectedRelationNode.name ??
        selectedRelationNode.link ??
        selectedRelationNode.key,
    );
    if (selectedRelationNode.type !== 'attribute') return selfLabel;

    const path = findTreePathByKey(relationTree, selectedRelationNode.key);
    if (!path || path.length < 2) return selfLabel;
    const parent = [...path]
      .reverse()
      .find(
        (n) =>
          n &&
          typeof n === 'object' &&
          (n as any).type !== 'attribute' &&
          n.key !== selectedRelationNode.key,
      );
    const parentLabel = parent
      ? String(parent.label ?? parent.name ?? parent.link ?? parent.key)
      : '';
    return parentLabel ? `${parentLabel} : ${selfLabel}` : selfLabel;
  }, [relationTree, selectedRelationNode]);

  const toggleRelationKey = useCallback((key: string) => {
    setExpandedRelationKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const buildDraftPayload = useCallback((): CalculatedSearchEmitPayload => {
    const linkedSort =
      sortSelectValue === CALCULATED_SEARCH_SORT_NONE ? undefined : sortSelectValue;
    return {
      scope: { option: scopeOption },
      searchType: { option: searchTypeOption },
      sort: sortModelForSelectValue(savedSorts, sortSelectValue),
      ...(linkedSort !== undefined ? { linkedSortId: linkedSort, linkedSort } : {}),
      filterOnFiscalYears,
      expression,
    };
  }, [scopeOption, searchTypeOption, savedSorts, sortSelectValue, filterOnFiscalYears, expression]);

  const isEditingSelectedCondition = useMemo(
    () => selectedConditionIndex !== null,
    [selectedConditionIndex],
  );

  const canCreateCondition = useMemo(() => {
    if (!selectedRelationNode) return false;
    // We allow table nodes too (comparison will be omitted).
    if (selectedRelationNode.type !== 'attribute') return true;
    // Attribute requires an operator if operators exist and isn't the boolean sentinel.
    if (targetIsBooleanOperators) return Boolean(targetOperator);
    return Boolean(targetOperator || targetOperators.length === 0);
  }, [selectedRelationNode, targetIsBooleanOperators, targetOperator, targetOperators.length]);

  const buildConditionFromInputs = useCallback((): CalculatedSearchExpressionCondition | null => {
    if (!selectedRelationNode) return null;
    const isAttribute = selectedRelationNode.type === 'attribute';
    const label =
      selectedLabel || String(selectedRelationNode.label ?? selectedRelationNode.name ?? '');

    const base: CalculatedSearchExpressionCondition = {
      // first row doesn't need logic; insert will fix logic later
      logic: expression.conditions.length ? logicForNewCondition : undefined,
      relationKey: String(selectedRelationNode.key),
      label,
      isAttribute,
      constraint: { type: constraintType, from: constraintFrom, to: constraintTo },
    };

    if (!isAttribute) return base;

    const op = String(targetOperator ?? '').trim();
    const v1 = String(targetValue ?? '');
    const v2 = String(targetValue2 ?? '');

    return {
      ...base,
      comparison: {
        operator: op,
        value: v1,
        value2: v2,
        entryMode,
      },
    };
  }, [
    constraintFrom,
    constraintTo,
    constraintType,
    entryMode,
    expression.conditions.length,
    logicForNewCondition,
    selectedLabel,
    selectedRelationNode,
    targetOperator,
    targetValue,
    targetValue2,
  ]);

  const normalizeExpressionAfterEdit = useCallback(
    (next: CalculatedSearchExpression): CalculatedSearchExpression => {
      const conditions = next.conditions.map((c, idx) => {
        if (idx === 0) {
          const { logic, ...rest } = c;
          return rest as CalculatedSearchExpressionCondition;
        }
        return { ...c, logic: (c.logic ?? 'and') as ExpressionLogicKind };
      });
      return { conditions };
    },
    [],
  );

  const hydrateDraftFromPayload = useCallback(
    (payload: CalculatedSearchEmitPayload | null | undefined) => {
      if (!payload) {
        setScopeOption('global');
        setSearchTypeOption('replace');
        setSortSelectValue(CALCULATED_SEARCH_SORT_NONE);
        setFilterOnFiscalYears(filterOnFiscalYearsInitial);
        setExpression({ conditions: [] });
        setExpandedRelationKeys(new Set());
        setSelectedConditionIndex(null);
        setSelectedRelationNode(null);
        setConstraintType('count');
        setConstraintFrom(0);
        setConstraintTo(0);
        setTargetOperator('');
        setTargetValue('');
        setTargetValue2('');
        setEntryMode('free');
        setLogicForNewCondition('and');
        return;
      }

      const nextExpression =
        payload.expression && Array.isArray(payload.expression.conditions)
          ? normalizeExpressionAfterEdit(payload.expression)
          : { conditions: [] };
      const expandedKeys = new Set<string>();
      nextExpression.conditions.forEach((condition) => {
        const path = findTreePathByKey(relationTree, condition.relationKey);
        if (!path) return;
        path.slice(0, -1).forEach((node) => expandedKeys.add(node.key));
      });

      setScopeOption(payload.scope?.option ?? 'global');
      setSearchTypeOption(payload.searchType?.option ?? 'replace');
      setFilterOnFiscalYears(Boolean(payload.filterOnFiscalYears));
      setSortSelectValue(sortSelectValueForPayload(savedSorts, payload));
      setExpression(nextExpression);
      setExpandedRelationKeys(expandedKeys);
      setSelectedConditionIndex(null);
      setSelectedRelationNode(null);
      setConstraintType('count');
      setConstraintFrom(0);
      setConstraintTo(0);
      setTargetOperator('');
      setTargetValue('');
      setTargetValue2('');
      setEntryMode('free');
      setLogicForNewCondition('and');
    },
    [filterOnFiscalYearsInitial, normalizeExpressionAfterEdit, relationTree, savedSorts],
  );

  const handleAddCondition = useCallback(() => {
    if (!canCreateCondition) return;
    const cond = buildConditionFromInputs();
    if (!cond) return;
    setExpression((prev) =>
      normalizeExpressionAfterEdit({ conditions: prev.conditions.concat(cond) }),
    );
    setSelectedConditionIndex((prev) => {
      const nextIndex = expression.conditions.length; // previous length
      return prev === null ? nextIndex : nextIndex;
    });
  }, [
    buildConditionFromInputs,
    canCreateCondition,
    expression.conditions.length,
    normalizeExpressionAfterEdit,
  ]);

  const handleUpdateSelectedCondition = useCallback(() => {
    if (!canCreateCondition) return;
    if (selectedConditionIndex === null) return;
    const cond = buildConditionFromInputs();
    if (!cond) return;
    setExpression((prev) => {
      if (selectedConditionIndex < 0 || selectedConditionIndex >= prev.conditions.length)
        return prev;
      const next = prev.conditions.slice();
      // Keep the edited row's position; logic comes from the current logic radios for non-first rows.
      const normalized: CalculatedSearchExpressionCondition = {
        ...cond,
        logic: selectedConditionIndex === 0 ? undefined : logicForNewCondition,
      };
      next[selectedConditionIndex] = normalized;
      return normalizeExpressionAfterEdit({ conditions: next });
    });
  }, [
    buildConditionFromInputs,
    canCreateCondition,
    logicForNewCondition,
    normalizeExpressionAfterEdit,
    selectedConditionIndex,
  ]);

  const handleInsertCondition = useCallback(() => {
    if (!canCreateCondition) return;
    const cond = buildConditionFromInputs();
    if (!cond) return;
    setExpression((prev) => {
      const idx =
        selectedConditionIndex === null
          ? prev.conditions.length
          : Math.min(Math.max(0, selectedConditionIndex), prev.conditions.length);
      const next = prev.conditions.slice();
      next.splice(idx, 0, cond);
      return normalizeExpressionAfterEdit({ conditions: next });
    });
    setSelectedConditionIndex((prev) => (prev === null ? 0 : prev));
  }, [
    buildConditionFromInputs,
    canCreateCondition,
    normalizeExpressionAfterEdit,
    selectedConditionIndex,
  ]);

  const handleDeleteSelectedCondition = useCallback(() => {
    if (selectedConditionIndex === null) return;
    setExpression((prev) => {
      if (selectedConditionIndex < 0 || selectedConditionIndex >= prev.conditions.length)
        return prev;
      const next = prev.conditions.slice();
      next.splice(selectedConditionIndex, 1);
      return normalizeExpressionAfterEdit({ conditions: next });
    });
    setSelectedConditionIndex((prev) => {
      if (prev === null) return null;
      const nextIdx = Math.max(0, prev - 1);
      return nextIdx;
    });
  }, [normalizeExpressionAfterEdit, selectedConditionIndex]);

  const handleRemoveAllConditions = useCallback(() => {
    setExpression({ conditions: [] });
    setSelectedConditionIndex(null);
  }, []);

  const moveCondition = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      setExpression((prev) => {
        if (from < 0 || from >= prev.conditions.length) return prev;
        if (to < 0 || to >= prev.conditions.length) return prev;
        const next = prev.conditions.slice();
        const tmp = next[to];
        next[to] = next[from];
        next[from] = tmp;
        return normalizeExpressionAfterEdit({ conditions: next });
      });
      setSelectedConditionIndex((prev) => {
        if (prev === null) return null;
        if (prev === from) return to;
        if (prev === to) return from;
        return prev;
      });
    },
    [normalizeExpressionAfterEdit],
  );

  const handleMoveUpAtIndex = useCallback(
    (idx: number) => {
      if (idx <= 0) return;
      moveCondition(idx, idx - 1);
    },
    [moveCondition],
  );

  const handleMoveDownAtIndex = useCallback(
    (idx: number) => {
      moveCondition(idx, idx + 1);
    },
    [moveCondition],
  );

  const handleEditCondition = useCallback(
    (idx: number) => {
      const row = expression.conditions[idx];
      if (!row) return;

      setSelectedConditionIndex(idx);
      setLogicForNewCondition((idx === 0 ? 'and' : (row.logic ?? 'and')) as ExpressionLogicKind);
      setConstraintType(row.constraint.type);
      setConstraintFrom(row.constraint.from);
      setConstraintTo(row.constraint.to);
      setEntryMode(row.comparison?.entryMode ?? 'free');

      // Select the underlying node in the relation tree.
      const path = findTreePathByKey(relationTree, row.relationKey);
      if (path && path.length) {
        const nextExpanded = new Set<string>();
        // Expand all non-leaf nodes in the path so the leaf is visible.
        path.forEach((n, i) => {
          if (i < path.length - 1) nextExpanded.add(n.key);
        });
        setExpandedRelationKeys(nextExpanded);
        setSelectedRelationNode(path[path.length - 1]);
      }

      // Comparison inputs (only for attribute rows)
      setTargetOperator(String(row.comparison?.operator ?? ''));
      setTargetValue(String(row.comparison?.value ?? ''));
      setTargetValue2(String(row.comparison?.value2 ?? ''));
    },
    [expression.conditions, relationTree],
  );

  const trimmedFormatName = formatName.trim();
  const matchingExisting = trimmedFormatName
    ? (savedCalculatedSearches.find((r) => r.name === trimmedFormatName)?.name ?? null)
    : null;
  const willUpdateExisting =
    Boolean(matchingExisting) || (!trimmedFormatName && !!selectedCalculatedSearch);
  const saveButtonDisabled = !trimmedFormatName && !selectedCalculatedSearch;

  const handleSavePressed = useCallback(() => {
    if (saveButtonDisabled) return;
    const draft = buildDraftPayload();
    if (trimmedFormatName) {
      if (matchingExisting) {
        onUpdate(matchingExisting, draft);
      } else {
        onSave(trimmedFormatName, draft);
      }
    } else if (selectedCalculatedSearch) {
      onUpdate(savedCalculatedSearchKey(selectedCalculatedSearch), draft);
    }
    setFormatName('');
  }, [
    buildDraftPayload,
    matchingExisting,
    onSave,
    onUpdate,
    saveButtonDisabled,
    selectedCalculatedSearch,
    trimmedFormatName,
  ]);

  const handleApply = useCallback(async () => {
    if (applyBusy) return;
    const payload = buildDraftPayload();
    setApplyBusy(true);
    try {
      await onApply(payload);
    } finally {
      setApplyBusy(false);
    }
  }, [applyBusy, onApply, buildDraftPayload]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 rounded-t-xl">
          <div>
            <span
              className="tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '16px', fontWeight: 500 }}
            >
              {translation('Calculated search')}
            </span>
            <span className="mt-1 block text-sm" style={{ color: '#4A5565', fontSize: '14px' }}>
              {translation('Filter rows label')}
            </span>
          </div>
          <button
            className="inline-flex items-center justify-center"
            style={{ color: '#6A7282' }}
            onClick={onClose}
          >
            <IoMdClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
            {/* Two columns: equal width (50% / 50%) — fields | constraint + target */}
            <div className="flex min-h-0 min-w-0 flex-row items-stretch gap-4 overflow-x-auto">
              {/* Column 1 — Available fields */}
              <div
                className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded border border-slate-200 bg-white"
                style={{ minHeight: '200px', maxHeight: '300px' }}
              >
                <div
                  className="border-b border-slate-200 bg-slate-50 px-2 py-1.5"
                  style={styleSectionHeading}
                >
                  {translation('Available fields')}
                </div>
                <div
                  className="min-h-0 flex-1 overflow-y-auto p-2 font-mono leading-snug"
                  style={{ fontSize: '11px' }}
                >
                  {Array.isArray(relationTree) && relationTree.length > 0 ? (
                    <div className="font-sans">
                      {relationTree.map((node) => (
                        <TreeNodeRow
                          key={node.key}
                          node={node}
                          depth={0}
                          expandedKeys={expandedRelationKeys}
                          toggleKey={toggleRelationKey}
                          selectedKey={selectedRelationNode?.key ?? null}
                          onSelect={(picked) => {
                            setSelectedRelationNode(picked);
                            // Reset constraint range inputs whenever the user picks a different tree item.
                            setConstraintFrom(0);
                            setConstraintTo(0);
                            if (picked.type !== 'attribute') {
                              // Table selection does not support target-value filtering.
                              setTargetOperator('');
                              setTargetValue('');
                              setTargetValue2('');
                            }
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="font-sans">{translation('No available fields')}</div>
                  )}
                </div>
              </div>

              {/* Column 2 — Constraint + Target value (same width as column 1) */}
              <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-3">
                <section className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:p-3">
                  <h3 style={styleSectionHeading}>{translation('Constraint')}</h3>
                  <div className="flex flex-col gap-2">
                    <label className="flex w-full flex-col gap-1 text-left">
                      <span style={styleLabel11}>{translation('Constraint type')}</span>
                      <select
                        className="h-7 w-full rounded border px-2 text-xs outline-none"
                        value={constraintType}
                        onChange={(e) => setConstraintType(e.target.value as ConstraintTypeKind)}
                        disabled={!selectedRelationNode || !selectedIsAttribute || !selectedIsReel}
                        title={
                          !selectedRelationNode
                            ? translation('Select a table or attribute first')
                            : !selectedIsAttribute
                              ? translation('Only Number (count) is available for tables')
                              : selectedIsReel
                                ? translation('Choose how to calculate the numeric constraint')
                                : translation('Only Number (count) is available for this type')
                        }
                      >
                        <option value="count">{translation('Number (count)')}</option>
                        {selectedIsReel ? <option value="sum">{translation('Sum')}</option> : null}
                        {selectedIsReel ? (
                          <option value="avg">{translation('Average')}</option>
                        ) : null}
                      </select>
                    </label>
                    <div>
                      <span
                        className="mb-1 block font-medium text-slate-600"
                        style={{ fontSize: '11px' }}
                      >
                        {translation('Number of related records')}
                      </span>
                      <div className="flex flex-wrap items-end">
                        <label className="flex flex-row items-center gap-1 text-left w-1/2 px-1">
                          <span style={styleLabel11}>{translation('From')}</span>
                          <input
                            type="number"
                            className="h-7 rounded border px-1 text-xs leading-tight w-full"
                            min={0}
                            max={999}
                            value={String(constraintFrom)}
                            disabled={!selectedRelationNode}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              const clamped = Number.isFinite(next)
                                ? Math.min(Math.max(0, next), 999)
                                : 0;
                              setConstraintFrom(clamped);
                            }}
                          />
                        </label>
                        <label className="flex flex-row items-center gap-1 text-left w-1/2 px-1">
                          <span style={styleLabel11}>{translation('To')}</span>
                          <input
                            type="number"
                            className="h-7 rounded border px-1 text-xs leading-tight w-full"
                            min={constraintFrom}
                            max={999}
                            value={String(constraintTo)}
                            disabled={!selectedRelationNode}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              const clamped = Number.isFinite(next)
                                ? Math.min(Math.max(constraintFrom, next), 999)
                                : constraintFrom;
                              setConstraintTo(clamped);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:p-3">
                  <h3 style={styleSectionHeading}>{translation('Target value')}</h3>
                  {!selectedRelationNode ? (
                    <div className="text-slate-500" style={{ fontSize: '11px' }}>
                      {translation('Select a table or attribute to edit the target value')}
                    </div>
                  ) : !selectedIsAttribute ? (
                    <div className="text-slate-500" style={{ fontSize: '11px' }}>
                      {translation('Target value is available only for attributes')}
                    </div>
                  ) : (
                    <>
                      <div className="mb-1 text-slate-500" style={{ fontSize: '11px' }}>
                        {selectedLabel}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            className="h-7 w-full rounded border px-3 text-xs outline-none sm:w-56"
                            value={targetOperator}
                            onChange={(e) => setTargetOperator(e.target.value)}
                            disabled={!targetOperators.length}
                          >
                            {targetIsBooleanOperators ? (
                              <option value="" disabled>
                                {translation('Choose one')}
                              </option>
                            ) : null}
                            {targetOperators.map((op) => (
                              <option key={op.key} value={op.key}>
                                {translation(op.label)}
                              </option>
                            ))}
                          </select>

                          {targetInputs >= 1 ? (
                            targetFilterType === 'qodlyRefSelect' ? (
                              <select
                                className="h-8 w-full rounded border px-3 text-sm outline-none"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                              >
                                <option value="">{translation('Choose one')}</option>
                                {targetRefOptions.map((o) => (
                                  <option key={o.value} value={String(o.value)}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={targetHtmlInputType}
                                className="h-8 w-full rounded border px-3 text-sm outline-none"
                                placeholder={translation('Filter...')}
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                              />
                            )
                          ) : null}
                        </div>

                        {targetInputs === 2 ? (
                          <input
                            type={targetHtmlInputType}
                            className="h-8 w-full rounded border px-3 text-sm outline-none"
                            placeholder={translation('Filter...')}
                            value={targetValue2}
                            onChange={(e) => setTargetValue2(e.target.value)}
                          />
                        ) : null}
                      </div>
                      {selectedIsDate ? (
                        <div className="mt-2">
                          <label className="flex w-full flex-col gap-1 text-left">
                            <span style={styleLabel11}>{translation('Entry mode')}</span>
                            <select
                              className="h-7 w-full rounded border px-2 text-xs outline-none"
                              value={entryMode}
                              onChange={(e) => setEntryMode(e.target.value as 'free' | 'list')}
                            >
                              <option value="free">{translation('Free entry')}</option>
                              <option value="list">{translation('From list')}</option>
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              </div>
            </div>

            {/* Search expression table */}
            <div>
              <div
                className="mb-1 py-2 font-semibold uppercase tracking-wide"
                style={styleSectionHeading}
              >
                {translation('Search expression')}
              </div>
              <div className="overflow-x-auto rounded border border-slate-200">
                <div
                  className="flex w-full min-w-0 flex-col text-left text-slate-800"
                  style={{ minWidth: '520px', fontSize: '11px' }}
                  role="table"
                  aria-label={translation('Search expression')}
                >
                  <div
                    className="flex w-full flex-row border-b border-slate-200 bg-slate-100 font-medium text-slate-600"
                    role="row"
                  >
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Logic')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Table / Field')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Constraint')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Comparison operator')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Target value')}
                    </div>
                  </div>
                  {expression.conditions.length === 0 ? (
                    <div
                      className="flex w-full flex-row border-b border-slate-200 bg-white"
                      role="row"
                    >
                      <div className="min-w-0 flex-1 px-1.5 py-2 text-slate-500" role="cell">
                        {translation('No conditions')}
                      </div>
                      <div className="min-w-0 flex-1 px-1.5 py-2 text-slate-500" role="cell">
                        —
                      </div>
                      <div className="min-w-0 flex-1 px-1.5 py-2 text-slate-500" role="cell">
                        —
                      </div>
                      <div className="min-w-0 flex-1 px-1.5 py-2 text-slate-500" role="cell">
                        —
                      </div>
                      <div className="min-w-0 flex-1 px-1.5 py-2 text-slate-500" role="cell">
                        —
                      </div>
                    </div>
                  ) : (
                    expression.conditions.map((row, idx) => {
                      const selected = selectedConditionIndex === idx;
                      const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                      const rowLogic =
                        idx === 0
                          ? '—'
                          : logicLabel(translation, (row.logic ?? 'and') as ExpressionLogicKind);
                      const constraintText = `${row.constraint.from} … ${row.constraint.to}`;
                      const opLabel = row.comparison?.operator
                        ? translation(
                            targetOperators.find((o) => o.key === row.comparison!.operator)
                              ?.label ?? row.comparison.operator,
                          )
                        : '—';
                      const targetText =
                        row.isAttribute && row.comparison
                          ? row.comparison.value2
                            ? `${row.comparison.value ?? ''} ; ${row.comparison.value2 ?? ''}`
                            : (row.comparison.value ?? '—')
                          : '—';
                      return (
                        <button
                          key={`${row.relationKey}-${idx}`}
                          type="button"
                          className={`flex w-full flex-row border-b border-slate-200 text-left ${bg}`}
                          role="row"
                          onClick={() => setSelectedConditionIndex(idx)}
                          onDoubleClick={() => handleEditCondition(idx)}
                          style={{
                            cursor: 'pointer',
                            outline: 'none',
                            background: selected ? 'rgba(43, 87, 151, 0.10)' : undefined,
                          }}
                        >
                          <div
                            className="min-w-0 flex-1 px-1.5 py-1 font-semibold"
                            style={{ color: idx === 0 ? '#94A3B8' : ACCENT }}
                            role="cell"
                          >
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex flex-col leading-none">
                                <button
                                  type="button"
                                  aria-label={translation('Move up')}
                                  disabled={idx === 0}
                                  className="px-1 disabled:opacity-30"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMoveUpAtIndex(idx);
                                  }}
                                  title={translation('Move up')}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  aria-label={translation('Move down')}
                                  disabled={idx === expression.conditions.length - 1}
                                  className="px-1 disabled:opacity-30"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMoveDownAtIndex(idx);
                                  }}
                                  title={translation('Move down')}
                                >
                                  ▼
                                </button>
                              </span>
                              <span>{rowLogic}</span>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 px-1.5 py-1" role="cell" title={row.label}>
                            <span className="truncate block">{row.label}</span>
                          </div>
                          <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                            {constraintText}
                          </div>
                          <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                            {opLabel}
                          </div>
                          <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                            {targetText || '—'}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="flex flex-wrap items-center gap-2 text-slate-700"
                  style={styleBody11}
                >
                  <span className="font-medium text-slate-600">
                    {translation('Logical operators')}
                  </span>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-slate-700">
                    <input
                      type="radio"
                      name="calcsearch-logic"
                      checked={logicForNewCondition === 'and'}
                      onChange={() => setLogicForNewCondition('and')}
                      style={{ accentColor: ACCENT }}
                    />
                    {translation('And')}
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-slate-700">
                    <input
                      type="radio"
                      name="calcsearch-logic"
                      checked={logicForNewCondition === 'or'}
                      onChange={() => setLogicForNewCondition('or')}
                      style={{ accentColor: ACCENT }}
                    />
                    {translation('Or')}
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-slate-700">
                    <input
                      type="radio"
                      name="calcsearch-logic"
                      checked={logicForNewCondition === 'except'}
                      onChange={() => setLogicForNewCondition('except')}
                      style={{ accentColor: ACCENT }}
                    />
                    {translation('Except')}
                  </label>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['Add', 'Insert', 'Delete', 'Remove all'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-700"
                      style={{ fontSize: '11px' }}
                      disabled={
                        key === 'Add' || key === 'Insert'
                          ? !canCreateCondition
                          : key === 'Delete'
                            ? selectedConditionIndex === null
                            : key === 'Remove all'
                              ? expression.conditions.length === 0
                              : false
                      }
                      onClick={() => {
                        if (key === 'Add') {
                          if (isEditingSelectedCondition) handleUpdateSelectedCondition();
                          else handleAddCondition();
                        } else if (key === 'Insert') handleInsertCondition();
                        else if (key === 'Delete') handleDeleteSelectedCondition();
                        else if (key === 'Remove all') handleRemoveAllConditions();
                      }}
                    >
                      {key === 'Add' && isEditingSelectedCondition
                        ? translation('Update')
                        : translation(key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom bands — flex-row with wrap; compact spacing */}
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex w-full flex-row flex-wrap items-start gap-3 text-left md:gap-4">
                <section className="flex flex-1 flex-col gap-1.5">
                  <h3 style={styleSectionHeading}>{translation('Options')}</h3>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex w-full flex-col gap-1 text-left">
                      <span style={styleLabel11}>{translation('Sort order')}</span>
                      <select
                        className="h-7 w-full rounded border px-2 text-xs outline-none"
                        value={sortSelectValue}
                        onChange={(e) => setSortSelectValue(e.target.value)}
                      >
                        <option value={CALCULATED_SEARCH_SORT_NONE}>
                          {translation('No sort')}
                        </option>
                        {savedSorts
                          .filter((sort) => savedSortOptionKey(sort).length > 0)
                          .map((sort) => {
                            const value = savedSortOptionKey(sort);
                            const label = String(sort.title ?? sort.name ?? value);
                            return (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            );
                          })}
                      </select>
                    </label>
                    <label
                      className="flex cursor-pointer items-center gap-1.5 text-slate-800"
                      style={styleBody11Tight}
                    >
                      <input
                        type="checkbox"
                        checked={filterOnFiscalYears}
                        onChange={(e) => setFilterOnFiscalYears(e.target.checked)}
                        className="shrink-0 rounded border-slate-300"
                        style={styleCheckbox14}
                      />
                      {translation('Filter on fiscal years')}
                    </label>
                  </div>
                </section>

                <section className="flex flex-1 flex-col gap-1.5">
                  <h3 style={styleSectionHeading}>{translation('Search scope')}</h3>
                  <div className="flex flex-col gap-1 text-slate-800" style={styleBody11Tight}>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-scope"
                        checked={scopeOption === 'global'}
                        onChange={() => setScopeOption('global')}
                        style={styleControl14}
                      />
                      {translation('Global search')}
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-scope"
                        checked={scopeOption === 'selection'}
                        onChange={() => setScopeOption('selection')}
                        style={styleControl14}
                      />
                      {translation('Search in selection')}
                    </label>
                  </div>
                </section>

                <section className="flex flex-1 flex-col gap-1.5">
                  <h3 style={styleSectionHeading}>{translation('Search type')}</h3>
                  <div className="flex flex-col gap-1 text-slate-800" style={styleBody11Tight}>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-type"
                        checked={searchTypeOption === 'replace'}
                        onChange={() => setSearchTypeOption('replace')}
                        style={styleControl14}
                      />
                      {translation('Replace selection')}
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-type"
                        checked={searchTypeOption === 'add'}
                        onChange={() => setSearchTypeOption('add')}
                        style={styleControl14}
                      />
                      {translation('Add to selection')}
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-type"
                        checked={searchTypeOption === 'remove'}
                        onChange={() => setSearchTypeOption('remove')}
                        style={styleControl14}
                      />
                      {translation('Remove from selection')}
                    </label>
                  </div>
                </section>
              </div>
            </div>
            {/* Saved calculated-search formats (same i18n keys as Filter dialog) */}
            <div
              className="px-5 py-3 flex flex-col gap-3 mt-2"
              style={{ borderTop: '1px solid #E5E7EB' }}
            >
              <span style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}>
                {translation('Saved filters')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={translation('Filter name')}
                  value={formatName}
                  onChange={(e) => setFormatName(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-1"
                  style={{
                    borderRadius: '6px',
                    borderColor: '#0000001A',
                    color: '#44444C',
                    fontSize: '12px',
                  }}
                />
                <select
                  value={
                    selectedCalculatedSearch
                      ? savedCalculatedSearchKey(selectedCalculatedSearch)
                      : ''
                  }
                  onChange={(e) => {
                    const nextKey = e.target.value;
                    const record = nextKey
                      ? findSavedCalculatedSearch(savedCalculatedSearches, nextKey)
                      : null;

                    setSelectedCalculatedSearch(record ?? null);

                    hydrateDraftFromPayload(record?.calculatedSearch);

                    if (nextKey) onLoad(nextKey);
                  }}
                  className="rounded-lg border border-gray-300 px-2 py-1"
                  style={{
                    borderRadius: '6px',
                    borderColor: '#0000001A',
                    color: '#44444C',
                    fontSize: '12px',
                  }}
                >
                  <option value="">Select calculated search</option>
                  {savedCalculatedSearches.map((record) => (
                    <option
                      key={savedCalculatedSearchKey(record)}
                      value={savedCalculatedSearchKey(record)}
                    >
                      {record.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '8px',
                    color: '#EC7B80',
                    borderColor: '#EC7B80',
                    backgroundColor: '#EC7B8033',
                  }}
                  onClick={() => {
                    if (!selectedCalculatedSearch) return;
                    onDelete(selectedCalculatedSearch);
                  }}
                  title={translation('Delete')}
                >
                  <GoTrash size={14} />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderRadius: '6px',
                    borderColor: '#0000001A',
                    color: '#44444C',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  disabled={saveButtonDisabled}
                  onClick={handleSavePressed}
                >
                  {willUpdateExisting ? translation('Update') : translation('Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div
          className="flex w-full shrink-0 items-center justify-end gap-2 p-4"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-3 py-2"
            style={{
              height: '31px',
              borderRadius: '6px',
              borderColor: '#0000001A',
              color: '#44444C',
              fontSize: '12px',
            }}
            onClick={onClose}
          >
            {translation('Cancel')}
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-3 py-2 text-center text-sm text-white disabled:opacity-50"
            onClick={() => void handleApply()}
            disabled={applyBusy}
            style={{
              background: '#2B5797',
              height: '31px',
              fontSize: '12px',
            }}
          >
            {translation('Apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
