import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import get from 'lodash/get';
import type { CustomFilterProps } from 'ag-grid-react';
import { CustomComponentContext } from 'ag-grid-react';
import { QODLY_REF_SELECT_FILTER_TYPE, refOptionI18nCompositeKey } from './AgGrid.filtering';

export type QodlyRefSelectFilterParams = CustomFilterProps & {
  refDatasetKey?: string;
  i18n?: any;
  lang?: string;
  maxOptions?: number;
  resolveOptionLabel?: (index: number) => string;
  /** Shown for the empty &lt;option&gt; (e.g. translated "Choose one"). */
  placeholderLabel?: string;
  /** Label for the footer Apply control (legacy custom filters do not get grid-injected buttons). */
  applyButtonLabel?: string;
};

type Option = { value: number; label: string };

function resolveRefFilterConfig(props: QodlyRefSelectFilterParams) {
  const fp = (props as any).filterParams as Record<string, unknown> | undefined;
  const colFp = props.column?.getColDef()?.filterParams as Record<string, unknown> | undefined;
  const refDatasetKey = String(
    (props as any).refDatasetKey ?? fp?.refDatasetKey ?? colFp?.refDatasetKey ?? '',
  ).trim();
  const i18n = (props as any).i18n ?? fp?.i18n ?? colFp?.i18n;
  const lang = ((props as any).lang ?? fp?.lang ?? colFp?.lang) as string | undefined;
  const maxOptions = Number((props as any).maxOptions ?? fp?.maxOptions ?? colFp?.maxOptions ?? 256) || 256;
  const resolveOptionLabel = (fp?.resolveOptionLabel ?? colFp?.resolveOptionLabel) as
    | ((index: number) => string)
    | undefined;
  const placeholderLabel = String(
    (props as any).placeholderLabel ?? fp?.placeholderLabel ?? colFp?.placeholderLabel ?? '—',
  );
  const applyButtonLabel = String(
    (props as any).applyButtonLabel ?? fp?.applyButtonLabel ?? colFp?.applyButtonLabel ?? 'Apply',
  );
  return { refDatasetKey, i18n, lang, maxOptions, resolveOptionLabel, placeholderLabel, applyButtonLabel };
}

/** Labels under `keys.{refKey}{i}` with `.lang` / `.default` (Studio reference lists). */
function pickOptionLabel(i18n: any, lang: string | undefined, refKey: string, i: number): string | undefined {
  const composite = refOptionI18nCompositeKey(refKey, i);
  const base = `keys.${composite}`;
  const fromLang = lang ? get(i18n, `${base}.${lang}`) : undefined;
  const fromDef = get(i18n, `${base}.default`);
  if (fromLang != null && String(fromLang).trim() !== '') return String(fromLang).trim();
  if (fromDef != null && String(fromDef).trim() !== '') return String(fromDef).trim();

  const leaf = get(i18n, base);
  if (typeof leaf === 'string' || typeof leaf === 'number') {
    const s = String(leaf).trim();
    return s || undefined;
  }
  if (leaf && typeof leaf === 'object') {
    if (lang) {
      const v = (leaf as Record<string, unknown>)[lang];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    const d = (leaf as Record<string, unknown>).default;
    if (d != null && String(d).trim() !== '') return String(d).trim();
  }

  return undefined;
}

function loadRefOptions(i18n: any, lang: string | undefined, refKey: string, max: number): Option[] {
  const out: Option[] = [];
  for (let j = 1; j <= max; j++) {
    const text = pickOptionLabel(i18n, lang, refKey, j);
    if (text === undefined) break;
    out.push({ value: j, label: text });
  }
  return out;
}

/**
 * Column filter: &lt;select&gt; of reference values. Labels from `keys.{refDatasetKey}{1..N}` with locale
 * fields (`fr`, `default`, …); filter query uses numeric index `1…N` as stored value.
 *
 * Uses `onModelChange` / `onUiChange` — AG Grid React's filter wrapper does not pass `filterChangedCallback`
 * into the component (see `FilterComponentWrapper.getProps`).
 */
export const QodlyRefSelectFilter = forwardRef<unknown, QodlyRefSelectFilterParams>((props, _ref) => {
  const { model, onModelChange, onUiChange, column, colDef, api } = props;
  const { refDatasetKey, i18n, lang, maxOptions, resolveOptionLabel, placeholderLabel, applyButtonLabel } =
    useMemo(() => resolveRefFilterConfig(props), [column, colDef]);

  const options = useMemo(() => {
    if (!refDatasetKey) return [];
    if (typeof resolveOptionLabel === 'function') {
      const out: Option[] = [];
      for (let j = 1; j <= maxOptions; j++) {
        const text = String(resolveOptionLabel(j) ?? '').trim();
        if (!text) break;
        out.push({ value: j, label: text });
      }
      return out;
    }
    if (i18n) return loadRefOptions(i18n, lang, refDatasetKey, maxOptions);
    return [];
  }, [refDatasetKey, resolveOptionLabel, i18n, lang, maxOptions]);

  /** Pending UI selection until Apply (applied model lives on the grid wrapper as `model`). */
  const pendingRef = useRef<number | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;

  const [selected, setSelected] = useState<string>(() => {
    const v = model?.value;
    return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  });

  const syncPendingFromAppliedModel = useCallback(() => {
    const m = modelRef.current;
    const v = m?.value;
    if (typeof v === 'number' && Number.isFinite(v)) {
      pendingRef.current = v;
      setSelected((s) => (s === String(v) ? s : String(v)));
    } else {
      pendingRef.current = null;
      setSelected((s) => (s === '' ? s : ''));
    }
  }, []);

  /**
   * Do not use `useGridFilter` during render: it calls `setMethods` synchronously, which can trigger
   * AG Grid React's portal `setState` while this component is rendering and cause "Too many re-renders".
   * Register a stable object once in `useLayoutEffect` and keep callbacks fresh via mutation.
   */
  const filterMethodsRef = useRef({
    doesFilterPass: (_params: unknown) => true,
    afterGuiAttached: () => {},
    afterGuiDetached: () => {},
  });
  filterMethodsRef.current.afterGuiAttached = () => {
    syncPendingFromAppliedModel();
  };
  filterMethodsRef.current.afterGuiDetached = () => {
    syncPendingFromAppliedModel();
  };

  const { setMethods } = useContext(CustomComponentContext);
  useLayoutEffect(() => {
    setMethods(filterMethodsRef.current);
    // Register once with a stable object; `setMethods` from context may change identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-entry loops with AG Grid portal updates
  }, []);

  /** Primitive — the grid often passes a new `model` object each render; `[model]` would re-fire forever. */
  const appliedFilterValue =
    model != null &&
    typeof model === 'object' &&
    typeof (model as { value?: unknown }).value === 'number' &&
    Number.isFinite((model as { value: number }).value)
      ? (model as { value: number }).value
      : null;

  useEffect(() => {
    if (appliedFilterValue != null) {
      pendingRef.current = appliedFilterValue;
      setSelected((s) => (s === String(appliedFilterValue) ? s : String(appliedFilterValue)));
    } else {
      pendingRef.current = null;
      setSelected((s) => (s === '' ? s : ''));
    }
  }, [appliedFilterValue]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const raw = e.target.value;
      if (raw === '') {
        pendingRef.current = null;
      } else {
        const n = Number(raw);
        pendingRef.current = Number.isFinite(n) ? n : null;
      }
      setSelected(raw);
      onUiChange();
    },
    [onUiChange],
  );

  const onApply = useCallback(() => {
    const v = pendingRef.current;
    if (v === null) {
      onModelChange(null);
    } else {
      onModelChange({ filterType: QODLY_REF_SELECT_FILTER_TYPE, value: v });
    }
    setTimeout(() => {
      api.refreshInfiniteCache();
      // Re-run filter pipeline so `column.filterActive` / header filter icon update (can lag behind React `onModelChange`).
      api.onFilterChanged('columnFilter');
      api.refreshHeader();
    }, 0);
  }, [api, onModelChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 180 }}>
      <div className="ag-simple-filter-body-wrapper">
        <select
          className="ag-filter-select"
          aria-label={column?.getColDef().headerName ?? column?.getColId() ?? 'Reference filter'}
          value={selected}
          onChange={onChange}
          style={{
            width: '100%',
            minWidth: 160,
            height: 32,
            paddingLeft: 8,
            paddingRight: 32,
            borderRadius: 5,
            border: 'solid 1px #e0e0e0',
            boxSizing: 'border-box',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundColor: '#fff',
            backgroundImage: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/></svg>',
            )}")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            backgroundSize: '20px',
            cursor: 'pointer',
          }}
        >
          <option value="">{placeholderLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="ag-filter-apply-panel">
        <button type="button" className="ag-standard-button" onClick={onApply}>
          {applyButtonLabel}
        </button>
      </div>
    </div>
  );
});

QodlyRefSelectFilter.displayName = 'QodlyRefSelectFilter';
