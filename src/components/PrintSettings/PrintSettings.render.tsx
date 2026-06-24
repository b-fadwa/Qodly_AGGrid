import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useI18n,
  useLocalization,
  useRenderer,
  useWebformPath,
} from '@ws-ui/webform-editor';
import isEqual from 'lodash/isEqual';
import type { IPrintSettingsProps } from './PrintSettings.config';
import PrintSettingsPanel from './PrintSettingsPanel';
import { extractPrintColumns, normalizePrintFormat } from './PrintSettings.utils';
import type { PrintSettingsColumn } from './PrintSettings.types';
import type { PrintFormatValue, SavedPrintFormat } from './PrintSettings.types';
import { savedPrintFormatKey } from './PrintSettings.types';

function recordsFromValue(value: unknown, columns: PrintSettingsColumn[]): SavedPrintFormat[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, index) => {
      const name = String(item.name ?? item.title ?? item.id ?? `Format ${index + 1}`);
      const rawFormat = item.format ?? item.printFormat ?? item.state ?? item;
      return {
        ...item,
        name,
        format: normalizePrintFormat(rawFormat, columns),
      };
    });
}

const PrintSettingsRender: FC<IPrintSettingsProps> = ({
  state: stateBinding = '',
  format = '',
  formats = '',
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
      'onvalidate',
      'oncancel',
      'onsaveformat',
      'onupdateformat',
      'ondeleteformat',
    ],
  });
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const path = useWebformPath();
  const stateDs = useMemo(
    () => (stateBinding ? window.DataSource.getSource(stateBinding, path) : null),
    [stateBinding, path],
  );
  const formatDs = useMemo(
    () => (format ? window.DataSource.getSource(format, path) : null),
    [format, path],
  );
  const formatsDs = useMemo(
    () => (formats ? window.DataSource.getSource(formats, path) : null),
    [formats, path],
  );
  const [columns, setColumns] = useState<PrintSettingsColumn[]>([]);
  const [value, setValue] = useState<PrintFormatValue>(() => normalizePrintFormat(null, []));
  const [savedFormats, setSavedFormats] = useState<SavedPrintFormat[]>([]);
  const valueRef = useRef(value);
  const savedFormatsRef = useRef(savedFormats);
  const initialLoadEmittedRef = useRef(false);
  const bootstrapKeyRef = useRef('');
  const bootstrapGenerationRef = useRef(0);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  valueRef.current = value;
  savedFormatsRef.current = savedFormats;

  const commitColumns = useCallback((next: PrintSettingsColumn[]) => {
    columnsRef.current = next;
    setColumns((current) => (isEqual(current, next) ? current : next));
  }, []);

  const commitValue = useCallback((next: PrintFormatValue) => {
    valueRef.current = next;
    setValue((current) => (isEqual(current, next) ? current : next));
  }, []);

  const commitSavedFormats = useCallback((next: SavedPrintFormat[]) => {
    savedFormatsRef.current = next;
    setSavedFormats((current) => (isEqual(current, next) ? current : next));
  }, []);

  const readState = useCallback(async (): Promise<PrintSettingsColumn[]> => {
    if (!stateDs) {
      commitColumns([]);
      return [];
    }
    try {
      const discovered = extractPrintColumns(await stateDs.getValue());
      commitColumns(discovered);
      return discovered;
    } catch {
      commitColumns([]);
      return [];
    }
  }, [stateDs, commitColumns]);

  const readFormat = useCallback(async (discoveredColumns = columnsRef.current) => {
    if (!formatDs) {
      const normalized = normalizePrintFormat(valueRef.current, discoveredColumns);
      commitValue(normalized);
      return normalized;
    }
    try {
      const incoming = await formatDs.getValue();
      const normalized = normalizePrintFormat(incoming, discoveredColumns);
      commitValue(normalized);
      return normalized;
    } catch {
      const normalized = normalizePrintFormat(null, discoveredColumns);
      commitValue(normalized);
      return normalized;
    }
  }, [formatDs, commitValue]);

  const readFormats = useCallback(async (discoveredColumns = columnsRef.current) => {
    if (!formatsDs) {
      commitSavedFormats([]);
      return [];
    }
    try {
      const records = recordsFromValue(await formatsDs.getValue(), discoveredColumns);
      commitSavedFormats(records);
      return records;
    } catch {
      commitSavedFormats([]);
      return [];
    }
  }, [formatsDs, commitSavedFormats]);

  const bootstrapKey = `${String(path)}\u001f${stateBinding}\u001f${format}\u001f${formats}`;

  useEffect(() => {
    if (bootstrapKeyRef.current === bootstrapKey) return;
    bootstrapKeyRef.current = bootstrapKey;
    initialLoadEmittedRef.current = false;
    const generation = ++bootstrapGenerationRef.current;
    const load = async () => {
      const discoveredColumns = await readState();
      const [loadedFormat, loadedFormats] = await Promise.all([
        readFormat(discoveredColumns),
        readFormats(discoveredColumns),
      ]);
      if (generation === bootstrapGenerationRef.current && !initialLoadEmittedRef.current) {
        initialLoadEmittedRef.current = true;
        emit('onload', {
          reason: 'initial',
          columns: discoveredColumns,
          format: loadedFormat,
          formats: loadedFormats,
        });
      }
    };
    void load();
  }, [bootstrapKey, readState, readFormat, readFormats, emit]);

  useEffect(() => {
    if (!stateDs) return;
    const listener = async () => {
      const discoveredColumns = await readState();
      await Promise.all([readFormat(discoveredColumns), readFormats(discoveredColumns)]);
    };
    stateDs.addListener('changed', listener);
    return () => stateDs.removeListener('changed', listener);
  }, [stateDs, readState, readFormat, readFormats]);

  useEffect(() => {
    if (!formatDs) return;
    const listener = () => { void readFormat(); };
    formatDs.addListener('changed', listener);
    return () => formatDs.removeListener('changed', listener);
  }, [formatDs, readFormat]);

  useEffect(() => {
    if (!formatsDs) return;
    const listener = () => { void readFormats(); };
    formatsDs.addListener('changed', listener);
    return () => formatsDs.removeListener('changed', listener);
  }, [formatsDs, readFormats]);

  const persistFormat = useCallback((next: PrintFormatValue) => {
    commitValue(next);
    if (formatDs) formatDs.setValue(null, next);
  }, [formatDs, commitValue]);

  const persistFormats = useCallback((next: SavedPrintFormat[]) => {
    commitSavedFormats(next);
    if (formatsDs) formatsDs.setValue(null, next);
  }, [formatsDs, commitSavedFormats]);

  const loadSavedFormat = useCallback((record: SavedPrintFormat) => {
    const next = normalizePrintFormat(record.format, columnsRef.current);
    persistFormat(next);
    emit('onload', {
      reason: 'format',
      selectedFormat: savedPrintFormatKey(record),
      format: next,
      savedFormat: record,
    });
  }, [emit, persistFormat]);

  const saveFormat = useCallback((name: string, isDefault: boolean) => {
    const record: SavedPrintFormat = { name, isDefault, format: valueRef.current };
    const base = isDefault
      ? savedFormatsRef.current.map((item) => ({ ...item, isDefault: false }))
      : savedFormatsRef.current;
    const next = [...base, record];
    persistFormats(next);
    emit('onsaveformat', {
      name,
      isDefault,
      columns: columnsRef.current,
      format: valueRef.current,
      savedFormat: record,
    });
  }, [emit, persistFormats]);

  const updateFormat = useCallback((key: string, isDefault: boolean) => {
    let updatedRecord: SavedPrintFormat | undefined;
    const next = savedFormatsRef.current.map((record) => {
      if (savedPrintFormatKey(record) === key || record.name === key || record.title === key) {
        updatedRecord = { ...record, isDefault, format: valueRef.current };
        return updatedRecord;
      }
      return isDefault && record.isDefault ? { ...record, isDefault: false } : record;
    });
    persistFormats(next);
    emit('onupdateformat', {
      selectedFormat: key,
      isDefault,
      columns: columnsRef.current,
      format: valueRef.current,
      savedFormat: updatedRecord,
    });
  }, [emit, persistFormats]);

  const deleteFormat = useCallback((key: string) => {
    const record = savedFormatsRef.current.find((item) => savedPrintFormatKey(item) === key);
    emit('ondeleteformat', { selectedFormat: key, savedFormat: record });
  }, [emit]);

  return (
    <div ref={connect} style={style} className={[className, ...classNames].filter(Boolean).join(' ')}>
      <PrintSettingsPanel
        columns={columns}
        value={value}
        formats={savedFormats}
        accentColor={accentColor}
        disabled={disabled}
        i18n={i18n}
        lang={lang}
        style={{ height: '100%' }}
        onChange={persistFormat}
        onLoadFormat={loadSavedFormat}
        onSaveFormat={saveFormat}
        onUpdateFormat={updateFormat}
        onDeleteFormat={deleteFormat}
        onValidate={() => emit('onvalidate', { columns: columnsRef.current, format: valueRef.current })}
        onCancel={() => emit('oncancel', { columns: columnsRef.current, format: valueRef.current })}
      />
    </div>
  );
};

export default PrintSettingsRender;
