import { formatValue, useI18n, useLocalization } from '@ws-ui/webform-editor';
import { MdCheck, MdClose } from 'react-icons/md';
import { DataType, getStyle } from '@ws-ui/formatter';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extractRefDatasetKeyFromSource, isTextDataType } from './AgGrid.filtering';

const CustomCell = ({
  format,
  dataType,
  value,
  colDef,
}: {
  format: any;
  dataType: string;
  value: any;
  colDef?: {
    field?: string;
    headerName?: string;
    source?: string;
    context?: { source?: string };
  };
}) => {
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();

  const [textPopover, setTextPopover] = useState<{ open: boolean; rect: DOMRect | null }>({
    open: false,
    rect: null,
  });
  const textCellTriggerRef = useRef<HTMLDivElement | null>(null);
  const textPopoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textPopoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTextPopoverTimers = useCallback(() => {
    if (textPopoverOpenTimer.current != null) {
      clearTimeout(textPopoverOpenTimer.current);
      textPopoverOpenTimer.current = null;
    }
    if (textPopoverCloseTimer.current != null) {
      clearTimeout(textPopoverCloseTimer.current);
      textPopoverCloseTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTextPopoverTimers(), [clearTextPopoverTimers]);

  useEffect(() => {
    clearTextPopoverTimers();
    setTextPopover({ open: false, rect: null });
  }, [value, clearTextPopoverTimers]);

  const scheduleTextPopoverOpen = useCallback(() => {
    clearTextPopoverTimers();
    textPopoverOpenTimer.current = setTimeout(() => {
      textPopoverOpenTimer.current = null;
      const el = textCellTriggerRef.current;
      if (!el) return;
      setTextPopover({ open: true, rect: el.getBoundingClientRect() });
    }, 220);
  }, [clearTextPopoverTimers]);

  const scheduleTextPopoverClose = useCallback(() => {
    if (textPopoverOpenTimer.current != null) {
      clearTimeout(textPopoverOpenTimer.current);
      textPopoverOpenTimer.current = null;
    }
    if (textPopoverCloseTimer.current != null) {
      clearTimeout(textPopoverCloseTimer.current);
    }
    textPopoverCloseTimer.current = setTimeout(() => {
      textPopoverCloseTimer.current = null;
      setTextPopover({ open: false, rect: null });
    }, 120);
  }, []);

  const keepTextPopoverOpen = useCallback(() => {
    if (textPopoverCloseTimer.current != null) {
      clearTimeout(textPopoverCloseTimer.current);
      textPopoverCloseTimer.current = null;
    }
  }, []);

  const translateKey = (key: string): string => {
    const entry = i18n?.keys?.[key]?.[lang] ?? i18n?.keys?.[key]?.default;
    return entry ?? key;
  };

  const translateFromHeader = (input: any): any => {
    const headerKey =
      colDef?.context?.source ??
      colDef?.source ??
      colDef?.headerName ??
      colDef?.field ??
      '';
    const match = typeof headerKey === 'string' ? headerKey.match(/_r_(16\d{3})/i) : null;
    if (!match || input === undefined || input === null || input === '') {
      return input;
    }

    const resourceId = match[1];
    const translationKey = `${resourceId}${input}`;

    const entry = i18n?.keys?.[translationKey];

    return entry?.[lang] ?? entry?.default ?? input;
  };

  const translatedValue = translateFromHeader(value);

  switch (true) {
    case translatedValue &&
      typeof translatedValue === 'object' &&
      !(translatedValue instanceof Date):
      return (
        <>
          {(translatedValue as any)?.__deferred?.image ? (
            <img className="image h-full" src={(translatedValue as any)?.__deferred?.uri} alt="" />
          ) : (
            JSON.stringify(translatedValue)
          )}
        </>
      );
    case dataType === 'number' && typeof translatedValue === 'boolean' && format === 'checkbox':
      return <input className="checkbox" type="checkbox" checked={translatedValue} disabled />;
    case dataType === 'number' && typeof translatedValue === 'boolean' && format === 'icon':
      return (
        <div className={'icon h-full flex items-center icon-' + translatedValue}>
          {translatedValue ? <MdCheck /> : <MdClose />}
        </div>
      );
    case dataType === 'number' && typeof translatedValue === 'number' && format === 'slider':
      return <input className="slider" type="range" value={translatedValue} disabled />;
    case dataType === 'bool' && typeof translatedValue === 'boolean' && format === 'boolean':
      return (
        <div className="cell" style={{ textTransform: 'capitalize' }}>
          {translateKey(translatedValue ? 'yes' : 'no')}
        </div>
      );
    default: {
      const refSource =
        typeof colDef?.context?.source === 'string'
          ? colDef.context.source
          : typeof colDef?.source === 'string'
            ? colDef.source
            : undefined;
      const isRefBackedColumn = extractRefDatasetKeyFromSource(refSource) !== null;

      const customValue =
        translatedValue !== undefined && translatedValue !== null
          ? format
            ? formatValue(translatedValue, dataType, format)
            : translatedValue.toString()
          : translatedValue;
      const customStyle =
        format && format !== 'icon' && format !== 'checkbox'
          ? getStyle(dataType as DataType, format, translatedValue)
          : {};

      const displayString =
        customValue !== undefined &&
        customValue !== null &&
        (typeof customValue === 'string' || typeof customValue === 'number')
          ? String(customValue)
          : '';

      const useTextPopover =
        (isTextDataType(dataType) || isRefBackedColumn) &&
        displayString.length > 0 &&
        format !== 'icon' &&
        format !== 'checkbox';

      const popoverLayer =
        useTextPopover &&
        textPopover.open &&
        textPopover.rect &&
        typeof document !== 'undefined'
          ? createPortal(
              <div
                className="aggrid-text-cell-popover pointer-events-auto max-h-60 max-w-md overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-sm text-slate-900 shadow-lg"
                style={{
                  position: 'fixed',
                  top: textPopover.rect.bottom + 4,
                  left: textPopover.rect.left,
                  minWidth: Math.min(textPopover.rect.width, 320),
                  zIndex: 20050,
                }}
                onMouseEnter={keepTextPopoverOpen}
                onMouseLeave={scheduleTextPopoverClose}
              >
                {displayString}
              </div>,
              document.body,
            )
          : null;

      return (
        <>
          <div
            ref={useTextPopover ? textCellTriggerRef : undefined}
            style={customStyle}
            className="cell whitespace-nowrap"
            onMouseEnter={useTextPopover ? scheduleTextPopoverOpen : undefined}
            onMouseLeave={useTextPopover ? scheduleTextPopoverClose : undefined}
          >
            {customValue}
          </div>
          {popoverLayer}
        </>
      );
    }
  }
};

export default CustomCell;
