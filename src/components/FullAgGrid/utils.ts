export type DataclassAttributeInfo = Pick<catalog.Attribute, 'name' | 'kind' | 'type'> & {
  behavior: catalog.CalculatedAttribute['behavior'];
};

const toAttributeInfo = (item: catalog.Attribute): DataclassAttributeInfo => ({
  name: item?.name,
  kind: item?.kind,
  type: item?.type,
  behavior: item.kind === 'calculated' ? item?.behavior : undefined,
});

export const getDataclassAttributeInfo = (dataclass: datasources.DataClass) => {
  if (!dataclass?.getAllAttributes) {
    return { combined: [] as DataclassAttributeInfo[], formatted: [] as DataclassAttributeInfo[] };
  }

  const processedEntities = new Set<string>();
  const combined: DataclassAttributeInfo[] = [];
  const formatted: DataclassAttributeInfo[] = Object.values(dataclass.getAllAttributes()).map(toAttributeInfo);

  const processAttributes = (attributes: catalog.Attribute[], dataClassName: string, depth: number = 0) => {
    attributes.forEach((item) => {
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
          window?.$$datastores?.ds?.getDataClass?.(dataType).getAllAttributes?.() || {},
        );
        relatedEntityAttributes.forEach((attr) => {
          if (attr.kind === 'storage' && !processedEntities.has(uniquePath + '.' + attr.name)) {
            combined.push(toAttributeInfo({ ...attr, name: uniquePath + '.' + attr.name }));
            processedEntities.add(uniquePath + '.' + attr.name);
          }
        });
        processAttributes(relatedEntityAttributes, uniquePath + '.', depth + 1);
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

  return { combined, formatted };
};
