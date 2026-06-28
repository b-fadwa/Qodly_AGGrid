import { FC, useEffect, useMemo, useState } from 'react';
import { useEnhancedNode, useI18n, useLocalization } from '@ws-ui/webform-editor';
import type { IExportSettingsProps } from './ExportSettings.config';
import ExportSettingsPanel from './ExportSettingsPanel';
import { extractExportColumns, normalizeExportFormat } from './ExportSettings.utils';
import type { ExportFormatValue, SavedExportFormat } from './ExportSettings.types';

const ExportSettingsBuild: FC<IExportSettingsProps> = ({
  state,
  accentColor,
  disabled,
  style,
  className,
  classNames = [],
}) => {
  const { connectors: { connect } } = useEnhancedNode();
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const columns = useMemo(
    () => state
      ? extractExportColumns({
          period: { dateStart: '!!2026-04-01!!', dateEnd: '!!2026-04-04!!' },
          totals: { timeLogged: 702.5, timeBilled: 454, timePresent: 1003 },
          metrics: [{ id: 'utilisation', percent: 70, numerator: 702.5 }],
        })
      : [],
    [state],
  );
  const [value, setValue] = useState<ExportFormatValue>(() => normalizeExportFormat(null, columns));
  const [exports, setExports] = useState<SavedExportFormat[]>([]);

  useEffect(() => {
    setValue((current) => normalizeExportFormat(current, columns));
  }, [columns]);

  const save = (name: string, isDefault: boolean) => {
    setExports((current) => [
      ...(isDefault ? current.map((record) => ({ ...record, isDefault: false })) : current),
      { name, isDefault, format: value },
    ]);
  };

  const update = (key: string, isDefault: boolean) => {
    setExports((current) => current.map((record) => {
      const matches = String(record.id ?? record.name ?? record.title ?? '') === key;
      if (matches) return { ...record, isDefault, format: value };
      return isDefault && record.isDefault ? { ...record, isDefault: false } : record;
    }));
  };

  return (
    <div ref={connect} style={style} className={[className, ...classNames].filter(Boolean).join(' ')}>
      <ExportSettingsPanel
        columns={columns}
        value={value}
        exports={exports}
        accentColor={accentColor}
        disabled={disabled}
        i18n={i18n}
        lang={lang}
        style={{ height: '100%' }}
        onChange={setValue}
        onLoadExport={(record) => setValue(normalizeExportFormat(record.format, columns))}
        onSaveExport={save}
        onUpdateExport={update}
        onDeleteExport={(key) => setExports((current) => current.filter((record) => String(record.id ?? record.name ?? record.title ?? '') !== key))}
        onHelp={() => undefined}
        onValidate={() => undefined}
        onCancel={() => undefined}
      />
    </div>
  );
};

export default ExportSettingsBuild;
