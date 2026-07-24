import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useLocalization, useRenderer, useWebformPath } from '@ws-ui/webform-editor';
import isEqual from 'lodash/isEqual';
import type { ISequenceProgrammingProps } from './SequenceProgramming.config';
import SequenceProgrammingPanel from './SequenceProgrammingPanel';
import {
  emptySequence,
  savedRecordKey,
  savedRecordsFromDatasourceValue,
  sequenceFromRecord,
  sequencePayloadFromRecord,
  sequenceRecordMatches,
} from './SequenceProgramming.types';
import type {
  SavedExportFormat,
  SavedFilter,
  SavedPrintFormat,
  SavedSequence,
  SavedSort,
  SavedView,
  SequenceProgrammingPayload,
  SequenceTranspositionOption,
  SequenceTranspositionsValue,
} from './SequenceProgramming.types';

/** Fills in any missing output/transposition fields with defaults, regardless of how partial `candidate` is. */
function normalizeSequenceValue(candidate: unknown): SequenceProgrammingPayload {
  if (!candidate || typeof candidate !== 'object') return emptySequence();
  return sequenceFromRecord({ name: '', sequence: candidate as SequenceProgrammingPayload });
}

const SequenceProgrammingRender: FC<ISequenceProgrammingProps> = ({
  views: viewsBinding = '',
  filters: filtersBinding = '',
  sorts: sortsBinding = '',
  sequence: sequenceBinding = '',
  sequences: sequencesBinding = '',
  transpositions: transpositionsBinding = '',
  exportFormats: exportFormatsBinding = '',
  printFormats: printFormatsBinding = '',
  predefinedDocuments: predefinedDocumentsBinding = '',
  chainedSequences: chainedSequencesBinding = '',
  colorPrimary,
  colorDanger,
  colorAccent,
  colorDangerWash,
  disabled = false,
  style,
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [
      'onload',
      'oncancel',
      'onsequence',
      'onloadsequence',
      'onsavesequence',
      'onupdatesequence',
      'ondeletesequence',
      'onautomatisationtraitement',
      'onshare',
      'ontranspositionselect',
    ],
  });
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const path = useWebformPath();

  const viewsDs = useMemo(
    () => (viewsBinding ? window.DataSource.getSource(viewsBinding, path) : null),
    [viewsBinding, path],
  );
  const filtersDs = useMemo(
    () => (filtersBinding ? window.DataSource.getSource(filtersBinding, path) : null),
    [filtersBinding, path],
  );
  const sortsDs = useMemo(
    () => (sortsBinding ? window.DataSource.getSource(sortsBinding, path) : null),
    [sortsBinding, path],
  );
  const sequenceDs = useMemo(
    () => (sequenceBinding ? window.DataSource.getSource(sequenceBinding, path) : null),
    [sequenceBinding, path],
  );
  const sequencesDs = useMemo(
    () => (sequencesBinding ? window.DataSource.getSource(sequencesBinding, path) : null),
    [sequencesBinding, path],
  );
  const transpositionsDs = useMemo(
    () => (transpositionsBinding ? window.DataSource.getSource(transpositionsBinding, path) : null),
    [transpositionsBinding, path],
  );
  const exportFormatsDs = useMemo(
    () => (exportFormatsBinding ? window.DataSource.getSource(exportFormatsBinding, path) : null),
    [exportFormatsBinding, path],
  );
  const printFormatsDs = useMemo(
    () => (printFormatsBinding ? window.DataSource.getSource(printFormatsBinding, path) : null),
    [printFormatsBinding, path],
  );
  const predefinedDocumentsDs = useMemo(
    () =>
      predefinedDocumentsBinding
        ? window.DataSource.getSource(predefinedDocumentsBinding, path)
        : null,
    [predefinedDocumentsBinding, path],
  );
  const chainedSequencesDs = useMemo(
    () =>
      chainedSequencesBinding ? window.DataSource.getSource(chainedSequencesBinding, path) : null,
    [chainedSequencesBinding, path],
  );

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savedSorts, setSavedSorts] = useState<SavedSort[]>([]);
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);
  const [transpositions, setTranspositions] = useState<SequenceTranspositionsValue | null>(null);
  const [exportFormats, setExportFormats] = useState<SavedExportFormat[]>([]);
  const [printFormats, setPrintFormats] = useState<SavedPrintFormat[]>([]);
  const [predefinedDocuments, setPredefinedDocuments] = useState<SequenceTranspositionOption[]>([]);
  const [chainedSequences, setChainedSequences] = useState<SavedSequence[]>([]);
  const [value, setValue] = useState<SequenceProgrammingPayload>(() => emptySequence());
  const savedSequencesRef = useRef(savedSequences);
  const valueRef = useRef(value);
  const initialLoadEmittedRef = useRef(false);
  const bootstrapKeyRef = useRef('');
  savedSequencesRef.current = savedSequences;
  valueRef.current = value;

  const readList = useCallback(
    async <T extends { name: string }>(
      ds: ReturnType<typeof window.DataSource.getSource> | null,
      setter: (next: T[]) => void,
    ) => {
      if (!ds) {
        setter([]);
        return [] as T[];
      }
      try {
        const next = savedRecordsFromDatasourceValue<T>(await ds.getValue());
        setter(next);
        return next;
      } catch {
        setter([]);
        return [] as T[];
      }
    },
    [],
  );

  const readSequences = useCallback(async () => {
    if (!sequencesDs) {
      setSavedSequences([]);
      return [] as SavedSequence[];
    }
    try {
      const value = await sequencesDs.getValue();
      const next = savedRecordsFromDatasourceValue<SavedSequence>(value)
        .map((record) => ({ ...record, sequence: sequencePayloadFromRecord(record) }))
        .filter((record): record is SavedSequence => Boolean(record.sequence));
      setSavedSequences(next);
      return next;
    } catch {
      setSavedSequences([]);
      return [] as SavedSequence[];
    }
  }, [sequencesDs]);

  const readChainedSequences = useCallback(async () => {
    if (!chainedSequencesDs) {
      setChainedSequences([]);
      return [] as SavedSequence[];
    }
    try {
      const value = await chainedSequencesDs.getValue();
      const next = savedRecordsFromDatasourceValue<SavedSequence>(value)
        .map((record) => ({ ...record, sequence: sequencePayloadFromRecord(record) }))
        .filter((record): record is SavedSequence => Boolean(record.sequence));
      setChainedSequences(next);
      return next;
    } catch {
      setChainedSequences([]);
      return [] as SavedSequence[];
    }
  }, [chainedSequencesDs]);

  const readTranspositions = useCallback(async () => {
    if (!transpositionsDs) {
      setTranspositions(null);
      return null;
    }
    try {
      const next = (await transpositionsDs.getValue()) as SequenceTranspositionsValue;
      setTranspositions(next && typeof next === 'object' ? next : null);
      return next ?? null;
    } catch {
      setTranspositions(null);
      return null;
    }
  }, [transpositionsDs]);

  const readPredefinedDocuments = useCallback(async () => {
    if (!predefinedDocumentsDs) {
      setPredefinedDocuments([]);
      return [] as SequenceTranspositionOption[];
    }
    try {
      const value = await predefinedDocumentsDs.getValue();
      const next = Array.isArray(value) ? (value as SequenceTranspositionOption[]) : [];
      setPredefinedDocuments(next);
      return next;
    } catch {
      setPredefinedDocuments([]);
      return [] as SequenceTranspositionOption[];
    }
  }, [predefinedDocumentsDs]);

  const readInitialSequence = useCallback(async () => {
    if (!sequenceDs) return;
    try {
      const raw = await sequenceDs.getValue();
      const normalized = normalizeSequenceValue(raw);
      setValue((current) => (isEqual(current, normalized) ? current : normalized));
    } catch {
      // keep the current draft if the datasource can't be read
    }
  }, [sequenceDs]);

  const bootstrapKey = `${String(path)}${viewsBinding}${filtersBinding}${sortsBinding}${sequenceBinding}${sequencesBinding}${transpositionsBinding}${exportFormatsBinding}${printFormatsBinding}${predefinedDocumentsBinding}${chainedSequencesBinding}`;

  useEffect(() => {
    if (bootstrapKeyRef.current === bootstrapKey) return;
    bootstrapKeyRef.current = bootstrapKey;
    initialLoadEmittedRef.current = false;
    const load = async () => {
      const [views, filters, sorts, sequences, exportFormatsValue, printFormatsValue] =
        await Promise.all([
          readList<SavedView>(viewsDs, setSavedViews),
          readList<SavedFilter>(filtersDs, setSavedFilters),
          readList<SavedSort>(sortsDs, setSavedSorts),
          readSequences(),
          readList<SavedExportFormat>(exportFormatsDs, setExportFormats),
          readList<SavedPrintFormat>(printFormatsDs, setPrintFormats),
        ]);
      const transpositionsValue = await readTranspositions();
      const predefinedDocumentsValue = await readPredefinedDocuments();
      const chainedSequencesValue = await readChainedSequences();
      await readInitialSequence();
      if (!initialLoadEmittedRef.current) {
        initialLoadEmittedRef.current = true;
        emit('onload', {
          views,
          filters,
          sorts,
          sequences,
          transpositions: transpositionsValue,
          exportFormats: exportFormatsValue,
          printFormats: printFormatsValue,
          predefinedDocuments: predefinedDocumentsValue,
          chainedSequences: chainedSequencesValue,
        });
      }
    };
    void load();
  }, [
    bootstrapKey,
    viewsDs,
    filtersDs,
    sortsDs,
    exportFormatsDs,
    printFormatsDs,
    readList,
    readSequences,
    readTranspositions,
    readPredefinedDocuments,
    readChainedSequences,
    readInitialSequence,
    emit,
  ]);

  useEffect(() => {
    if (!viewsDs) return;
    const listener = () => void readList<SavedView>(viewsDs, setSavedViews);
    viewsDs.addListener('changed', listener);
    return () => viewsDs.removeListener('changed', listener);
  }, [viewsDs, readList]);

  useEffect(() => {
    if (!filtersDs) return;
    const listener = () => void readList<SavedFilter>(filtersDs, setSavedFilters);
    filtersDs.addListener('changed', listener);
    return () => filtersDs.removeListener('changed', listener);
  }, [filtersDs, readList]);

  useEffect(() => {
    if (!sortsDs) return;
    const listener = () => void readList<SavedSort>(sortsDs, setSavedSorts);
    sortsDs.addListener('changed', listener);
    return () => sortsDs.removeListener('changed', listener);
  }, [sortsDs, readList]);

  useEffect(() => {
    if (!sequencesDs) return;
    const listener = () => void readSequences();
    sequencesDs.addListener('changed', listener);
    return () => sequencesDs.removeListener('changed', listener);
  }, [sequencesDs, readSequences]);

  useEffect(() => {
    if (!transpositionsDs) return;
    const listener = () => void readTranspositions();
    transpositionsDs.addListener('changed', listener);
    return () => transpositionsDs.removeListener('changed', listener);
  }, [transpositionsDs, readTranspositions]);

  useEffect(() => {
    if (!exportFormatsDs) return;
    const listener = () => void readList<SavedExportFormat>(exportFormatsDs, setExportFormats);
    exportFormatsDs.addListener('changed', listener);
    return () => exportFormatsDs.removeListener('changed', listener);
  }, [exportFormatsDs, readList]);

  useEffect(() => {
    if (!printFormatsDs) return;
    const listener = () => void readList<SavedPrintFormat>(printFormatsDs, setPrintFormats);
    printFormatsDs.addListener('changed', listener);
    return () => printFormatsDs.removeListener('changed', listener);
  }, [printFormatsDs, readList]);

  useEffect(() => {
    if (!predefinedDocumentsDs) return;
    const listener = () => void readPredefinedDocuments();
    predefinedDocumentsDs.addListener('changed', listener);
    return () => predefinedDocumentsDs.removeListener('changed', listener);
  }, [predefinedDocumentsDs, readPredefinedDocuments]);

  useEffect(() => {
    if (!chainedSequencesDs) return;
    const listener = () => void readChainedSequences();
    chainedSequencesDs.addListener('changed', listener);
    return () => chainedSequencesDs.removeListener('changed', listener);
  }, [chainedSequencesDs, readChainedSequences]);

  const persistSequences = useCallback(
    (next: SavedSequence[]) => {
      setSavedSequences(next);
      if (sequencesDs) sequencesDs.setValue(null, next);
    },
    [sequencesDs],
  );

  const persistSequence = useCallback(
    (next: SequenceProgrammingPayload) => {
      setValue(next);
      if (sequenceDs) sequenceDs.setValue(null, next);
    },
    [sequenceDs],
  );

  const saveSequence = useCallback(
    (name: string, sequence: SequenceProgrammingPayload) => {
      const record: SavedSequence = { name, sequence };
      persistSequences([...savedSequencesRef.current, record]);
      emit('onsavesequence', { name, sequence });
    },
    [emit, persistSequences],
  );

  const updateSequence = useCallback(
    (key: string, sequence: SequenceProgrammingPayload) => {
      let updatedRecord: SavedSequence | undefined;
      const next = savedSequencesRef.current.map((record) => {
        if (sequenceRecordMatches(record, key)) {
          updatedRecord = { ...record, sequence };
          return updatedRecord;
        }
        return record;
      });
      persistSequences(next);
      emit('onupdatesequence', { selectedSequence: key, sequence, record: updatedRecord });
    },
    [emit, persistSequences],
  );

  const deleteSequence = useCallback(
    (record: SavedSequence) => {
      const key = savedRecordKey(record);
      persistSequences(savedSequencesRef.current.filter((item) => !sequenceRecordMatches(item, key)));
      emit('ondeletesequence', { selectedSequence: key, sequence: record });
    },
    [emit, persistSequences],
  );

  const loadSequence = useCallback(
    (record: SavedSequence) => {
      const next = normalizeSequenceValue(record.sequence);
      persistSequence(next);
      emit('onloadsequence', { key: savedRecordKey(record), sequence: next });
    },
    [emit, persistSequence],
  );

  const applySequence = useCallback(
    (next: SequenceProgrammingPayload) => {
      persistSequence(next);
      emit('onsequence', next);
    },
    [emit, persistSequence],
  );

  const automatisationTraitement = useCallback(() => {
    emit('onautomatisationtraitement', { sequence: valueRef.current });
  }, [emit]);

  const shareSequence = useCallback(
    (record: SavedSequence) => {
      emit('onshare', { selectedSequence: savedRecordKey(record), sequence: record });
    },
    [emit],
  );

  const transpositionSelect = useCallback(
    (option: SequenceTranspositionOption, mode: 'oneToN' | 'nTo1') => {
      emit('ontranspositionselect', { mode, option });
    },
    [emit],
  );

  return (
    <div ref={connect} style={style} className={[className, ...classNames].filter(Boolean).join(' ')}>
      <SequenceProgrammingPanel
        savedViews={savedViews}
        savedFilters={savedFilters}
        savedSorts={savedSorts}
        savedSequences={savedSequences}
        transpositions={transpositions}
        exportFormats={exportFormats}
        printFormats={printFormats}
        predefinedDocuments={predefinedDocuments}
        chainedSequences={chainedSequences}
        value={value}
        colorPrimary={colorPrimary}
        colorDanger={colorDanger}
        colorAccent={colorAccent}
        colorDangerWash={colorDangerWash}
        disabled={disabled}
        i18n={i18n}
        lang={lang}
        style={{ height: '100%' }}
        onChange={setValue}
        onSaveSequence={saveSequence}
        onUpdateSequence={updateSequence}
        onDeleteSequence={deleteSequence}
        onLoadSequence={loadSequence}
        onApply={applySequence}
        onAutomatisationTraitement={automatisationTraitement}
        onShare={shareSequence}
        onTranspositionSelect={transpositionSelect}
        onCancel={() => emit('oncancel', { sequence: valueRef.current })}
      />
    </div>
  );
};

export default SequenceProgrammingRender;
