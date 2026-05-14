import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import type { ViewsManager } from '../state/views';
import type { SavedFilter } from '../state/types';
import type { Translation } from '../state/sorts';
import { savedRecordKey } from '../state/gridState';

interface ViewDialogColumn {
  field: string;
  isHidden: boolean;
  pinned: 'left' | 'right' | null;
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
  const [draftColumns, setDraftColumns] = useState<ViewDialogColumn[]>([]);
  const [draftSelectedView, setDraftSelectedView] = useState('');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftColumns(columns.map((column) => ({ ...column })));
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

    return [...draftColumns]
      .sort((a, b) => {
        const aVisible = !a.isHidden;
        const bVisible = !b.isHidden;
        if (aVisible !== bVisible) return aVisible ? -1 : 1;
        const aLabel = String(columnLabelByStableField.get(a.field) ?? a.field);
        const bLabel = String(columnLabelByStableField.get(b.field) ?? b.field);
        const labelCompare = aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
        if (labelCompare !== 0) return labelCompare;
        return a.field.localeCompare(b.field);
      })
      .filter((column) => {
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

  const handleSavedViewDraftSelection = (next: string) => {
    setDraftSelectedView(next);
    setSelectedView(next);
    if (!next) return;
    const record = viewsManager.savedViews.find((view) => savedRecordKey(view) === next);
    if (!record || !Array.isArray(record.columnState)) return;
    setDraftColumns((prev) =>
      prev.map((column) => {
        const state = record.columnState.find((entry: any) => entry?.colId === column.field);
        if (!state) return column;
        return {
          ...column,
          isHidden: Boolean(state.hide),
          pinned: state.pinned || null,
          width: state.width ?? (column as any).width ?? null,
          flex: state.flex ?? (column as any).flex ?? null,
        };
      }),
    );
  };

  const handleApply = () => {
    if (draftSelectedView) {
      onLoadView(draftSelectedView);
    }
    applyColumns(draftColumns);
    onClose();
  };

  const handleSaveOrUpdateView = () => {
    const trimmed = viewName.trim();
    const linkedOpts = {
      isDefault: isViewDefault,
      linkedFilter:
        viewLinkedFilterId.trim() === '' ? null : (viewLinkedFilterId.trim() as string | number),
    };
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
              filteredColumns.map((column) => {
                const isVisible = !column.isHidden;
                return (
                  <div
                    key={column.field}
                    className="flex flex-row items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
                  >
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
              })
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
                  onChange={(e: any) => {
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
                    onChange={(e: any) => {
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
