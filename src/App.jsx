import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Smartphone, Lock } from 'lucide-react';
import Quiz from './Quiz.jsx';

const MANIFEST_URL = `${import.meta.env.BASE_URL}games.json`;

function gameQuestionsUrl(gameId) {
  return `${import.meta.env.BASE_URL}games/${gameId}.json`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function parseUrl() {
  if (typeof window === 'undefined') return { kind: 'home' };
  const params = new URLSearchParams(window.location.search);
  const ctrl = params.get('ctrl');
  const gameId = params.get('game');
  if (ctrl) return { kind: 'presenter', token: ctrl };
  if (gameId) return { kind: 'participant', gameId };
  return { kind: 'home' };
}

function setDocumentTitle(title) {
  if (typeof document !== 'undefined' && title) {
    document.title = title;
  }
}

function navigateToParticipant(gameId) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('ctrl');
  url.searchParams.set('game', gameId);
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function navigateHome() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('ctrl');
  url.searchParams.delete('game');
  window.history.pushState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function SelectionPage({ games }) {
  return (
    <div className="relative min-h-screen bg-cooltra-blue overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-20 w-[420px] h-[420px] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(254,255,255,0.18), transparent)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 -left-20 w-[360px] h-[360px] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(5,225,0,0.18), transparent)' }}
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-10">
        <div className="max-w-4xl w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cooltra-white/15 border border-cooltra-white/30 backdrop-blur-sm mb-5">
            <Smartphone className="w-3.5 h-3.5 text-cooltra-white" />
            <span className="text-cooltra-white text-[11px] font-semi uppercase tracking-[0.18em]">
              Quiz interactivo
            </span>
          </div>

          <h1 className="font-extra text-cooltra-white text-4xl md:text-6xl leading-[0.95] mb-3">
            Elige un quiz<br />y únete a la sala.
          </h1>
          <p className="text-cooltra-white/90 text-base md:text-lg mb-8 max-w-xl">
            Selecciona el quiz que vais a hacer hoy. Te conectarás como participante con voto anónimo.
          </p>

          {games.length === 0 ? (
            <div className="rounded-cooltra bg-cooltra-white/10 border border-cooltra-white/20 p-6 text-cooltra-white text-sm">
              No hay quizzes disponibles. Añade uno en <code className="font-semi">public/games.json</code>.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {games.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigateToParticipant(g.id)}
                  className="group bg-cooltra-white rounded-cooltra p-5 text-left transition hover:-translate-y-1 hover:shadow-cooltra"
                >
                  {g.badge && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cooltra-blue/10 mb-3">
                      <span className="text-cooltra-blue text-[10px] font-extra uppercase tracking-[0.16em]">
                        {g.badge}
                      </span>
                    </div>
                  )}
                  <h2 className="font-extra text-cooltra-blue text-xl mb-2 leading-tight">{g.title}</h2>
                  {g.subtitle && (
                    <p className="text-cooltra-dark/70 text-xs mb-4 leading-snug">{g.subtitle}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-cooltra-blue text-xs font-extra uppercase tracking-[0.16em] group-hover:gap-2.5 transition-all">
                    Unirme
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ title, message, action }) {
  return (
    <div className="relative min-h-screen bg-cooltra-blue flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-cooltra-white rounded-cooltra p-8 shadow-cooltra">
        <AlertCircle className="w-12 h-12 text-cooltra-orange mx-auto mb-4" />
        <h2 className="font-extra text-cooltra-blue text-2xl mb-2">{title}</h2>
        <p className="text-cooltra-dark/70 text-sm mb-5">{message}</p>
        {action}
      </div>
    </div>
  );
}

function DeniedScreen() {
  return (
    <div className="relative min-h-screen bg-cooltra-blue flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-cooltra-white rounded-cooltra p-8 shadow-cooltra">
        <Lock className="w-12 h-12 text-cooltra-orange mx-auto mb-4" />
        <h2 className="font-extra text-cooltra-blue text-2xl mb-2">Acceso restringido</h2>
        <p className="text-cooltra-dark/70 text-sm mb-5">
          Este enlace requiere un token de presentador válido.
        </p>
        <button
          onClick={navigateHome}
          className="inline-block px-5 py-2.5 bg-cooltra-blue hover:bg-cooltra-dark text-cooltra-white rounded-full text-sm font-semi transition"
        >
          Ver quizzes disponibles
        </button>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="relative min-h-screen bg-cooltra-blue flex items-center justify-center">
      <div className="text-cooltra-white/80 text-sm font-semi uppercase tracking-[0.18em]">Cargando…</div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(parseUrl);
  const [manifest, setManifest] = useState(null);
  const [manifestError, setManifestError] = useState(null);
  const [questionsByGame, setQuestionsByGame] = useState({});
  const [questionsError, setQuestionsError] = useState(null);

  useEffect(() => {
    const handler = () => setRoute(parseUrl());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchJson(MANIFEST_URL);
        if (!active) return;
        const games = Array.isArray(data?.games) ? data.games : [];
        setManifest({ games });
      } catch (e) {
        if (active) setManifestError(e.message);
      }
    })();
    return () => { active = false; };
  }, []);

  const activeGame = useMemo(() => {
    if (!manifest) return null;
    if (route.kind === 'presenter') {
      return manifest.games.find((g) => g.presenterToken && g.presenterToken === route.token) || null;
    }
    if (route.kind === 'participant') {
      return manifest.games.find((g) => g.id === route.gameId) || null;
    }
    return null;
  }, [manifest, route]);

  useEffect(() => {
    if (!activeGame) return;
    if (questionsByGame[activeGame.id]) return;
    let active = true;
    (async () => {
      try {
        const qs = await fetchJson(gameQuestionsUrl(activeGame.id));
        if (active) setQuestionsByGame((prev) => ({ ...prev, [activeGame.id]: qs }));
      } catch (e) {
        if (active) setQuestionsError(e.message);
      }
    })();
    return () => { active = false; };
  }, [activeGame, questionsByGame]);

  useEffect(() => {
    if (activeGame?.title) {
      setDocumentTitle(activeGame.title);
    } else {
      setDocumentTitle('Cajut · Quiz interactivo');
    }
  }, [activeGame]);

  if (manifestError) {
    return (
      <ErrorScreen
        title="No se pudo cargar el catálogo"
        message={manifestError}
        action={
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-cooltra-blue hover:bg-cooltra-dark text-cooltra-white rounded-full text-sm font-semi transition"
          >
            Reintentar
          </button>
        }
      />
    );
  }

  if (!manifest) return <Loading />;

  if (route.kind === 'presenter' && !activeGame) {
    return <DeniedScreen />;
  }

  if (route.kind === 'participant' && !activeGame) {
    return (
      <ErrorScreen
        title="Quiz no encontrado"
        message={`No existe ningún quiz con id "${route.gameId}".`}
        action={
          <button
            onClick={navigateHome}
            className="px-5 py-2.5 bg-cooltra-blue hover:bg-cooltra-dark text-cooltra-white rounded-full text-sm font-semi transition"
          >
            Ver quizzes disponibles
          </button>
        }
      />
    );
  }

  if (route.kind === 'home') {
    return <SelectionPage games={manifest.games} />;
  }

  const questions = questionsByGame[activeGame.id];
  if (questionsError) {
    return (
      <ErrorScreen
        title="No se han podido cargar las preguntas"
        message={questionsError}
        action={
          <button
            onClick={() => {
              setQuestionsError(null);
              setQuestionsByGame((prev) => {
                const { [activeGame.id]: _, ...rest } = prev;
                return rest;
              });
            }}
            className="px-5 py-2.5 bg-cooltra-blue hover:bg-cooltra-dark text-cooltra-white rounded-full text-sm font-semi transition"
          >
            Reintentar
          </button>
        }
      />
    );
  }
  if (!questions) return <Loading />;

  return (
    <Quiz
      game={activeGame}
      questions={questions}
      role={route.kind}
      onExit={navigateHome}
    />
  );
}
