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
  const [loadedUri, setLoadedUri] = useState<string | null>(null);

  const source = useMemo<ImageSourcePropType | null>(
    () => (normalizedUri ? { uri: normalizedUri, cache: 'force-cache' as const } : null),
    [normalizedUri],
  );

  const onLoadStart = useCallback(() => {
    if (!normalizedUri) return;
    setFailedUri((current) => (current === normalizedUri ? null : current));
    setLoadedUri((current) => (current === normalizedUri ? null : current));
  }, [normalizedUri]);

  const onLoadEnd = useCallback(() => {
    if (!normalizedUri) return;
    setLoadedUri(normalizedUri);
  }, [normalizedUri]);

  const onError = useCallback(() => {
    if (!normalizedUri) return;
    setFailedUri(normalizedUri);
  }, [normalizedUri]);

  return {
    source,
    failed: Boolean(normalizedUri && failedUri === normalizedUri),
    loading: Boolean(normalizedUri && loadedUri !== normalizedUri && failedUri !== normalizedUri),
    onLoadStart,
    onLoadEnd,
    onError,
  };
}
