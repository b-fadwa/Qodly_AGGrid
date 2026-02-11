import { splitDatasourceID } from '@ws-ui/webform-editor';
import { selectActiveTab, selectDatasourcesByPath, selectSharedDatasources, useAppSelector } from '@ws-ui/store';
import { useMemo } from 'react';

export const useDatasourceDataclass = (datasource?: string) => {
  const path = useAppSelector(selectActiveTab);
  const localDatasources = useAppSelector(selectDatasourcesByPath(path));
  const sharedDatasources = useAppSelector(selectSharedDatasources);

  return useMemo(() => {
    if (!datasource) return '';
    const { id, namespace } = splitDatasourceID(datasource.trim()) || {};
    if (!id) return '';

    const localMatch = localDatasources.find(
      (ds) => ds.id === id && (namespace ? ds.namespace === namespace : !ds.namespace),
    );
    if (localMatch && 'dataclass' in localMatch) {
      return localMatch.dataclass || '';
    }

    if (namespace) {
      const sharedMatch = sharedDatasources[namespace]?.find((ds) => ds.id === id);
      if (sharedMatch && 'dataclass' in sharedMatch) {
        return sharedMatch.dataclass || '';
      }
    }

    return '';
  }, [datasource, localDatasources, sharedDatasources]);
};
