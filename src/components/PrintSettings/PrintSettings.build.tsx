import { FC, useEffect, useMemo, useState } from 'react';
import { useEnhancedNode, useI18n, useLocalization } from '@ws-ui/webform-editor';
import type { IPrintSettingsProps } from './PrintSettings.config';
import PrintSettingsPanel from './PrintSettingsPanel';
import { extractPrintColumns, normalizePrintFormat } from './PrintSettings.utils';
import type { PrintFormatValue, SavedPrintFormat } from './PrintSettings.types';

const PrintSettingsBuild: FC<IPrintSettingsProps> = ({
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
      ? extractPrintColumns({
          period: { dateStart: '!!2026-04-01!!', dateEnd: '!!2026-04-04!!' },
          totals: { timeLogged: 702.5, timeBilled: 454, timePresent: 1003 },
          metrics: [{ id: 'utilisation', percent: 70, numerator: 702.5 }],
        })
      : [],
    [state],
  );
  const [value, setValue] = useState<PrintFormatValue>(() => normalizePrintFormat(null, columns));
  const [formats, setFormats] = useState<SavedPrintFormat[]>([]);

  useEffect(() => {
    setValue((current) => normalizePrintFormat(current, columns));
  }, [columns]);

  const save = (name: string, isDefault: boolean) => {
    setFormats((current) => [
      ...(isDefault ? current.map((record) => ({ ...record, isDefault: false })) : current),
      { name, isDefault, format: value },
    ]);
  };

  const update = (key: string, isDefault: boolean) => {
    setFormats((current) => current.map((record) => {
      const matches = String(record.id ?? record.name ?? record.title ?? '') === key;
      if (matches) return { ...record, isDefault, format: value };
      return isDefault && record.isDefault ? { ...record, isDefault: false } : record;
    }));
  };

  return (
    <div ref={connect} style={style} className={[className, ...classNames].filter(Boolean).join(' ')}>
      <PrintSettingsPanel
        columns={columns}
        value={value}
        formats={formats}
        accentColor={accentColor}
        disabled={disabled}
        i18n={i18n}
        lang={lang}
        style={{ height: '100%' }}
        onChange={setValue}
        onLoadFormat={(record) => setValue(normalizePrintFormat(record.format, columns))}
        onSaveFormat={save}
        onUpdateFormat={update}
        onDeleteFormat={(key) => setFormats((current) => current.filter((record) => String(record.id ?? record.name ?? record.title ?? '') !== key))}
        onHelp={() => undefined}
        onValidate={() => undefined}
        onCancel={() => undefined}
      />
    </div>
  );
};

export default PrintSettingsBuild;
