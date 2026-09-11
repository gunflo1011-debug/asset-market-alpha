import { useCallback, useMemo, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

type RemoteImageState = {
  source: ImageSourcePropType | null;
  failed: boolean;
  loading: boolean;
  onLoadStart: () => void;
  onLoadEnd: () => void;
  onError: () => void;
};

export function useRemoteImageState(uri?: string | null): RemoteImageState {
  const normalizedUri = uri?.trim() || null;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadingUri, setLoadingUri] = useState<string | null>(normalizedUri);

  const source = useMemo<ImageSourcePropType | null>(
    () => (normalizedUri ? { uri: normalizedUri, cache: 'force-cache' as const } : null),
    [normalizedUri],
  );

  const onLoadStart = useCallback(() => {
    if (!normalizedUri) return;
    setFailedUri((current) => (current === normalizedUri ? null : current));
    setLoadingUri(normalizedUri);
  }, [normalizedUri]);

  const onLoadEnd = useCallback(() => {
    if (!normalizedUri) return;
    setLoadingUri((current) => (current === normalizedUri ? null : current));
  }, [normalizedUri]);

  const onError = useCallback(() => {
    if (!normalizedUri) return;
    setLoadingUri((current) => (current === normalizedUri ? null : current));
    setFailedUri(normalizedUri);
  }, [normalizedUri]);

  return {
    source,
    failed: Boolean(normalizedUri && failedUri === normalizedUri),
    loading: Boolean(normalizedUri && loadingUri === normalizedUri && failedUri !== normalizedUri),
    onLoadStart,
    onLoadEnd,
    onError,
  };
}
