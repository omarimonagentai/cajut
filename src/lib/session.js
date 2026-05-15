import { useCallback, useEffect, useRef, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref as dbRef,
  onValue,
  set,
  update as fbUpdate,
  remove,
  onDisconnect,
  serverTimestamp,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDrfxXRGImotnh-yzQy1zwZEFbTNBI6aV0',
  authDomain: 'cajut-53d44.firebaseapp.com',
  databaseURL: 'https://cajut-53d44-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'cajut-53d44',
  storageBucket: 'cajut-53d44.firebasestorage.app',
  messagingSenderId: '416024689923',
  appId: '1:416024689923:web:87f580062e72a4e4defd36',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

export const EMPTY_GAME_STATE = {
  currentQuestion: 0,
  showResults: false,
  votes: {},
  participants: {},
  sessionId: 0,
  started: false,
};

function makeParticipantId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `p_${crypto.randomUUID()}`;
    }
  } catch {
    // fall through
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

export function activeParticipantIds(participants) {
  if (!participants || typeof participants !== 'object') return [];
  return Object.keys(participants);
}

export function useSession({ gameId, role, onSessionClosed }) {
  const [participantId] = useState(() => getOrCreateParticipantId(gameId));
  const [state, setState] = useState(EMPTY_GAME_STATE);
  const [status, setStatus] = useState('connecting');

  const sessionIdRef = useRef(null);
  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  const onClosedRef = useRef(onSessionClosed);

  useEffect(() => {
    onClosedRef.current = onSessionClosed;
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Subscribe to the game node. Firebase pushes updates over a WebSocket, so
  // this replaces the polling loop and the per-write GET round-trip.
  useEffect(() => {
    sessionIdRef.current = null;
    const gameRef = dbRef(db, `games/${gameId}`);
    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        if (!mountedRef.current) return;
        const data = snapshot.val() || {};
        const slice = { ...EMPTY_GAME_STATE, ...data };
        const incomingSid = slice.sessionId ?? 0;
        if (sessionIdRef.current === null) {
          sessionIdRef.current = incomingSid;
        } else if (incomingSid !== sessionIdRef.current) {
          sessionIdRef.current = null;
          setState(EMPTY_GAME_STATE);
          setStatus('live');
          onClosedRef.current?.();
          return;
        }
        setState(slice);
        setStatus('live');
      },
      () => {
        if (mountedRef.current) setStatus('reconnecting');
      },
    );
    return unsubscribe;
  }, [gameId]);

  // Participant presence. onDisconnect runs server-side when the WebSocket
  // closes, so closing the tab or losing the network auto-removes the entry.
  useEffect(() => {
    if (role !== 'participant') return undefined;
    const partRef = dbRef(db, `games/${gameId}/participants/${participantId}`);
    onDisconnect(partRef).remove().catch(() => {});
    set(partRef, serverTimestamp()).catch(() => {});
    return () => {
      onDisconnect(partRef).cancel().catch(() => {});
      remove(partRef).catch(() => {});
    };
  }, [gameId, role, participantId]);

  const reportFailure = useCallback((e) => {
    if (mountedRef.current && e?.code !== 'PERMISSION_DENIED') {
      setStatus('reconnecting');
    }
  }, []);

  const submitVote = useCallback(
    async (qId, optionIndex) => {
      try {
        await set(dbRef(db, `games/${gameId}/votes/${qId}/${participantId}`), optionIndex);
      } catch (e) {
        reportFailure(e);
      }
    },
    [gameId, participantId, reportFailure],
  );

  const showResults = useCallback(async () => {
    try {
      await set(dbRef(db, `games/${gameId}/showResults`), true);
    } catch (e) {
      reportFailure(e);
    }
  }, [gameId, reportFailure]);

  const nextQuestion = useCallback(async () => {
    try {
      const current = stateRef.current.currentQuestion ?? 0;
      await fbUpdate(dbRef(db, `games/${gameId}`), {
        currentQuestion: current + 1,
        showResults: false,
      });
    } catch (e) {
      reportFailure(e);
    }
  }, [gameId, reportFailure]);

  const startSession = useCallback(async () => {
    try {
      await fbUpdate(dbRef(db, `games/${gameId}`), {
        started: true,
        currentQuestion: 0,
        showResults: false,
      });
    } catch (e) {
      reportFailure(e);
    }
  }, [gameId, reportFailure]);

  const resetQuiz = useCallback(async () => {
    try {
      await fbUpdate(dbRef(db, `games/${gameId}`), {
        currentQuestion: 0,
        showResults: false,
        votes: null,
      });
    } catch (e) {
      reportFailure(e);
    }
  }, [gameId, reportFailure]);

  const closeSession = useCallback(async () => {
    try {
      await set(dbRef(db, `games/${gameId}`), {
        ...EMPTY_GAME_STATE,
        sessionId: Date.now(),
      });
    } catch (e) {
      reportFailure(e);
    }
  }, [gameId, reportFailure]);

  return {
    state,
    status,
    participantId,
    submitVote,
    showResults,
    nextQuestion,
    startSession,
    resetQuiz,
    closeSession,
  };
}
