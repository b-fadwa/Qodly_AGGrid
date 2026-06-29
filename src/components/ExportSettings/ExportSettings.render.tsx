import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useI18n,
  useLocalization,
  useRenderer,
  useWebformPath,
} from '@ws-ui/webform-editor';
import isEqual from 'lodash/isEqual';
import type { IExportSettingsProps } from './ExportSettings.config';
import ExportSettingsPanel from './ExportSettingsPanel';
import { extractExportColumns, buildExportEventPayload, normalizeExportFormat } from './ExportSettings.utils';
import type { ExportSettingsColumn } from './ExportSettings.types';
import type { ExportFormatValue, SavedExportFormat } from './ExportSettings.types';
import { savedExportFormatKey } from './ExportSettings.types';

function recordsFromValue(value: unknown, columns: ExportSettingsColumn[]): SavedExportFormat[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => {
      const name = String(item.name ?? item.title ?? item.id ?? `Export ${index + 1}`);
      const rawFormat = item.format ?? item.exportFormat ?? item.state ?? item;
      return {
        ...item,
        name,
        format: normalizeExportFormat(rawFormat, columns),
      };
    });
}

const ExportSettingsRender: FC<IExportSettingsProps> = ({
  state: stateBinding = '',
  export: exportBinding = '',
  exports: exportsBinding = '',
  accentColor,
  disabled = false,
  style,
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [
      'onload',
      'onhelp',
      'onvalidate',
      'oncancel',
      'onsaveexport',
      'onupdateexport',
      'ondeleteexport',
    ],
  });
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const path = useWebformPath();
  const stateDs = useMemo(
    () => (stateBinding ? window.DataSource.getSource(stateBinding, path) : null),
    [stateBinding, path],
  );
  const exportDs = useMemo(
    () => (exportBinding ? window.DataSource.getSource(exportBinding, path) : null),
    [exportBinding, path],
  );
  const exportsDs = useMemo(
    () => (exportsBinding ? window.DataSource.getSource(exportsBinding, path) : null),
    [exportsBinding, path],
  );
  const [columns, setColumns] = useState<ExportSettingsColumn[]>([]);
  const [value, setValue] = useState<ExportFormatValue>(() => normalizeExportFormat(null, []));
  const [savedExports, setSavedExports] = useState<SavedExportFormat[]>([]);
  const valueRef = useRef(value);
  const savedExportsRef = useRef(savedExports);
  const initialLoadEmittedRef = useRef(false);
  const bootstrapKeyRef = useRef('');
  const bootstrapGenerationRef = useRef(0);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  valueRef.current = value;
  savedExportsRef.current = savedExports;

  const commitColumns = useCallback((next: ExportSettingsColumn[]) => {
    columnsRef.current = next;
    setColumns((current) => (isEqual(current, next) ? current : next));
  }, []);

  const commitValue = useCallback((next: ExportFormatValue) => {
    valueRef.current = next;
    setValue((current) => (isEqual(current, next) ? current : next));
  }, []);

  const commitSavedExports = useCallback((next: SavedExportFormat[]) => {
    savedExportsRef.current = next;
    setSavedExports((current) => (isEqual(current, next) ? current : next));
  }, []);

  const readState = useCallback(async (): Promise<ExportSettingsColumn[]> => {
    if (!stateDs) {
      commitColumns([]);
      return [];
    }
    try {
      const discovered = extractExportColumns(await stateDs.getValue());
      commitColumns(discovered);
      return discovered;
    } catch {
      commitColumns([]);
      return [];
    }
  }, [stateDs, commitColumns]);

  const readExport = useCallback(async (discoveredColumns = columnsRef.current) => {
    if (!exportDs) {
      const normalized = normalizeExportFormat(valueRef.current, discoveredColumns);
      commitValue(normalized);
      return normalized;
    }
    try {
      const incoming = await exportDs.getValue();
      const normalized = normalizeExportFormat(incoming, discoveredColumns);
      commitValue(normalized);
      return normalized;
    } catch {
      const normalized = normalizeExportFormat(null, discoveredColumns);
      commitValue(normalized);
      return normalized;
    }
  }, [exportDs, commitValue]);

  const readExports = useCallback(async (discoveredColumns = columnsRef.current) => {
    if (!exportsDs) {
      commitSavedExports([]);
      return [];
    }
    try {
      const records = recordsFromValue(await exportsDs.getValue(), discoveredColumns);
      commitSavedExports(records);
      return records;
    } catch {
      commitSavedExports([]);
      return [];
    }
  }, [exportsDs, commitSavedExports]);

  const bootstrapKey = `${String(path)}\u001f${stateBinding}\u001f${exportBinding}\u001f${exportsBinding}`;

  useEffect(() => {
    if (bootstrapKeyRef.current === bootstrapKey) return;
    bootstrapKeyRef.current = bootstrapKey;
    initialLoadEmittedRef.current = false;
    const generation = ++bootstrapGenerationRef.current;
    const load = async () => {
      const discoveredColumns = await readState();
      const [loadedExport, loadedExports] = await Promise.all([
        readExport(discoveredColumns),
        readExports(discoveredColumns),
      ]);
      if (generation === bootstrapGenerationRef.current && !initialLoadEmittedRef.current) {
        initialLoadEmittedRef.current = true;
        emit('onload', {
          reason: 'initial',
          columns: discoveredColumns,
          export: loadedExport,
          exports: loadedExports,
        });
      }
    };
    void load();
  }, [bootstrapKey, readState, readExport, readExports, emit]);

  useEffect(() => {
    if (!stateDs) return;
    const listener = async () => {
      const discoveredColumns = await readState();
      await Promise.all([readExport(discoveredColumns), readExports(discoveredColumns)]);
    };
    stateDs.addListener('changed', listener);
    return () => stateDs.removeListener('changed', listener);
  }, [stateDs, readState, readExport, readExports]);

  useEffect(() => {
    if (!exportDs) return;
    const listener = () => { void readExport(); };
    exportDs.addListener('changed', listener);
    return () => exportDs.removeListener('changed', listener);
  }, [exportDs, readExport]);

  useEffect(() => {
    if (!exportsDs) return;
    const listener = () => { void readExports(); };
    exportsDs.addListener('changed', listener);
    return () => exportsDs.removeListener('changed', listener);
  }, [exportsDs, readExports]);

  const persistExport = useCallback((next: ExportFormatValue) => {
    commitValue(next);
    if (exportDs) exportDs.setValue(null, next);
  }, [exportDs, commitValue]);

  const persistExports = useCallback((next: SavedExportFormat[]) => {
    commitSavedExports(next);
    if (exportsDs) exportsDs.setValue(null, next);
  }, [exportsDs, commitSavedExports]);

  const loadSavedExport = useCallback((record: SavedExportFormat) => {
    const next = normalizeExportFormat(record.format, columnsRef.current);
    persistExport(next);
    emit('onload', {
      reason: 'export',
      selectedExport: savedExportFormatKey(record),
      export: next,
      savedExport: record,
    });
  }, [emit, persistExport]);

  const saveExport = useCallback((name: string, isDefault: boolean) => {
    const record: SavedExportFormat = { name, isDefault, format: valueRef.current };
    const base = isDefault
      ? savedExportsRef.current.map((item) => ({ ...item, isDefault: false }))
      : savedExportsRef.current;
    const next = [...base, record];
    persistExports(next);
    emit('onsaveexport', {
      name,
      isDefault,
      columns: columnsRef.current,
      export: valueRef.current,
      savedExport: record,
    });
  }, [emit, persistExports]);

  const updateExport = useCallback((key: string, isDefault: boolean) => {
    let updatedRecord: SavedExportFormat | undefined;
    const next = savedExportsRef.current.map((record) => {
      if (savedExportFormatKey(record) === key || record.name === key || record.title === key) {
        updatedRecord = { ...record, isDefault, format: valueRef.current };
        return updatedRecord;
      }
      return isDefault && record.isDefault ? { ...record, isDefault: false } : record;
    });
    persistExports(next);
    emit('onupdateexport', {
      selectedExport: key,
      isDefault,
      columns: columnsRef.current,
      export: valueRef.current,
      savedExport: updatedRecord,
    });
  }, [emit, persistExports]);

  const deleteExport = useCallback((key: string) => {
    const record = savedExportsRef.current.find((item) => savedExportFormatKey(item) === key);
    emit('ondeleteexport', { selectedExport: key, savedExport: record });
  }, [emit]);

  return (
    <div ref={connect} style={style} className={[className, ...classNames].filter(Boolean).join(' ')}>
      <ExportSettingsPanel
        columns={columns}
        value={value}
        exports={savedExports}
        accentColor={accentColor}
        disabled={disabled}
        i18n={i18n}
        lang={lang}
        style={{ height: '100%' }}
        onChange={persistExport}
        onLoadExport={loadSavedExport}
        onSaveExport={saveExport}
        onUpdateExport={updateExport}
        onDeleteExport={deleteExport}
        onHelp={() => emit('onhelp', { columns: columnsRef.current, export: valueRef.current })}
        onValidate={() =>
          emit('onvalidate', {
            columns: columnsRef.current,
            export: buildExportEventPayload(
              columnsRef.current,
              valueRef.current,
              i18n,
              lang,
            ),
          })
        }
        onCancel={() => emit('oncancel', { columns: columnsRef.current, export: valueRef.current })}
      />
    </div>
  );
};

export default ExportSettingsRender;
