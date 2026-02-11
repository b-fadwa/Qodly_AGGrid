export type DataclassAttributeInfo = {
  name: string;
  kind?: string;
  type?: string;
  behavior?: string;
};

const toAttributeInfo = (item: any): DataclassAttributeInfo => ({
  name: item?.name,
  kind: item?.kind,
  type: item?.type,
  behavior: item?.behavior,
});

export const getDataclassAttributeInfo = (dataclass: any) => {
  if (!dataclass?.getAllAttributes) {
    return { combined: [] as DataclassAttributeInfo[], formatted: [] as DataclassAttributeInfo[], all: [] as DataclassAttributeInfo[] };
  }

  const processedEntities = new Set<string>();
  const combined: DataclassAttributeInfo[] = [];
  const formatted: DataclassAttributeInfo[] = Object.values(dataclass.getAllAttributes()).map(toAttributeInfo);

  const processAttributes = (attributes: any[], dataClassName: string, depth: number = 0) => {
    attributes.forEach((item: any) => {
      const uniquePath = dataClassName + item.name;
      if (
        (item.kind === 'relatedEntities' ||
          item.kind === 'relatedEntity' ||
          (item.kind === 'calculated' && item.behavior === 'relatedEntities')) &&
        depth == 0
      ) {
        const dataType = item.type.includes('Selection') ? item.type.replace('Selection', '') : item.type;
        if (processedEntities.has(uniquePath)) return;
        processedEntities.add(uniquePath);
        const relatedEntityAttributes = Object.values(
          (dataclass._private?.datastore as any)?.[dataType]?.getAllAttributes?.() || {},
        );
        relatedEntityAttributes.forEach((attr: any) => {
          if (attr.kind === 'storage' && !processedEntities.has(uniquePath + '.' + attr.name)) {
            combined.push(toAttributeInfo({ ...attr, name: uniquePath + '.' + attr.name }));
            processedEntities.add(uniquePath + '.' + attr.name);
          }
        });
        processAttributes(relatedEntityAttributes as any[], uniquePath + '.', depth + 1);
      } else if (item.kind === 'storage' && !processedEntities.has(uniquePath)) {
        combined.push(toAttributeInfo({ ...item, name: uniquePath }));
        processedEntities.add(uniquePath);
      }
    });
  };

  const topLevelAttributes = Object.values(dataclass.getAllAttributes()).filter(
    (item: any) =>
      item.kind === 'relatedEntities' ||
      item.kind === 'relatedEntity' ||
      (item.kind === 'calculated' && item.behavior === 'relatedEntities'),
  );
  processAttributes(topLevelAttributes as any[], '');

  const all = Array.from(
    new Map([...combined, ...formatted].filter((item) => item?.name).map((item) => [item.name, item])).values(),
  );

  return { combined, formatted, all };
};
