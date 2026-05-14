import React, { useState, useEffect, useRef } from 'react';
import { Users, ChevronRight, RotateCcw, Monitor, Smartphone, Trophy, BarChart3, AlertCircle, Zap } from 'lucide-react';

const COOLTRA_PALETTE = ['#008aff', '#052f62', '#ec6e24', '#05e100'];

const QUESTIONS = [
  {
    id: 1,
    question: "¿Con qué frecuencia usas herramientas de AI en tu trabajo?",
    objective: "Tener un baseline real del grupo sin que nadie se sienta juzgado.",
    options: [
      { emoji: "🔴", text: "Nunca la he usado" },
      { emoji: "🟡", text: "La he probado alguna vez" },
      { emoji: "🟢", text: "La uso ocasionalmente (1-2 veces por semana)" },
      { emoji: "🔵", text: "La uso a diario" },
    ]
  },
  {
    id: 2,
    question: "¿Para qué has usado más la AI hasta ahora?",
    objective: "Entender los casos de uso reales y construir ejemplos relevantes durante el taller.",
    options: [
      { emoji: "✍️", text: "Redactar o resumir textos" },
      { emoji: "🔍", text: "Buscar información / investigar" },
      { emoji: "💡", text: "Generar ideas o hacer brainstorming" },
      { emoji: "🤷", text: "Aún no la he usado para nada concreto" },
    ]
  },
  {
    id: 3,
    question: "¿Cuál es tu mayor miedo respecto a la AI en el trabajo?",
    objective: "Identificar las resistencias antes de que el CPO las aborde en el taller.",
    options: [
      { emoji: "🤖", text: "Que reemplace mi puesto o el de mi equipo" },
      { emoji: "🔒", text: "Que comprometa datos confidenciales" },
      { emoji: "❌", text: "Que dé información incorrecta y no me dé cuenta" },
      { emoji: "😕", text: "No le tengo miedo, pero tampoco sé cómo sacarle partido" },
    ]
  },
  {
    id: 4,
    question: "¿Cómo describes tu nivel de confianza usando AI hoy?",
    objective: "Segmentar el grupo para que el CPO ajuste el nivel de profundidad del taller.",
    options: [
      { emoji: "🐣", text: "Soy un completo principiante" },
      { emoji: "🚶", text: "Sé lo básico, pero me falta seguridad" },
      { emoji: "🏃", text: "Me defiendo bastante bien" },
      { emoji: "🚀", text: "Podría enseñarle a otros" },
    ]
  },
  {
    id: 5,
    question: "¿Qué herramienta te resulta más familiar a día de hoy?",
    objective: "Conocer el ecosistema de herramientas que ya está en uso para construir sobre lo que existe.",
    options: [
      { emoji: "💬", text: "ChatGPT" },
      { emoji: "🧡", text: "Claude" },
      { emoji: "🪟", text: "Copilot (Microsoft)" },
      { emoji: "🔧", text: "Otras / Ninguna" },
    ]
  },
  {
    id: 6,
    question: "¿Qué te frena hoy a usar más la AI en tu día a día?",
    objective: "Detectar barreras concretas que la organización puede resolver (formación, política de datos, licencias).",
    options: [
      { emoji: "⏰", text: "No tengo tiempo para aprender a usarla bien" },
      { emoji: "🤔", text: "No sé qué tareas delegarle" },
      { emoji: "🔐", text: "Restricciones o dudas sobre qué puedo compartir" },
      { emoji: "💸", text: "No tengo acceso a las herramientas adecuadas" },
    ]
  },
  {
    id: 7,
    question: "Si la AI fuera un compañero de trabajo, ¿cuál sería hoy?",
    objective: "Terminar con humor, generar conversación y que la sala se relaje antes de entrar al contenido.",
    options: [
      { emoji: "👀", text: "El becario nuevo — lo observo pero no le doy trabajo" },
      { emoji: "🤝", text: "El colega al que le consulto cosas de vez en cuando" },
      { emoji: "🧠", text: "Mi asistente de confianza al que delego tareas" },
      { emoji: "👑", text: "Mi copiloto — trabajamos juntos en casi todo" },
    ]
  },
];

const BIN_ID = import.meta.env.VITE_JSONBIN_ID || "6a04316d250b1311c342ab9a";
const API_KEY = import.meta.env.VITE_JSONBIN_KEY || "";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const POLL_INTERVAL_MS = 2000;

const DEFAULT_STATE = {
  currentQuestion: 0,
  showResults: false,
  votes: {},
  participants: [],
};

async function fetchState() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${BIN_URL}/latest`, {
      headers: { 'X-Master-Key': API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    return data.record || DEFAULT_STATE;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function writeState(newState) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(BIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(newState),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Write failed: ${res.status}`);
    return res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

function CooltraWordmark({ tone = 'white', className = '' }) {
  const color = tone === 'white' ? '#feffff' : '#008aff';
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label="Cooltra">
      <span
        className="font-extra tracking-tight text-[1.05rem] leading-none"
        style={{ color }}
      >
        cooltra
      </span>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: '#05e100' }}
        aria-hidden="true"
      />
    </div>
  );
}

function BrandFooter({ tone = 'white' }) {
  const color = tone === 'white' ? '#feffff' : '#008aff';
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-5 flex items-end justify-between">
      <span
        className="font-extra uppercase tracking-[0.18em] text-xs sm:text-sm"
        style={{ color }}
      >
        Time to Ride
      </span>
      <CooltraWordmark tone={tone} />
    </div>
  );
}

export default function CooltraAIQuiz() {
  const [mode, setMode] = useState(null);
  const participantIdRef = useRef(`p_${Math.random().toString(36).slice(2, 9)}`);
  const [state, setState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasVoted, setHasVoted] = useState({});
  const writingRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchState();
        if (active) setState(s);
      } catch (e) {
        console.warn('Initial fetch failed:', e.message);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (writingRef.current) return;
      try {
        const s = await fetchState();
        setState(s);
        if (error) setError(null);
      } catch (e) {
        // silent fail
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [error]);

  const safeUpdate = async (updaterFn) => {
    writingRef.current = true;
    try {
      const latest = await fetchState();
      const next = updaterFn(latest);
      await writeState(next);
      setState(next);
    } catch (e) {
      setError(e.message);
    } finally {
      writingRef.current = false;
    }
  };

  const joinAsParticipant = async () => {
    setMode('participant');
    await safeUpdate((latest) => {
      if (latest.participants.includes(participantIdRef.current)) return latest;
      return { ...latest, participants: [...latest.participants, participantIdRef.current] };
    });
  };

  const submitVote = async (optionIndex) => {
    const qId = QUESTIONS[state.currentQuestion].id;
    if (hasVoted[qId] !== undefined) return;
    setHasVoted({ ...hasVoted, [qId]: optionIndex });
    await safeUpdate((latest) => {
      const currentVotes = latest.votes[qId] || {};
      return {
        ...latest,
        votes: {
          ...latest.votes,
          [qId]: { ...currentVotes, [participantIdRef.current]: optionIndex },
        },
      };
    });
  };

  const showResults = async () => {
    await safeUpdate((latest) => ({ ...latest, showResults: true }));
  };

  const nextQuestion = async () => {
    await safeUpdate((latest) => ({
      ...latest,
      currentQuestion: latest.currentQuestion + 1,
      showResults: false,
    }));
  };

  const resetQuiz = async () => {
    if (!window.confirm('¿Seguro que quieres reiniciar el quiz? Se perderán todos los votos.')) return;
    setHasVoted({});
    await safeUpdate(() => ({ ...DEFAULT_STATE }));
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-cooltra-blue flex items-center justify-center">
        <div className="text-cooltra-white/80 text-sm font-semi">Cargando…</div>
        <BrandFooter tone="white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen bg-cooltra-blue flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-cooltra-white rounded-cooltra p-8 shadow-cooltra">
          <AlertCircle className="w-12 h-12 text-cooltra-orange mx-auto mb-4" />
          <h2 className="font-extra text-cooltra-blue text-2xl mb-2">Problema de conexión</h2>
          <p className="text-cooltra-dark/70 text-sm mb-5">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-5 py-2.5 bg-cooltra-blue hover:bg-cooltra-dark text-cooltra-white rounded-full text-sm font-semi transition"
          >
            Continuar igualmente
          </button>
        </div>
        <BrandFooter tone="white" />
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="relative min-h-screen bg-cooltra-blue overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(254,255,255,0.18), transparent)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(5,225,0,0.18), transparent)' }}
        />

        <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-20">
          <div className="max-w-3xl w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cooltra-white/15 border border-cooltra-white/30 backdrop-blur-sm mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-cooltra-green animate-pulse" />
              <span className="text-cooltra-white text-xs font-semi uppercase tracking-[0.18em]">
                Cooltra · Equipo Directivo
              </span>
            </div>

            <h1 className="font-extra text-cooltra-white text-5xl md:text-7xl leading-[0.95] mb-5">
              Empujando Cooltra<br />hacia la AI.
            </h1>
            <p className="text-cooltra-white/90 text-lg md:text-xl mb-12 max-w-xl">
              Quiz inicial · 7 preguntas para entender en qué punto estamos antes de empezar el taller.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setMode('presenter')}
                className="group bg-cooltra-white rounded-cooltra p-8 text-left transition hover:-translate-y-1 hover:shadow-cooltra"
              >
                <div className="w-12 h-12 rounded-2xl bg-cooltra-blue/10 flex items-center justify-center mb-5 group-hover:bg-cooltra-blue group-hover:text-cooltra-white transition">
                  <Monitor className="w-6 h-6 text-cooltra-blue group-hover:text-cooltra-white transition" />
                </div>
                <h2 className="font-extra text-cooltra-blue text-2xl mb-2">Pantalla del presentador</h2>
                <p className="text-cooltra-dark/70 text-sm">Proyecta esto en la sala. Controla el avance del quiz y muestra los resultados.</p>
              </button>

              <button
                onClick={joinAsParticipant}
                className="group bg-cooltra-dark rounded-cooltra p-8 text-left transition hover:-translate-y-1 hover:shadow-cooltra"
              >
                <div className="w-12 h-12 rounded-2xl bg-cooltra-white/10 flex items-center justify-center mb-5">
                  <Smartphone className="w-6 h-6 text-cooltra-white" />
                </div>
                <h2 className="font-extra text-cooltra-white text-2xl mb-2">Unirme como participante</h2>
                <p className="text-cooltra-light text-sm">Abre esto en tu móvil para votar. Tus respuestas son anónimas.</p>
              </button>
            </div>

            <p className="text-cooltra-white/70 text-xs mt-10 font-semi uppercase tracking-[0.18em]">
              Pregunta {state.currentQuestion + 1} · {state.participants.length} participantes conectados
            </p>
          </div>
        </div>

        <BrandFooter tone="white" />
      </div>
    );
  }

  const isFinished = state.currentQuestion >= QUESTIONS.length;
  const currentQ = QUESTIONS[state.currentQuestion];
  const currentVotes = currentQ ? (state.votes[currentQ.id] || {}) : {};
  const voteCount = Object.keys(currentVotes).length;
  const optionCounts = currentQ
    ? currentQ.options.map((_, i) => Object.values(currentVotes).filter(v => v === i).length)
    : [];

  if (mode === 'presenter') {
    if (isFinished) {
      return (
        <div className="relative min-h-screen bg-cooltra-blue p-6 md:p-10 pb-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cooltra-white/15 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-cooltra-green" />
                </div>
                <h1 className="font-extra text-cooltra-white text-3xl md:text-4xl">Resumen del Quiz</h1>
              </div>
              <button
                onClick={resetQuiz}
                className="flex items-center gap-2 px-4 py-2 bg-cooltra-white/15 hover:bg-cooltra-white/25 border border-cooltra-white/30 rounded-full text-cooltra-white text-sm font-semi transition"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {QUESTIONS.map((q) => {
                const qVotes = state.votes[q.id] || {};
                const counts = q.options.map((_, i) => Object.values(qVotes).filter(v => v === i).length);
                const total = counts.reduce((a, b) => a + b, 0) || 1;
                const max = Math.max(...counts);
                const winnerIdx = counts.indexOf(max);

                return (
                  <div key={q.id} className="bg-cooltra-white rounded-cooltra p-6">
                    <div className="text-xs text-cooltra-blue font-semi uppercase tracking-[0.18em] mb-2">
                      Pregunta {q.id}
                    </div>
                    <h3 className="font-extra text-cooltra-dark text-base leading-snug mb-4">{q.question}</h3>
                    <div className="space-y-3">
                      {q.options.map((opt, i) => {
                        const pct = (counts[i] / total) * 100;
                        const isWinner = max > 0 && i === winnerIdx;
                        const color = COOLTRA_PALETTE[i % COOLTRA_PALETTE.length];
                        return (
                          <div key={i}>
                            <div className="flex items-center gap-2 text-xs mb-1.5">
                              <span className="text-base leading-none">{opt.emoji}</span>
                              <span className={`flex-1 truncate ${isWinner ? 'text-cooltra-dark font-semi' : 'text-cooltra-dark/70'}`}>
                                {opt.text}
                              </span>
                              <span className={`font-extra ${isWinner ? 'text-cooltra-blue' : 'text-cooltra-dark/50'}`}>
                                {counts[i]}
                              </span>
                            </div>
                            <div className="h-2 bg-cooltra-light/30 rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all duration-700 rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 text-center text-cooltra-white/85 font-semi text-sm uppercase tracking-[0.18em]">
              {state.participants.length} participantes han votado
            </div>
          </div>
          <BrandFooter tone="white" />
        </div>
      );
    }

    return (
      <div className="relative min-h-screen bg-cooltra-blue p-6 md:p-10 pb-20 flex flex-col">
        <div className="flex items-center justify-between mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-cooltra-white text-cooltra-blue text-xs font-extra uppercase tracking-[0.18em]">
              Pregunta {state.currentQuestion + 1} / {QUESTIONS.length}
            </div>
            <div className="flex items-center gap-2 text-cooltra-white/90 text-sm font-semi">
              <Users className="w-4 h-4" />
              {state.participants.length} conectados
            </div>
            <div className="flex items-center gap-2 text-cooltra-white/90 text-sm font-semi">
              <BarChart3 className="w-4 h-4" />
              {voteCount} votos
            </div>
          </div>
          <button
            onClick={resetQuiz}
            className="flex items-center gap-2 px-3 py-1.5 bg-cooltra-white/15 hover:bg-cooltra-white/25 border border-cooltra-white/30 rounded-full text-cooltra-white text-xs font-semi transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
          <h2 className="font-extra text-cooltra-white text-4xl md:text-6xl text-center leading-[1.02] mb-12">
            {currentQ.question}
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {currentQ.options.map((opt, i) => {
              const count = optionCounts[i];
              const pct = voteCount > 0 ? (count / voteCount) * 100 : 0;
              const color = COOLTRA_PALETTE[i % COOLTRA_PALETTE.length];
              return (
                <div
                  key={i}
                  className="relative bg-cooltra-white rounded-cooltra p-6 overflow-hidden shadow-cooltra"
                >
                  {state.showResults && (
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.18 }}
                    />
                  )}
                  <div className="relative flex items-center gap-4">
                    <span className="text-4xl leading-none">{opt.emoji}</span>
                    <span className="text-cooltra-dark text-lg flex-1 font-semi">{opt.text}</span>
                    {state.showResults && (
                      <div className="text-right">
                        <div className="font-extra text-cooltra-blue text-3xl leading-none">{count}</div>
                        <div className="text-cooltra-dark/60 text-xs font-semi">{pct.toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.showResults && (
            <div className="bg-cooltra-dark rounded-cooltra p-5 mb-8 flex items-start gap-3 border border-cooltra-white/10">
              <Zap className="w-5 h-5 text-cooltra-green flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-cooltra-green text-xs font-extra uppercase tracking-[0.18em] mb-1">
                  Objetivo de esta pregunta
                </div>
                <div className="text-cooltra-white">{currentQ.objective}</div>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            {!state.showResults ? (
              <button
                onClick={showResults}
                className="px-8 py-3.5 bg-cooltra-white text-cooltra-blue font-extra rounded-full transition flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-cooltra"
              >
                <BarChart3 className="w-5 h-5" />
                Mostrar resultados
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="px-8 py-3.5 bg-cooltra-white text-cooltra-blue font-extra rounded-full transition flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-cooltra"
              >
                {state.currentQuestion < QUESTIONS.length - 1 ? 'Siguiente pregunta' : 'Ver resumen'}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <BrandFooter tone="white" />
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="relative min-h-screen bg-cooltra-blue flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-cooltra-white/15 mx-auto mb-5 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-cooltra-green" />
          </div>
          <h1 className="font-extra text-cooltra-white text-4xl mb-3">¡Gracias por participar!</h1>
          <p className="text-cooltra-white/85">Mira la pantalla principal para ver el resumen.</p>
        </div>
        <BrandFooter tone="white" />
      </div>
    );
  }

  const myVote = hasVoted[currentQ.id];
  const showingResults = state.showResults;

  return (
    <div className="relative min-h-screen bg-cooltra-white p-4 pb-24 flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6 pt-3">
          <div className="px-3 py-1 rounded-full bg-cooltra-blue text-cooltra-white text-xs font-extra uppercase tracking-[0.18em]">
            Pregunta {state.currentQuestion + 1} / {QUESTIONS.length}
          </div>
          <div className="text-cooltra-dark/60 text-xs font-semi uppercase tracking-[0.14em]">Voto anónimo</div>
        </div>

        <h2 className="font-extra text-cooltra-blue text-3xl mb-8 leading-tight">
          {currentQ.question}
        </h2>

        <div className="space-y-3 flex-1">
          {currentQ.options.map((opt, i) => {
            const isMyVote = myVote === i;
            const count = optionCounts[i];
            const pct = voteCount > 0 ? (count / voteCount) * 100 : 0;
            const disabled = myVote !== undefined;
            const color = COOLTRA_PALETTE[i % COOLTRA_PALETTE.length];

            return (
              <button
                key={i}
                onClick={() => submitVote(i)}
                disabled={disabled}
                className={`relative w-full text-left rounded-cooltra p-5 overflow-hidden transition-all border-2 ${
                  isMyVote
                    ? 'bg-cooltra-blue border-cooltra-blue'
                    : disabled
                    ? 'bg-cooltra-light/20 border-cooltra-light/30 opacity-70'
                    : 'bg-cooltra-white border-cooltra-light/40 hover:border-cooltra-blue active:scale-[0.98]'
                }`}
              >
                {showingResults && !isMyVote && (
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.18 }}
                  />
                )}
                <div className="relative flex items-center gap-3">
                  <span className="text-3xl leading-none">{opt.emoji}</span>
                  <span className={`flex-1 font-semi ${isMyVote ? 'text-cooltra-white' : 'text-cooltra-dark'}`}>
                    {opt.text}
                  </span>
                  {showingResults && (
                    <span className={`font-extra text-sm ${isMyVote ? 'text-cooltra-white' : 'text-cooltra-blue'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                  {isMyVote && !showingResults && (
                    <span className="text-cooltra-white text-xs font-extra uppercase tracking-[0.18em]">
                      Tu voto
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {myVote !== undefined && !showingResults && (
          <div className="text-center text-cooltra-dark/70 text-sm font-semi mt-6 mb-2">
            Voto registrado. Esperando al presentador…
          </div>
        )}
      </div>
      <BrandFooter tone="blue" />
    </div>
  );
}
