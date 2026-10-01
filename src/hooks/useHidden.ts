import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscoveryItem } from '../providers/types';
import type { ProviderId } from '../providers/types';
import { addHidden, clearHidden, getHidden, removeHidden } from '../lib/hidden';

export interface UndoToastData {
  mediaId: number;
  title: string;
}

const UNDO_MS = 5000;

/**
 * Per-username hidden results + the undo toast. The persisted set (localStorage,
 * scoped per provider + username) is the source of truth; component state
 * mirrors it for instant re-renders.
 */
export function useHidden(username: string | null, provider: ProviderId) {
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [toast, setToast] = useState<UndoToastData | null>(null);
  const timerRef = useRef<number | null>(null);

  // Swap sets (and dismiss any toast) when the searched account changes.
  useEffect(() => {
    setHidden(username ? getHidden(provider, username) : new Set());
    setToast(null);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [username, provider]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const armToast = useCallback((data: UndoToastData) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setToast(data);
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, UNDO_MS);
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const hide = useCallback(
    (item: DiscoveryItem) => {
      if (!username) return;
      addHidden(provider, username, item.media.id);
      setHidden(getHidden(provider, username));
      armToast({
        mediaId: item.media.id,
        title: item.media.title.english || item.media.title.romaji || 'Untitled',
      });
    },
    [username, provider, armToast],
  );

  const undo = useCallback(() => {
    if (!username || !toast) return;
    removeHidden(provider, username, toast.mediaId);
    setHidden(getHidden(provider, username));
    dismissToast();
  }, [username, provider, toast, dismissToast]);

  const showAll = useCallback(() => {
    if (!username) return;
    clearHidden(provider, username);
    setHidden(new Set());
    dismissToast();
  }, [username, provider, dismissToast]);

  return { hidden, toast, hide, undo, showAll };
}
