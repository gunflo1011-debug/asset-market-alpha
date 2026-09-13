import { useCallback, useMemo, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

const MAX_SESSION_LOADED_URIS = 256;
const sessionLoadedImageKeys = new Set<string>();

export function remoteImageIdentity(uri: string): string {
  const queryIndex = uri.indexOf('?');
  const hashIndex = uri.indexOf('#');
  let cutoff = uri.length;
  if (queryIndex >= 0) cutoff = Math.min(cutoff, queryIndex);
  if (hashIndex >= 0) cutoff = Math.min(cutoff, hashIndex);
  return uri.slice(0, cutoff);
}

function rememberLoadedImageKey(key: string) {
  if (sessionLoadedImageKeys.has(key)) return;
  sessionLoadedImageKeys.add(key);
  if (sessionLoadedImageKeys.size <= MAX_SESSION_LOADED_URIS) return;

  const oldestKey = sessionLoadedImageKeys.values().next().value as string | undefined;
  if (oldestKey) sessionLoadedImageKeys.delete(oldestKey);
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
  const imageKey = normalizedUri ? remoteImageIdentity(normalizedUri) : null;
  const currentUriRef = useRef(normalizedUri);
  currentUriRef.current = normalizedUri;
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const [loadedImageKey, setLoadedImageKey] = useState<string | null>(() =>
    imageKey && sessionLoadedImageKeys.has(imageKey) ? imageKey : null,
  );

  const source = useMemo<ImageSourcePropType | null>(
    () => (normalizedUri ? { uri: normalizedUri, cache: 'force-cache' as const } : null),
    [normalizedUri],
  );

  const onLoadStart = useCallback(() => {
    if (!normalizedUri || !imageKey || currentUriRef.current !== normalizedUri) return;
    setFailedImageKey((current) => (current === imageKey ? null : current));
    if (!sessionLoadedImageKeys.has(imageKey)) {
      setLoadedImageKey((current) => (current === imageKey ? null : current));
    }
  }, [normalizedUri, imageKey]);

  const onLoadEnd = useCallback(() => {
    if (!normalizedUri || !imageKey || currentUriRef.current !== normalizedUri) return;
    rememberLoadedImageKey(imageKey);
    setLoadedImageKey(imageKey);
  }, [normalizedUri, imageKey]);

  const onError = useCallback(() => {
    if (!normalizedUri || !imageKey || currentUriRef.current !== normalizedUri) return;
    sessionLoadedImageKeys.delete(imageKey);
    setFailedImageKey(imageKey);
  }, [normalizedUri, imageKey]);

  const wasLoadedThisSession = Boolean(imageKey && sessionLoadedImageKeys.has(imageKey));

  return {
    source,
    failed: Boolean(imageKey && failedImageKey === imageKey),
    loading: Boolean(
      imageKey && !wasLoadedThisSession && loadedImageKey !== imageKey && failedImageKey !== imageKey,
    ),
    onLoadStart,
    onLoadEnd,
    onError,
  };
}
