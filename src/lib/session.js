import { useCallback, useEffect, useRef, useState } from 'react';

const BIN_ID = import.meta.env.VITE_JSONBIN_ID || '6a04316d250b1311c342ab9a';
const API_KEY = import.meta.env.VITE_JSONBIN_KEY || '';
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const POLL_BASE_MS = 2000;
const POLL_MAX_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 10000;
const PARTICIPANT_TIMEOUT_MS = 25000;
const FETCH_TIMEOUT_MS = 5000;

export const EMPTY_GAME_STATE = {
  currentQuestion: 0,
  showResults: false,
  votes: {},
  participants: {},
  sessionId: 0,
  started: false,
};

export function normalizeParticipants(participants, now = Date.now()) {
  if (!participants) return {};
  if (Array.isArray(participants)) {
    return Object.fromEntries(participants.filter(Boolean).map((id) => [id, now]));
  }
  if (typeof participants !== 'object') return {};
  return participants;
}

export function activeParticipantIds(participants, now = Date.now()) {
  const map = normalizeParticipants(participants, now);
  return Object.entries(map)
    .filter(([, ts]) => typeof ts === 'number' && now - ts < PARTICIPANT_TIMEOUT_MS)
    .map(([id]) => id);
}

export function pruneParticipants(participants, now = Date.now()) {
  const map = normalizeParticipants(participants, now);
  const result = {};
  for (const [id, ts] of Object.entries(map)) {
    if (typeof ts === 'number' && now - ts < PARTICIPANT_TIMEOUT_MS) {
      result[id] = ts;
    }
  }
  return result;
}

function gameSliceFromRecord(record, gameId) {
  const games = record?.games || {};
  const slice = games[gameId];
  if (!slice) return EMPTY_GAME_STATE;
  return { ...EMPTY_GAME_STATE, ...slice };
}

function makeParticipantId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `p_${crypto.randomUUID()}`;
    }
  } catch {
    // ignore — fall through to Math.random
  }
  return `p_${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateParticipantId(gameId) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return makeParticipantId();
  }
  const key = `cajut:participant:${gameId}`;
  try {
    let id = window.sessionStorage.getItem(key);
    if (!id) {
      id = makeParticipantId();
      window.sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return makeParticipantId();
  }
}

function linkSignal(controller, externalSignal) {
  if (!externalSignal) return () => {};
  if (externalSignal.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  externalSignal.addEventListener('abort', onAbort);
  return () => externalSignal.removeEventListener('abort', onAbort);
}

async function fetchAllStates(externalSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const unlink = linkSignal(controller, externalSignal);
  try {
    const res = await fetch(`${BIN_URL}/latest`, {
      headers: { 'X-Master-Key': API_KEY },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    const record = data.record || {};
    return { games: record.games && typeof record.games === 'object' ? record.games : {} };
  } finally {
    clearTimeout(timeoutId);
    unlink();
  }
}

async function writeAllStates(record, externalSignal, { keepalive = false } = {}) {
  const controller = new AbortController();
  // Browsers reject `signal` together with `keepalive` aborts in some versions; only attach a
  // timeout when we are NOT trying to outlive the page.
  const timeoutId = keepalive ? null : setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const unlink = keepalive ? () => {} : linkSignal(controller, externalSignal);
  try {
    const res = await fetch(BIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(record),
      signal: keepalive ? undefined : controller.signal,
      keepalive,
    });
    if (!res.ok) throw new Error(`Write failed: ${res.status}`);
    return res.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    unlink();
  }
}

export function useSession({ gameId, role, onSessionClosed }) {
  const [participantId] = useState(() => getOrCreateParticipantId(gameId));
  const [state, setState] = useState(EMPTY_GAME_STATE);
  const [status, setStatus] = useState('connecting');

  const participantIdRef = useRef(participantId);
  const sessionIdRef = useRef(null);
  const registeredRef = useRef(false);
  const writingRef = useRef(false);
  const lastWriteAtRef = useRef(0);
  const mountedRef = useRef(true);
  const onClosedRef = useRef(onSessionClosed);

  useEffect(() => {
    onClosedRef.current = onSessionClosed;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const update = useCallback(
    async (updaterFn, { force = false } = {}) => {
      writingRef.current = true;
      try {
        const record = await fetchAllStates();
        const currentSlice = gameSliceFromRecord(record, gameId);
        if (
          !force &&
          sessionIdRef.current !== null &&
          (currentSlice.sessionId ?? 0) !== sessionIdRef.current
        ) {
          return null;
        }
        const updated = updaterFn(currentSlice);
        const finalSlice =
          role === 'participant'
            ? {
                ...updated,
                participants: {
                  ...pruneParticipants(updated.participants),
                  [participantIdRef.current]: Date.now(),
                },
              }
            : updated;
        const nextRecord = {
          ...record,
          games: { ...record.games, [gameId]: finalSlice },
        };
        await writeAllStates(nextRecord);
        lastWriteAtRef.current = Date.now();
        if (mountedRef.current) {
          setState(finalSlice);
          setStatus('live');
        }
        return finalSlice;
      } catch (e) {
        if (mountedRef.current && e.name !== 'AbortError') {
          setStatus('reconnecting');
        }
        return null;
      } finally {
        writingRef.current = false;
      }
    },
    [gameId, role],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const record = await fetchAllStates(controller.signal);
        if (cancelled) return;
        const slice = gameSliceFromRecord(record, gameId);
        sessionIdRef.current = slice.sessionId ?? 0;
        setState(slice);
        setStatus('live');
        if (role === 'participant' && !registeredRef.current) {
          registeredRef.current = true;
          await update((current) => current);
        }
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') setStatus('reconnecting');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gameId, role, update]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let backoff = POLL_BASE_MS;
    let controller = null;

    const schedule = (delay) => {
      timer = setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled) return;
      if (writingRef.current) {
        schedule(POLL_BASE_MS);
        return;
      }
      controller = new AbortController();
      try {
        const record = await fetchAllStates(controller.signal);
        if (cancelled) return;
        const slice = gameSliceFromRecord(record, gameId);
        setState(slice);
        setStatus('live');
        backoff = POLL_BASE_MS;
      } catch (e) {
        if (cancelled || e.name === 'AbortError') return;
        setStatus('reconnecting');
        backoff = Math.min(backoff * 2, POLL_MAX_MS);
      } finally {
        if (!cancelled) schedule(backoff);
      }
    };

    schedule(POLL_BASE_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (controller) controller.abort();
    };
  }, [gameId]);

  useEffect(() => {
    if (role !== 'participant') return undefined;
    const interval = setInterval(() => {
      if (writingRef.current) return;
      if (!registeredRef.current) return;
      if (sessionIdRef.current === null) return;
      if (Date.now() - lastWriteAtRef.current < HEARTBEAT_INTERVAL_MS) return;
      update((current) => current).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [role, update]);

  useEffect(() => {
    if (sessionIdRef.current === null) return;
    if ((state.sessionId ?? 0) === sessionIdRef.current) return;
    sessionIdRef.current = null;
    registeredRef.current = false;
    onClosedRef.current?.();
  }, [state.sessionId]);

  useEffect(() => {
    if (role !== 'participant') return undefined;
    const myId = participantIdRef.current;

    const deregister = async ({ keepalive = false } = {}) => {
      const expectedSessionId = sessionIdRef.current;
      if (expectedSessionId === null) return;
      try {
        const record = await fetchAllStates();
        const currentSlice = gameSliceFromRecord(record, gameId);
        if ((currentSlice.sessionId ?? 0) !== expectedSessionId) return;
        const map = normalizeParticipants(currentSlice.participants);
        if (!(myId in map)) return;
        const { [myId]: _removed, ...rest } = map;
        const nextSlice = { ...currentSlice, participants: rest };
        const nextRecord = {
          ...record,
          games: { ...record.games, [gameId]: nextSlice },
        };
        await writeAllStates(nextRecord, undefined, { keepalive });
      } catch {
        // best-effort
      }
    };

    const onUnload = () => {
      deregister({ keepalive: true });
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
      if (registeredRef.current) {
        registeredRef.current = false;
        deregister();
      }
    };
  }, [role, gameId]);

  return {
    state,
    status,
    participantId,
    update,
  };
}
