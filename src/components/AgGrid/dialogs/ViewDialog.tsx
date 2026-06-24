import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import { MdDragIndicator } from 'react-icons/md';
import type { ViewsManager } from '../state/views';
import type { SavedFilter } from '../state/types';
import type { Translation } from '../state/sorts';
import { savedRecordKey } from '../state/gridState';

interface ViewDialogColumn {
  field: string;
  isHidden: boolean;
  pinned: 'left' | 'right' | null;
  width?: number | null;
  flex?: number | null;
  i18n?: string | null;
}

interface ViewDialogColumnState {
  colId?: string | number | null;
  hide?: boolean | null;
  pinned?: 'left' | 'right' | null;
  width?: number | null;
  flex?: number | null;
}

const END_DROP_TARGET = '__qodly_view_dialog_drop_end__';
const MIN_COLUMN_WIDTH = 20;

type ViewDialogDraftColumn = Omit<ViewDialogColumn, 'width'> & {
  width?: number | string | null;
};

function normalizeColumnWidth(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(MIN_COLUMN_WIDTH, Math.round(parsed));
}

interface ViewDialogProps {
  open: boolean;
  onClose: () => void;
  translation: Translation;
  showToolbarSaveView: boolean;
  showToolbarSavedViews: boolean;
  viewName: string;
  setViewName: (value: string) => void;
  selectedView: string;
  setSelectedView: (value: string) => void;
  onLoadView: (value: string) => void;
  isViewDefault: boolean;
  setIsViewDefault: (value: boolean) => void;
  viewsManager: ViewsManager;
  propertySearch: string;
  setPropertySearch: (value: string) => void;
  showVisibleOnly: boolean;
  setShowVisibleOnly: (value: boolean) => void;
  columns: ViewDialogColumn[];
  applyColumns: (columns: ViewDialogColumn[]) => void;
  columnLabelByStableField: Map<string, string>;
  savedFilters: SavedFilter[];
  viewLinkedFilterId: string;
  setViewLinkedFilterId: (value: string) => void;
}

export const ViewDialog: FC<ViewDialogProps> = ({
  open,
  onClose,
  translation,
  showToolbarSaveView,
  showToolbarSavedViews,
  viewName,
  setViewName,
  selectedView,
  setSelectedView,
  onLoadView,
  isViewDefault,
  setIsViewDefault,
  viewsManager,
  propertySearch,
  setPropertySearch,
  showVisibleOnly,
  setShowVisibleOnly,
  columns,
  applyColumns,
  columnLabelByStableField,
  savedFilters,
  viewLinkedFilterId,
  setViewLinkedFilterId,
}) => {
  const [draftColumns, setDraftColumns] = useState<ViewDialogDraftColumn[]>([]);
  const [draftSelectedView, setDraftSelectedView] = useState('');
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const [dragOverPlacement, setDragOverPlacement] = useState<'before' | 'after'>('before');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftColumns(
        columns.map((column) => ({
          ...column,
          width: normalizeColumnWidth(column.width),
        })),
      );
      setDraftSelectedView(selectedView);
    }
    wasOpenRef.current = open;
  }, [open, columns, selectedView]);

  const filterIdsWithOptions = new Set(savedFilters.map((f) => savedRecordKey(f)).filter(Boolean));
  const showGhostLinkedOption =
    viewLinkedFilterId !== '' && !filterIdsWithOptions.has(viewLinkedFilterId);

  const filteredColumns = useMemo(() => {
    const rawSearch = propertySearch.trim().toLowerCase();
    const compactSearch = rawSearch.replace(/[_\s]+/g, '');

    return draftColumns.filter((column) => {
      const isVisible = !column.isHidden;
      if (showVisibleOnly && !isVisible) return false;
      if (!rawSearch) return true;

      const displayLabel = columnLabelByStableField.get(column.field) ?? column.field;
      const field = column.field.toLowerCase();
      const label = String(displayLabel).toLowerCase();
      const compactField = field.replace(/[_\s]+/g, '');
      const compactLabel = label.replace(/[_\s]+/g, '');
      return (
        field.includes(rawSearch) ||
        compactField.includes(compactSearch) ||
        label.includes(rawSearch) ||
        compactLabel.includes(compactSearch)
      );
    });
  }, [columnLabelByStableField, draftColumns, propertySearch, showVisibleOnly]);

  const setFilteredColumnsVisible = (visible: boolean) => {
    const visibleFields = new Set(filteredColumns.map((column) => column.field));
    setDraftColumns((prev) =>
      prev.map((column) =>
        visibleFields.has(column.field) ? { ...column, isHidden: !visible } : column,
      ),
    );
  };

  const handleColumnToggle = (field: string) => {
    setDraftColumns((prev) =>
      prev.map((column) =>
        column.field === field ? { ...column, isHidden: !column.isHidden } : column,
      ),
    );
  };

  const handlePinChange = (field: string, value: string) => {
    const pinned = value === 'unpinned' ? null : (value as 'left' | 'right');
    setDraftColumns((prev) =>
      prev.map((column) => (column.field === field ? { ...column, pinned } : column)),
    );
  };

  const handleWidthChange = (field: string, width: string) => {
    const roundedWidth = width === '' ? '' : Math.round(Number(width));
    if (roundedWidth !== '' && !Number.isFinite(roundedWidth)) return;
    setDraftColumns((prev) =>
      prev.map((column) =>
        column.field === field
          ? {
              ...column,
              width: roundedWidth,
              // An explicit pixel width and flex sizing are mutually exclusive.
              flex: roundedWidth === '' ? column.flex : null,
            }
          : column,
      ),
    );
  };

  const finalizedDraftColumns = (): ViewDialogColumn[] =>
    draftColumns.map((column) => {
      const width = normalizeColumnWidth(column.width);
      return {
        ...column,
        width,
        flex: width === null ? column.flex : null,
      };
    });

  const moveDraftColumn = (
    sourceField: string,
    targetField: string,
    placement: 'before' | 'after' = 'before',
  ) => {
    if (sourceField === targetField) return;
    setDragOverField(null);
    setDragOverPlacement('before');
    setDraftColumns((prev) => {
      const sourceIndex = prev.findIndex((column) => column.field === sourceField);
      const targetIndex = prev.findIndex((column) => column.field === targetField);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      let insertionIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
      if (sourceIndex < insertionIndex) insertionIndex -= 1;
      if (sourceIndex === insertionIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(insertionIndex, 0, moved);
      return next;
    });
  };

  const moveDraftColumnToFilteredEnd = (sourceField: string) => {
    const lastVisibleTarget = filteredColumns[filteredColumns.length - 1];
    if (!lastVisibleTarget) return;
    moveDraftColumn(sourceField, lastVisibleTarget.field, 'after');
  };

  const applySavedColumnStateToDraft = (columnState: ViewDialogColumnState[]) => {
    setDraftColumns((prev) => {
      const stateByField = new Map<string, ViewDialogColumnState>();
      columnState.forEach((entry) => {
        if (entry?.colId != null) stateByField.set(String(entry.colId), entry);
      });
      const known = prev.map((column) => {
        const state = stateByField.get(column.field);
        if (!state) return column;
        return {
          ...column,
          isHidden: Boolean(state.hide),
          pinned: state.pinned || null,
          width: normalizeColumnWidth(state.width ?? column.width),
          flex: state.flex ?? column.flex ?? null,
        };
      });
      const byField = new Map(known.map((column) => [column.field, column]));
      const ordered = columnState
        .map((entry) => (entry?.colId != null ? byField.get(String(entry.colId)) : null))
        .filter((column): column is ViewDialogDraftColumn => Boolean(column));
      const orderedFields = new Set(ordered.map((column) => column.field));
      return [...ordered, ...known.filter((column) => !orderedFields.has(column.field))];
    });
  };

  const handleSavedViewDraftSelection = (next: string) => {
    setDraftSelectedView(next);
    setSelectedView(next);
    if (!next) return;
    const record = viewsManager.savedViews.find((view) => savedRecordKey(view) === next);
    if (!record || !Array.isArray(record.columnState)) return;
    applySavedColumnStateToDraft(record.columnState);
  };

  const handleApply = () => {
    if (draftSelectedView) {
      onLoadView(draftSelectedView);
    }
    const finalized = finalizedDraftColumns();
    setDraftColumns(finalized);
    applyColumns(finalized);
    onClose();
  };

  const handleSaveOrUpdateView = () => {
    const trimmed = viewName.trim();
    const linkedOpts = {
      isDefault: isViewDefault,
      linkedFilter:
        viewLinkedFilterId.trim() === '' ? null : (viewLinkedFilterId.trim() as string | number),
    };
    const finalized = finalizedDraftColumns();
    setDraftColumns(finalized);
    applyColumns(finalized);
    if (trimmed) {
      const existing = viewsManager.savedViews.find(
        (v) => v.name === trimmed || v.title === trimmed,
      );
      if (existing) {
        viewsManager.updateView(existing.name, {
          ...linkedOpts,
        });
      } else {
        viewsManager.saveView(trimmed, {
          isDefault: isViewDefault,
          ...(viewLinkedFilterId.trim() !== ''
            ? { linkedFilter: viewLinkedFilterId.trim() as string | number }
            : {}),
        });
      }
    } else if (draftSelectedView) {
      viewsManager.updateView(draftSelectedView, linkedOpts);
    }
    setViewName('');
    if (!draftSelectedView) setIsViewDefault(false);
  };

  const trimmedViewName = viewName.trim();
  const matchingView = trimmedViewName
    ? viewsManager.savedViews.find((v) => v.name === trimmedViewName || v.title === trimmedViewName)
    : null;
  const willUpdateView = Boolean(matchingView) || (!trimmedViewName && !!draftSelectedView);
  const canSaveOrUpdateView = Boolean(trimmedViewName || draftSelectedView);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 rounded-t-xl px-5 py-4">
          <div>
            <h1
              className="tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '16px', fontWeight: 500 }}
            >
              {translation('COLUMN STATE')}
            </h1>
            <span className="mt-1 block text-sm" style={{ color: '#6B7280', fontSize: '16px' }}>
              {translation('Show or hide columns for this grid view')}
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
        <div className="px-5 py-4">
          <div className="sticky top-0 z-10 bg-white pb-3">
            <div className="flex flex-row gap-2 md:flex-row md:items-center">
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
                placeholder={translation('Search field')}
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                style={{
                  height: '31px',
                  borderColor: '#0000001A',
                  borderRadius: '6px',
                }}
              />
              <label
                className="inline-flex items-center gap-2 whitespace-nowrap text-sm"
                style={{ color: '#717182', fontSize: '12px', fontWeight: 500 }}
              >
                <input
                  type="checkbox"
                  checked={showVisibleOnly}
                  onChange={(e) => setShowVisibleOnly(e.target.checked)}
                  style={{
                    height: '12px',
                    width: '12px',
                    backgroundColor: '#2b5797',
                    borderRadius: '4px',
                  }}
                />
                <span>{translation('Visible only')}</span>
              </label>
              <div>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-md border bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    color: '#0A0A0A',
                    height: '31px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  onClick={() => setFilteredColumnsVisible(true)}
                  disabled={filteredColumns.length === 0}
                >
                  {translation('Select all')}
                </button>
              </div>
              <button
                type="button"
                className="flex items-center justify-center rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: '#6B8AD4',
                  color: '#6B8AD4',
                  height: '31px',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
                onClick={() => setFilteredColumnsVisible(false)}
                disabled={filteredColumns.length === 0}
              >
                {translation('Clear all')}
              </button>
            </div>
          </div>
          <div
            className="h-96 space-y-1 overflow-y-auto rounded-lg border p-2"
            style={{
              backgroundColor: '#FAFAFA',
              borderColor: '#D1D5DC',
              borderRadius: '10px',
            }}
          >
            {filteredColumns.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                {translation('No fields match your filter')}.
              </div>
            ) : (
              <>
                {filteredColumns.map((column) => {
                  const isVisible = !column.isHidden;
                  return (
                    <div
                      key={column.field}
                      className="relative flex flex-row items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
                      style={{
                        opacity: draggingField === column.field ? 0.55 : 1,
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (draggingField !== column.field) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const placement =
                            e.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
                          setDragOverField(column.field);
                          setDragOverPlacement(placement);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverField((current) => (current === column.field ? null : current));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceField =
                          draggingField || e.dataTransfer.getData('text/plain') || '';
                        moveDraftColumn(sourceField, column.field, dragOverPlacement);
                        setDraggingField(null);
                        setDragOverField(null);
                        setDragOverPlacement('before');
                      }}
                    >
                      {dragOverField === column.field && draggingField !== column.field ? (
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 right-0 block ${
                            dragOverPlacement === 'after' ? 'bottom-0' : 'top-0'
                          }`}
                          style={{ height: '2px', backgroundColor: '#2b5797' }}
                        />
                      ) : null}
                      <span
                        draggable
                        className="inline-flex shrink-0 cursor-grab items-center justify-center text-slate-400"
                        title={translation('Drag to reorder')}
                        aria-hidden="true"
                        onDragStart={(e) => {
                          setDraggingField(column.field);
                          setDragOverField(null);
                          setDragOverPlacement('before');
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', column.field);
                        }}
                        onDragEnd={() => {
                          setDraggingField(null);
                          setDragOverField(null);
                          setDragOverPlacement('before');
                        }}
                      >
                        <MdDragIndicator size={16} />
                      </span>
                      <label className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => handleColumnToggle(column.field)}
                          style={{
                            height: '12px',
                            width: '12px',
                            backgroundColor: '#2b5797',
                            borderRadius: '4px',
                          }}
                        />
                        <span
                          className={`truncate ${isVisible ? 'text-gray-700' : 'text-slate-400'}`}
                        >
                          {columnLabelByStableField.get(column.field) ?? column.field}
                        </span>
                      </label>
                      <label
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600"
                      >
                        <span>{translation('Width')}</span>
                        <input
                          type="number"
                          min={MIN_COLUMN_WIDTH}
                          step={1}
                          value={column.width ?? ''}
                          className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                          style={{ height: '31px' }}
                          aria-label={`${translation('Width')} ${columnLabelByStableField.get(column.field) ?? column.field}`}
                          onChange={(e) => handleWidthChange(column.field, e.target.value)}
                          onBlur={(e) => {
                            const width = normalizeColumnWidth(e.target.value);
                            handleWidthChange(column.field, width === null ? '' : String(width));
                          }}
                          onDragStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                      </label>
                      <select
                        value={column.pinned || 'unpinned'}
                        className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                        style={{ height: '31px' }}
                        onChange={(e) => handlePinChange(column.field, e.target.value)}
                      >
                        <option value="unpinned">{translation('No pin')}</option>
                        <option value="left">{translation('Pin left')}</option>
                        <option value="right">{translation('Pin right')}</option>
                      </select>
                    </div>
                  );
                })}
                <div
                  className="relative h-4"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggingField !== filteredColumns[filteredColumns.length - 1]?.field) {
                      setDragOverField(END_DROP_TARGET);
                      setDragOverPlacement('after');
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverField((current) => (current === END_DROP_TARGET ? null : current));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceField = draggingField || e.dataTransfer.getData('text/plain') || '';
                    moveDraftColumnToFilteredEnd(sourceField);
                    setDraggingField(null);
                    setDragOverField(null);
                    setDragOverPlacement('before');
                  }}
                >
                  {dragOverField === END_DROP_TARGET &&
                  draggingField !== filteredColumns[filteredColumns.length - 1]?.field ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 right-0 top-0 block"
                      style={{ height: '2px', backgroundColor: '#2b5797' }}
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
        {showToolbarSaveView && (
          <div
            className="view-management px-4 py-3 flex flex-row flex-wrap gap-3"
            style={{ borderTop: '1px solid #E5E7EB' }}
          >
            <div className="view-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
              <span
                className="view-title"
                style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
              >
                {translation('Save view')}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={translation('View name')}
                  className="view-input rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
                  value={viewName}
                  onChange={(e) => {
                    setViewName(e.target.value);
                  }}
                  style={{
                    height: '31px',
                    borderRadius: '6px',
                    borderColor: '#0000001A',
                    color: '#44444C',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                />
                {!showToolbarSavedViews && (
                  <button
                    className="header-button inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleSaveOrUpdateView}
                    disabled={!canSaveOrUpdateView}
                    style={{
                      height: '31px',
                      borderRadius: '6px',
                      borderColor: '#0000001A',
                      color: '#44444C',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {translation(willUpdateView ? 'Update' : 'Save')}
                  </button>
                )}
                <label
                  className="inline-flex items-center gap-1 whitespace-nowrap"
                  style={{
                    color: '#717182',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  title={translation('Set as default')}
                >
                  <input
                    type="checkbox"
                    checked={isViewDefault}
                    onChange={(e) => setIsViewDefault(e.target.checked)}
                  />
                  <span>{translation('Default')}</span>
                </label>
              </div>
            </div>
            {showToolbarSavedViews && (
              <div className="views-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                <span
                  className="views-title"
                  style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
                >
                  {translation('Saved views')}
                </span>
                <div className="flex gap-2">
                  <select
                    value={draftSelectedView}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
                    onChange={(e) => {
                      handleSavedViewDraftSelection(e.target.value);
                    }}
                    style={{
                      height: '31px',
                      borderRadius: '6px',
                      borderColor: '#0000001A',
                      color: '#44444C',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    <option value="">{translation('Select view')}</option>
                    {viewsManager.savedViews.map((savedView) => (
                      <option key={savedRecordKey(savedView)} value={savedRecordKey(savedView)}>
                        {savedView.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="view-input rounded-lg border border-gray-300 px-2 py-1"
                    value={viewLinkedFilterId}
                    onChange={(e) => setViewLinkedFilterId(e.target.value)}
                    style={{
                      height: '31px',
                      borderRadius: '6px',
                      borderColor: '#0000001A',
                      color: '#44444C',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    <option value="">{translation('No linked filter')}</option>
                    {showGhostLinkedOption && (
                      <option value={viewLinkedFilterId}>
                        {translation('Filter')} ({viewLinkedFilterId})
                      </option>
                    )}
                    {savedFilters.map((f) => (
                      <option key={savedRecordKey(f)} value={savedRecordKey(f)}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="header-button-trash inline-flex items-center justify-center rounded-lg border"
                    style={{
                      width: '31px',
                      height: '31px',
                      borderRadius: '8px',
                      color: '#EC7B80',
                      borderColor: '#EC7B80',
                      backgroundColor: '#EC7B8033',
                    }}
                    onClick={() => {
                      if (!draftSelectedView) return;
                      viewsManager.deleteView(draftSelectedView);
                    }}
                  >
                    <GoTrash size={14} />
                  </button>
                  <button
                    className="header-button inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleSaveOrUpdateView}
                    disabled={!canSaveOrUpdateView}
                    style={{
                      height: '31px',
                      borderRadius: '6px',
                      borderColor: '#0000001A',
                      color: '#44444C',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {translation(willUpdateView ? 'Update' : 'Save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
            className="flex items-center justify-center rounded-md border px-3 py-2 text-center text-sm text-white"
            style={{
              background: '#2B5797',
              height: '31px',
              fontSize: '12px',
            }}
            onClick={handleApply}
          >
            {translation('Apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
