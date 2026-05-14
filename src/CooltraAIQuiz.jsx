import React, { useState, useEffect, useRef } from 'react';
import { Users, ChevronRight, RotateCcw, Monitor, Smartphone, Trophy, BarChart3, AlertCircle } from 'lucide-react';

const QUESTIONS = [
  {
    id: 1,
    question: "¿Con qué frecuencia usas herramientas de AI en tu trabajo?",
    objective: "Tener un baseline real del grupo sin que nadie se sienta juzgado.",
    options: [
      { emoji: "🔴", text: "Nunca la he usado", color: "bg-red-500" },
      { emoji: "🟡", text: "La he probado alguna vez", color: "bg-yellow-500" },
      { emoji: "🟢", text: "La uso ocasionalmente (1-2 veces por semana)", color: "bg-green-500" },
      { emoji: "🔵", text: "La uso a diario", color: "bg-blue-500" },
    ]
  },
  {
    id: 2,
    question: "¿Para qué has usado más la AI hasta ahora?",
    objective: "Entender los casos de uso reales y construir ejemplos relevantes durante el taller.",
    options: [
      { emoji: "✍️", text: "Redactar o resumir textos", color: "bg-purple-500" },
      { emoji: "🔍", text: "Buscar información / investigar", color: "bg-indigo-500" },
      { emoji: "💡", text: "Generar ideas o hacer brainstorming", color: "bg-amber-500" },
      { emoji: "🤷", text: "Aún no la he usado para nada concreto", color: "bg-slate-500" },
    ]
  },
  {
    id: 3,
    question: "¿Cuál es tu mayor miedo respecto a la AI en el trabajo?",
    objective: "Identificar las resistencias antes de que el CPO las aborde en el taller.",
    options: [
      { emoji: "🤖", text: "Que reemplace mi puesto o el de mi equipo", color: "bg-rose-500" },
      { emoji: "🔒", text: "Que comprometa datos confidenciales", color: "bg-orange-500" },
      { emoji: "❌", text: "Que dé información incorrecta y no me dé cuenta", color: "bg-fuchsia-500" },
      { emoji: "😕", text: "No le tengo miedo, pero tampoco sé cómo sacarle partido", color: "bg-cyan-500" },
    ]
  },
  {
    id: 4,
    question: "¿Cómo describes tu nivel de confianza usando AI hoy?",
    objective: "Segmentar el grupo para que el CPO ajuste el nivel de profundidad del taller.",
    options: [
      { emoji: "🐣", text: "Soy un completo principiante", color: "bg-yellow-500" },
      { emoji: "🚶", text: "Sé lo básico, pero me falta seguridad", color: "bg-orange-500" },
      { emoji: "🏃", text: "Me defiendo bastante bien", color: "bg-green-500" },
      { emoji: "🚀", text: "Podría enseñarle a otros", color: "bg-blue-500" },
    ]
  },
  {
    id: 5,
    question: "¿Qué herramienta te resulta más familiar a día de hoy?",
    objective: "Conocer el ecosistema de herramientas que ya está en uso para construir sobre lo que existe.",
    options: [
      { emoji: "💬", text: "ChatGPT", color: "bg-emerald-500" },
      { emoji: "🧡", text: "Claude", color: "bg-orange-500" },
      { emoji: "🪟", text: "Copilot (Microsoft)", color: "bg-blue-500" },
      { emoji: "🔧", text: "Otras / Ninguna", color: "bg-slate-500" },
    ]
  },
  {
    id: 6,
    question: "¿Qué te frena hoy a usar más la AI en tu día a día?",
    objective: "Detectar barreras concretas que la organización puede resolver (formación, política de datos, licencias).",
    options: [
      { emoji: "⏰", text: "No tengo tiempo para aprender a usarla bien", color: "bg-red-500" },
      { emoji: "🤔", text: "No sé qué tareas delegarle", color: "bg-purple-500" },
      { emoji: "🔐", text: "Restricciones o dudas sobre qué puedo compartir", color: "bg-amber-500" },
      { emoji: "💸", text: "No tengo acceso a las herramientas adecuadas", color: "bg-teal-500" },
    ]
  },
  {
    id: 7,
    question: "Si la AI fuera un compañero de trabajo, ¿cuál sería hoy?",
    objective: "Terminar con humor, generar conversación y que la sala se relaje antes de entrar al contenido.",
    options: [
      { emoji: "👀", text: "El becario nuevo — lo observo pero no le doy trabajo", color: "bg-yellow-500" },
      { emoji: "🤝", text: "El colega al que le consulto cosas de vez en cuando", color: "bg-green-500" },
      { emoji: "🧠", text: "Mi asistente de confianza al que delego tareas", color: "bg-blue-500" },
      { emoji: "👑", text: "Mi copiloto — trabajamos juntos en casi todo", color: "bg-purple-500" },
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Problema de conexión</h2>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm"
          >
            Continuar igualmente
          </button>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-10">
            <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-4 border border-emerald-500/20">
              Cooltra · Equipo Directivo
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Empujando Cooltra hacia la AI
            </h1>
            <p className="text-slate-400 text-lg">Quiz inicial · 7 preguntas</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('presenter')}
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-8 text-left transition-all"
            >
              <Monitor className="w-10 h-10 text-emerald-400 mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Pantalla del presentador</h2>
              <p className="text-slate-400 text-sm">Proyecta esto en la sala. Controla el avance del quiz y muestra los resultados.</p>
            </button>

            <button
              onClick={joinAsParticipant}
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/50 rounded-2xl p-8 text-left transition-all"
            >
              <Smartphone className="w-10 h-10 text-orange-400 mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Unirme como participante</h2>
              <p className="text-slate-400 text-sm">Abre esto en tu móvil para votar. Tus respuestas son anónimas.</p>
            </button>
          </div>

          <p className="text-center text-slate-500 text-xs mt-8">
            Estado actual: pregunta {state.currentQuestion + 1} · {state.participants.length} participantes conectados
          </p>
        </div>
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-400" />
                <h1 className="text-3xl font-bold text-white">Resumen del Quiz</h1>
              </div>
              <button
                onClick={resetQuiz}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-sm transition"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {QUESTIONS.map((q) => {
                const qVotes = state.votes[q.id] || {};
                const counts = q.options.map((_, i) => Object.values(qVotes).filter(v => v === i).length);
                const total = counts.reduce((a, b) => a + b, 0) || 1;
                const max = Math.max(...counts);
                const winnerIdx = counts.indexOf(max);

                return (
                  <div key={q.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="text-xs text-slate-500 mb-1">Pregunta {q.id}</div>
                    <h3 className="text-white font-semibold mb-4 text-sm leading-tight">{q.question}</h3>
                    <div className="space-y-2">
                      {q.options.map((opt, i) => {
                        const pct = (counts[i] / total) * 100;
                        const isWinner = max > 0 && i === winnerIdx;
                        return (
                          <div key={i} className="relative">
                            <div className="flex items-center gap-2 text-xs mb-1">
                              <span>{opt.emoji}</span>
                              <span className={`flex-1 truncate ${isWinner ? 'text-white font-medium' : 'text-slate-400'}`}>{opt.text}</span>
                              <span className={isWinner ? 'text-white font-bold' : 'text-slate-500'}>{counts[i]}</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${opt.color} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
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

            <div className="mt-8 text-center text-slate-500 text-sm">
              {state.participants.length} participantes han votado
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
              Pregunta {state.currentQuestion + 1} / {QUESTIONS.length}
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Users className="w-4 h-4" />
              {state.participants.length} conectados
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <BarChart3 className="w-4 h-4" />
              {voteCount} votos
            </div>
          </div>
          <button
            onClick={resetQuiz}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 text-xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-12 leading-tight">
            {currentQ.question}
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {currentQ.options.map((opt, i) => {
              const count = optionCounts[i];
              const pct = voteCount > 0 ? (count / voteCount) * 100 : 0;
              return (
                <div
                  key={i}
                  className="relative bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden"
                >
                  {state.showResults && (
                    <div
                      className={`absolute inset-0 ${opt.color} opacity-20 transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="relative flex items-center gap-4">
                    <span className="text-4xl">{opt.emoji}</span>
                    <span className="text-white text-lg flex-1">{opt.text}</span>
                    {state.showResults && (
                      <div className="text-right">
                        <div className="text-3xl font-bold text-white">{count}</div>
                        <div className="text-xs text-slate-400">{pct.toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.showResults && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <div className="text-amber-400 text-xs font-medium uppercase tracking-wider mb-1">Objetivo de esta pregunta</div>
              <div className="text-amber-100">{currentQ.objective}</div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            {!state.showResults ? (
              <button
                onClick={showResults}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                Mostrar resultados
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition flex items-center gap-2"
              >
                {state.currentQuestion < QUESTIONS.length - 1 ? 'Siguiente pregunta' : 'Ver resumen'}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">¡Gracias por participar!</h1>
          <p className="text-slate-400">Mira la pantalla principal para ver el resumen.</p>
        </div>
      </div>
    );
  }

  const myVote = hasVoted[currentQ.id];
  const showingResults = state.showResults;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 flex flex-col">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="text-emerald-400 text-sm font-medium">
            Pregunta {state.currentQuestion + 1} / {QUESTIONS.length}
          </div>
          <div className="text-slate-500 text-xs">Voto anónimo</div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-8 leading-tight">
          {currentQ.question}
        </h2>

        <div className="space-y-3 flex-1">
          {currentQ.options.map((opt, i) => {
            const isMyVote = myVote === i;
            const count = optionCounts[i];
            const pct = voteCount > 0 ? (count / voteCount) * 100 : 0;
            const disabled = myVote !== undefined;

            return (
              <button
                key={i}
                onClick={() => submitVote(i)}
                disabled={disabled}
                className={`relative w-full text-left rounded-2xl p-5 overflow-hidden transition-all ${
                  isMyVote
                    ? 'bg-white/10 border-2 border-emerald-400'
                    : disabled
                    ? 'bg-white/5 border border-white/10 opacity-60'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95'
                }`}
              >
                {showingResults && (
                  <div
                    className={`absolute inset-0 ${opt.color} opacity-20 transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center gap-3">
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-white flex-1">{opt.text}</span>
                  {showingResults && (
                    <span className="text-white font-bold text-sm">{pct.toFixed(0)}%</span>
                  )}
                  {isMyVote && !showingResults && (
                    <span className="text-emerald-400 text-xs font-medium">Tu voto</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {myVote !== undefined && !showingResults && (
          <div className="text-center text-slate-400 text-sm mt-6 mb-2">
            Voto registrado. Esperando al presentador...
          </div>
        )}
      </div>
    </div>
  );
}
