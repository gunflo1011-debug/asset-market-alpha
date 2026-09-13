import { useCallback, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

const MAX_SESSION_LOADED_URIS = 256;
const sessionLoadedUris = new Set<string>();

function rememberLoadedUri(uri: string) {
  if (sessionLoadedUris.has(uri)) return;
  sessionLoadedUris.add(uri);
  if (sessionLoadedUris.size <= MAX_SESSION_LOADED_URIS) return;

  const oldestUri = sessionLoadedUris.values().next().value as string | undefined;
  if (oldestUri) sessionLoadedUris.delete(oldestUri);
}

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
  const currentUriRef = useRef(normalizedUri);
  currentUriRef.current = normalizedUri;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(() =>
    normalizedUri && sessionLoadedUris.has(normalizedUri) ? normalizedUri : null,
  );

  const source = useMemo<ImageSourcePropType | null>(
    () => (normalizedUri ? { uri: normalizedUri, cache: 'force-cache' as const } : null),
    [normalizedUri],
  );

  const onLoadStart = useCallback(() => {
    if (!normalizedUri || currentUriRef.current !== normalizedUri) return;
    setFailedUri((current) => (current === normalizedUri ? null : current));
    if (!sessionLoadedUris.has(normalizedUri)) {
      setLoadedUri((current) => (current === normalizedUri ? null : current));
    }
  }, [normalizedUri]);

  const onLoadEnd = useCallback(() => {
    if (!normalizedUri || currentUriRef.current !== normalizedUri) return;
    rememberLoadedUri(normalizedUri);
    setLoadedUri(normalizedUri);
  }, [normalizedUri]);

  const onError = useCallback(() => {
    if (!normalizedUri || currentUriRef.current !== normalizedUri) return;
    sessionLoadedUris.delete(normalizedUri);
    setFailedUri(normalizedUri);
  }, [normalizedUri]);

  const wasLoadedThisSession = Boolean(normalizedUri && sessionLoadedUris.has(normalizedUri));

  return {
    source,
    failed: Boolean(normalizedUri && failedUri === normalizedUri),
    loading: Boolean(
      normalizedUri && !wasLoadedThisSession && loadedUri !== normalizedUri && failedUri !== normalizedUri,
    ),
    onLoadStart,
    onLoadEnd,
    onError,
  };
}
