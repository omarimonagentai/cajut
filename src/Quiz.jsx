import React, { useState, useEffect, useRef } from 'react';
import { Users, ChevronRight, RotateCcw, Monitor, Smartphone, Trophy, BarChart3, AlertCircle, Zap, Copy, Check, Lock, LogOut, FileDown, Share2, FileText, Image as ImageIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const PALETTE = ['#008aff', '#052f62', '#ec6e24', '#05e100'];

const BIN_ID = import.meta.env.VITE_JSONBIN_ID || "6a04316d250b1311c342ab9a";
const API_KEY = import.meta.env.VITE_JSONBIN_KEY || "";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const POLL_INTERVAL_MS = 2000;

const EMPTY_GAME_STATE = {
  currentQuestion: 0,
  showResults: false,
  votes: {},
  participants: [],
  sessionId: 0,
  started: false,
};

function gameSliceFromRecord(record, gameId) {
  const games = record?.games || {};
  const slice = games[gameId];
  if (!slice) return EMPTY_GAME_STATE;
  const rawParticipants = Array.isArray(slice.participants) ? slice.participants : [];
  const participants = [...new Set(rawParticipants.filter(Boolean))];
  return { ...EMPTY_GAME_STATE, ...slice, participants };
}

function getOrCreateParticipantId(gameId) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return `p_${Math.random().toString(36).slice(2, 9)}`;
  }
  const key = `cajut:participant:${gameId}`;
  try {
    let id = window.sessionStorage.getItem(key);
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2, 9)}`;
      window.sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `p_${Math.random().toString(36).slice(2, 9)}`;
  }
}

async function fetchAllStates() {
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
    const record = data.record || {};
    return { games: record.games && typeof record.games === 'object' ? record.games : {} };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function writeAllStates(record) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(BIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(record),
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

function buildParticipantUrl(gameId) {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?game=${encodeURIComponent(gameId)}`;
}

function clearAuthFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('ctrl');
  url.searchParams.delete('game');
  window.history.replaceState({}, '', url.toString());
}

function Wordmark({ branding, tone = 'white', className = '' }) {
  if (!branding?.wordmark) return null;
  const color = tone === 'white' ? '#feffff' : '#008aff';
  const accent = branding.wordmarkAccentColor;
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label={branding.wordmark}>
      <span
        className="font-extra tracking-tight text-[1.05rem] leading-none"
        style={{ color }}
      >
        {branding.wordmark}
      </span>
      {accent && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function BrandFooter({ branding, tone = 'white' }) {
  if (!branding || (!branding.tagline && !branding.wordmark)) return null;
  const color = tone === 'white' ? '#feffff' : '#008aff';
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-5 flex items-end justify-between">
      {branding.tagline ? (
        <span
          className="font-extra uppercase tracking-[0.18em] text-xs sm:text-sm"
          style={{ color }}
        >
          {branding.tagline}
        </span>
      ) : <span />}
      <Wordmark branding={branding} tone={tone} />
    </div>
  );
}

function tallyCounts(question, votes) {
  return question.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
}

function formatResultsAsText(game, questions, state) {
  const lines = [
    game.title,
    `Participantes: ${state.participants.length}`,
    `Fecha: ${new Date().toLocaleString('es-ES')}`,
    '',
  ];
  for (const q of questions) {
    const votes = state.votes[q.id] || {};
    const counts = tallyCounts(q, votes);
    const total = counts.reduce((a, b) => a + b, 0);
    lines.push(`P${q.id}. ${q.question}`);
    q.options.forEach((opt, i) => {
      const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
      lines.push(`  ${opt.emoji} ${opt.text} — ${counts[i]} votos (${pct}%)`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function formatResultsAsCsv(questions, state) {
  const rows = [['pregunta_id', 'pregunta', 'opcion', 'votos', 'porcentaje']];
  for (const q of questions) {
    const votes = state.votes[q.id] || {};
    const counts = tallyCounts(q, votes);
    const total = counts.reduce((a, b) => a + b, 0);
    q.options.forEach((opt, i) => {
      const pct = total > 0 ? ((counts[i] / total) * 100).toFixed(1) : '0';
      rows.push([String(q.id), q.question, opt.text, String(counts[i]), pct]);
    });
  }
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ShareLinkRow({ label, url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };
  return (
    <div className="flex items-center gap-2 bg-cooltra-white/10 border border-cooltra-white/20 rounded-2xl px-3 py-2">
      <span className="text-cooltra-white/70 text-[10px] font-extra uppercase tracking-[0.18em] w-20 shrink-0">
        {label}
      </span>
      <span className="flex-1 text-cooltra-white text-xs font-semi truncate" title={url}>
        {url}
      </span>
      <button
        onClick={copy}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cooltra-white text-cooltra-blue text-[11px] font-extra uppercase tracking-[0.12em] hover:bg-cooltra-light transition"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length * lineHeight;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function renderResultsCanvas(game, questions, state) {
  const width = 1200;
  const margin = 60;
  const cardPad = 32;
  const optionRowH = 76;
  const headerH = 220;
  const branding = game.branding;
  const hasFooter = branding && (branding.tagline || branding.wordmark);
  const footerH = hasFooter ? 100 : 40;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = 'bold 26px Arial, sans-serif';

  const sections = questions.map((q) => {
    const innerW = width - margin * 2 - cardPad * 2;
    const titleLines = [];
    {
      const words = q.question.split(/\s+/);
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (measureCtx.measureText(test).width > innerW - 80 && line) {
          titleLines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) titleLines.push(line);
    }
    const titleH = titleLines.length * 32 + 8;
    const optionsH = q.options.length * optionRowH;
    const cardH = cardPad * 2 + titleH + 16 + optionsH;
    return { question: q, cardH };
  });

  const totalQuestionsH = sections.reduce((sum, s) => sum + s.cardH + 24, 0);
  const height = headerH + totalQuestionsH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#008aff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#feffff';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(game.title, margin, margin);

  ctx.font = '28px Arial, sans-serif';
  ctx.fillStyle = 'rgba(254,255,255,0.92)';
  ctx.fillText(
    `Resumen del quiz · ${state.participants.length} participantes · ${new Date().toLocaleDateString('es-ES')}`,
    margin,
    margin + 76,
  );

  let y = headerH;
  sections.forEach(({ question: q, cardH }) => {
    drawRoundedRect(ctx, margin, y, width - margin * 2, cardH, 28);
    ctx.fillStyle = '#feffff';
    ctx.fill();

    ctx.fillStyle = '#008aff';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(`PREGUNTA ${q.id}`, margin + cardPad, y + cardPad);

    ctx.fillStyle = '#052f62';
    ctx.font = 'bold 26px Arial, sans-serif';
    const titleHeight = wrapText(
      ctx,
      q.question,
      margin + cardPad,
      y + cardPad + 28,
      width - margin * 2 - cardPad * 2,
      32,
    );

    const votes = state.votes[q.id] || {};
    const counts = tallyCounts(q, votes);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const max = Math.max(...counts);
    const optionsY0 = y + cardPad + 28 + titleHeight + 16;
    const barX = margin + cardPad;
    const barW = width - margin * 2 - cardPad * 2;

    q.options.forEach((opt, i) => {
      const optY = optionsY0 + i * optionRowH;
      const pct = (counts[i] / total) * 100;
      const isWinner = max > 0 && counts[i] === max;
      const color = PALETTE[i % PALETTE.length];

      drawRoundedRect(ctx, barX, optY + 28, barW, 28, 14);
      ctx.fillStyle = 'rgba(142,200,255,0.35)';
      ctx.fill();

      drawRoundedRect(ctx, barX, optY + 28, Math.max(28, (barW * pct) / 100), 28, 14);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = '#052f62';
      ctx.font = `${isWinner ? 'bold ' : ''}22px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(opt.text, barX, optY + 2);

      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = isWinner ? '#008aff' : '#052f62';
      ctx.fillText(`${counts[i]} · ${pct.toFixed(0)}%`, barX + barW, optY + 2);
      ctx.textAlign = 'left';
    });

    y += cardH + 24;
  });

  if (hasFooter) {
    ctx.fillStyle = '#feffff';
    ctx.textAlign = 'left';
    if (branding.tagline) {
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText(branding.tagline.toUpperCase(), margin, height - footerH + 30);
    }
    if (branding.wordmark) {
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(branding.wordmark, width - margin - 24, height - footerH + 28);
      if (branding.wordmarkAccentColor) {
        ctx.beginPath();
        ctx.arc(width - margin - 6, height - footerH + 42, 8, 0, Math.PI * 2);
        ctx.fillStyle = branding.wordmarkAccentColor;
        ctx.fill();
      }
    }
  }

  return canvas;
}

function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Canvas export failed'));
      else resolve(blob);
    }, type);
  });
}

function ResultsActions({ game, questions, state }) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [busy, setBusy] = useState(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const timestamp = new Date().toISOString().slice(0, 10);
  const baseFilename = `quiz-${game.id}-${timestamp}`;

  const text = formatResultsAsText(game, questions, state);
  const csv = formatResultsAsCsv(questions, state);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setShareError('No se pudo copiar al portapapeles.');
    }
  };

  const downloadCsv = () => {
    downloadBlob(csv, `${baseFilename}.csv`, 'text/csv;charset=utf-8');
  };

  const downloadPng = async () => {
    setShareError(null);
    setBusy('png');
    try {
      const canvas = renderResultsCanvas(game, questions, state);
      const blob = await canvasToBlob(canvas, 'image/png');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseFilename}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (e) {
      setShareError('No se pudo generar el PNG.');
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setShareError(null);
    setBusy('pdf');
    try {
      const canvas = renderResultsCanvas(game, questions, state);
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
        hotfixes: ['px_scaling'],
      });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${baseFilename}.pdf`);
    } catch (e) {
      setShareError('No se pudo generar el PDF.');
    } finally {
      setBusy(null);
    }
  };

  const downloadJson = () => {
    const payload = {
      gameId: game.id,
      title: game.title,
      generatedAt: new Date().toISOString(),
      participants: state.participants.length,
      questions: questions.map((q) => {
        const votes = state.votes[q.id] || {};
        const counts = tallyCounts(q, votes);
        const total = counts.reduce((a, b) => a + b, 0);
        return {
          id: q.id,
          question: q.question,
          objective: q.objective,
          totalVotes: total,
          options: q.options.map((opt, i) => ({
            text: opt.text,
            emoji: opt.emoji,
            votes: counts[i],
            percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0,
          })),
        };
      }),
    };
    downloadBlob(JSON.stringify(payload, null, 2), `${baseFilename}.json`, 'application/json');
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${game.title} · Resultados`,
        text,
      });
    } catch (e) {
      if (e?.name !== 'AbortError') setShareError('No se pudo abrir el menú de compartir.');
    }
  };

  return (
    <div className="mt-8 rounded-cooltra bg-cooltra-white text-cooltra-dark p-5 md:p-6 shadow-cooltra">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-cooltra-blue/10 flex items-center justify-center shrink-0">
          <FileDown className="w-5 h-5 text-cooltra-blue" />
        </div>
        <div>
          <h3 className="font-extra text-cooltra-blue text-lg leading-tight">Guardar o compartir resultados</h3>
          <p className="text-cooltra-dark/70 text-sm mt-0.5">
            Descarga los datos para el informe o cópialos para pegarlos en Slack, email o Notion.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <button
          onClick={downloadPdf}
          disabled={busy === 'pdf'}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-blue hover:bg-cooltra-dark text-cooltra-white rounded-full text-sm font-extra transition disabled:opacity-60"
        >
          <FileText className="w-4 h-4" />
          {busy === 'pdf' ? 'Generando…' : 'Descargar PDF'}
        </button>
        <button
          onClick={downloadPng}
          disabled={busy === 'png'}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-dark hover:bg-cooltra-deep text-cooltra-white rounded-full text-sm font-extra transition disabled:opacity-60"
        >
          <ImageIcon className="w-4 h-4" />
          {busy === 'png' ? 'Generando…' : 'Gráfica PNG'}
        </button>
        <button
          onClick={copyText}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-light/60 hover:bg-cooltra-light text-cooltra-dark rounded-full text-sm font-extra transition"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado' : 'Copiar resumen'}
        </button>
        <button
          onClick={downloadCsv}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-light/40 hover:bg-cooltra-light/70 text-cooltra-dark rounded-full text-sm font-extra transition"
        >
          <FileDown className="w-4 h-4" />
          Descargar CSV
        </button>
        <button
          onClick={downloadJson}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-light/40 hover:bg-cooltra-light/70 text-cooltra-dark rounded-full text-sm font-extra transition"
        >
          <FileDown className="w-4 h-4" />
          Descargar JSON
        </button>
        {canNativeShare ? (
          <button
            onClick={nativeShare}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-orange hover:bg-cooltra-orange/80 text-cooltra-white rounded-full text-sm font-extra transition"
          >
            <Share2 className="w-4 h-4" />
            Compartir…
          </button>
        ) : (
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cooltra-orange hover:bg-cooltra-orange/80 text-cooltra-white rounded-full text-sm font-extra transition"
          >
            <Share2 className="w-4 h-4" />
            Imprimir
          </button>
        )}
      </div>

      {shareError && (
        <p className="text-cooltra-orange text-xs font-semi mt-3">{shareError}</p>
      )}
    </div>
  );
}

export default function Quiz({ game, questions, role, onExit }) {
  const branding = game.branding;
  const gameId = game.id;
  const [initialParticipantId] = useState(() => getOrCreateParticipantId(gameId));
  const participantIdRef = useRef(initialParticipantId);
  const registeredRef = useRef(false);
  const sessionIdRef = useRef(null);
  const [state, setState] = useState(EMPTY_GAME_STATE);
  const [error, setError] = useState(null);
  const [hasVoted, setHasVoted] = useState({});
  const writingRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const record = await fetchAllStates();
        if (active) setState(gameSliceFromRecord(record, gameId));
      } catch (e) {
        console.warn('Initial fetch failed:', e.message);
      }
    })();
    return () => { active = false; };
  }, [gameId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (writingRef.current) return;
      try {
        const record = await fetchAllStates();
        setState(gameSliceFromRecord(record, gameId));
        if (error) setError(null);
      } catch (e) {
        // silent fail
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [error, gameId]);

  const safeUpdate = async (updaterFn) => {
    writingRef.current = true;
    try {
      const record = await fetchAllStates();
      const currentSlice = gameSliceFromRecord(record, gameId);
      const nextSlice = updaterFn(currentSlice);
      const nextRecord = {
        ...record,
        games: { ...record.games, [gameId]: nextSlice },
      };
      await writeAllStates(nextRecord);
      setState(nextSlice);
    } catch (e) {
      setError(e.message);
    } finally {
      writingRef.current = false;
    }
  };

  useEffect(() => {
    if (sessionIdRef.current !== null) return;
    (async () => {
      try {
        const record = await fetchAllStates();
        const slice = gameSliceFromRecord(record, gameId);
        sessionIdRef.current = slice.sessionId ?? 0;
        if (role === 'participant' && !registeredRef.current) {
          registeredRef.current = true;
          await safeUpdate((current) => {
            if (current.participants.includes(participantIdRef.current)) return current;
            return { ...current, participants: [...current.participants, participantIdRef.current] };
          });
        }
      } catch (e) {
        // silent: registration will retry
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, gameId]);

  useEffect(() => {
    return () => {
      if (role !== 'participant' || !registeredRef.current) return;
      const id = participantIdRef.current;
      registeredRef.current = false;
      if (!id) return;
      (async () => {
        try {
          const record = await fetchAllStates();
          const slice = gameSliceFromRecord(record, gameId);
          if (!slice.participants.includes(id)) return;
          const next = {
            ...slice,
            participants: slice.participants.filter((p) => p !== id),
          };
          await writeAllStates({
            ...record,
            games: { ...record.games, [gameId]: next },
          });
        } catch {
          // best-effort
        }
      })();
    };
  }, [role, gameId]);

  useEffect(() => {
    if (sessionIdRef.current === null) return;
    const current = state.sessionId ?? 0;
    if (current === sessionIdRef.current) return;
    sessionIdRef.current = null;
    registeredRef.current = false;
    setHasVoted({});
    clearAuthFromUrl();
    onExit?.();
  }, [state.sessionId, onExit]);

  const submitVote = async (optionIndex) => {
    const qId = questions[state.currentQuestion].id;
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
    await safeUpdate((latest) => ({
      ...EMPTY_GAME_STATE,
      sessionId: latest.sessionId ?? 0,
      started: latest.started ?? false,
      participants: latest.participants ?? [],
    }));
  };

  const closeSessions = async () => {
    if (!window.confirm('¿Cerrar la sesión? Todos los participantes volverán a la pantalla de inicio.')) return;
    setHasVoted({});
    await safeUpdate(() => ({ ...EMPTY_GAME_STATE, sessionId: Date.now() }));
  };

  const startSession = async () => {
    await safeUpdate((latest) => ({ ...latest, started: true, currentQuestion: 0, showResults: false }));
  };

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
        <BrandFooter branding={branding} tone="white" />
      </div>
    );
  }

  const isFinished = state.currentQuestion >= questions.length;
  const currentQ = questions[state.currentQuestion];
  const currentVotes = currentQ ? (state.votes[currentQ.id] || {}) : {};
  const voteCount = Object.keys(currentVotes).length;
  const optionCounts = currentQ
    ? currentQ.options.map((_, i) => Object.values(currentVotes).filter(v => v === i).length)
    : [];
  const participantCount = state.participants.length;
  const participantsLabel = participantCount === 1 ? 'persona conectada' : 'personas conectadas';

  if (role === 'presenter' && !state.started) {
    const participantUrl = buildParticipantUrl(gameId);
    return (
      <div className="relative min-h-screen bg-cooltra-blue px-5 md:px-8 pt-4 pb-16 flex flex-col">
        <div className="flex items-center justify-end">
          <button
            onClick={closeSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cooltra-white/15 hover:bg-cooltra-white/25 border border-cooltra-white/30 rounded-full text-cooltra-white text-xs font-semi transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
          <div className="text-center mb-5 md:mb-6">
            {game.badge && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cooltra-white/15 border border-cooltra-white/30 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-cooltra-green animate-pulse" />
                <span className="text-cooltra-white text-[11px] font-semi uppercase tracking-[0.18em]">{game.badge}</span>
              </div>
            )}
            <h1 className="font-extra text-cooltra-white text-3xl md:text-5xl mb-2 leading-[1.05]">
              {game.title}
            </h1>
            {game.subtitle && (
              <p className="text-cooltra-white/85 text-sm md:text-base max-w-xl mx-auto">
                {game.subtitle}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center w-full mb-2">
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-md">
                <ShareLinkRow label="Participantes" url={participantUrl} />
              </div>
              <div className="flex items-baseline gap-3">
                <div className="font-extra text-cooltra-white text-[5rem] md:text-[7rem] leading-none">
                  {participantCount}
                </div>
                <div className="text-cooltra-white/80 font-semi text-xs md:text-sm uppercase tracking-[0.18em] max-w-[8rem] text-left">
                  {participantsLabel}
                </div>
              </div>
              <button
                onClick={startSession}
                disabled={participantCount === 0}
                className="px-10 py-3.5 bg-cooltra-white text-cooltra-blue font-extra rounded-full text-lg transition flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-cooltra disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              >
                <Zap className="w-5 h-5" />
                Empezar
              </button>
              {participantCount === 0 && (
                <p className="text-cooltra-white/65 text-xs font-semi text-center">
                  Comparte el enlace o el QR con la sala para que se conecten
                </p>
              )}
            </div>
            <div className="bg-cooltra-white rounded-cooltra p-3 md:p-4 shadow-cooltra mx-auto md:mx-0">
              <QRCodeSVG
                value={participantUrl}
                size={220}
                level="M"
                marginSize={0}
                aria-label="Código QR para unirse como participante"
              />
            </div>
          </div>
        </div>

        <BrandFooter branding={branding} tone="white" />
      </div>
    );
  }

  if (role === 'participant' && !state.started) {
    return (
      <div className="relative min-h-screen bg-cooltra-blue px-5 pt-6 pb-16 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cooltra-white/15 border border-cooltra-white/30 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cooltra-green animate-pulse" />
            <span className="text-cooltra-white text-[11px] font-semi uppercase tracking-[0.18em]">Sala de espera</span>
          </div>

          <h1 className="font-extra text-cooltra-white text-3xl mb-3 leading-tight">
            Esperando que el presentador arranque
          </h1>

          <div className="flex flex-col items-center my-8">
            <div className="font-extra text-cooltra-white text-[6rem] leading-none">
              {participantCount}
            </div>
            <div className="text-cooltra-white/80 font-semi text-xs uppercase tracking-[0.18em] mt-1">
              {participantsLabel}
            </div>
          </div>

          <p className="text-cooltra-white/85 text-base">
            En cuanto el presentador empiece, verás aquí la primera pregunta.
          </p>
        </div>

        <BrandFooter branding={branding} tone="white" />
      </div>
    );
  }

  if (role === 'presenter') {
    if (isFinished) {
      return (
        <div className="relative min-h-screen bg-cooltra-blue px-5 md:px-8 pt-5 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-cooltra-white/15 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-cooltra-green" />
                </div>
                <h1 className="font-extra text-cooltra-white text-2xl md:text-3xl">Resumen del Quiz</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetQuiz}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cooltra-white/15 hover:bg-cooltra-white/25 border border-cooltra-white/30 rounded-full text-cooltra-white text-xs font-semi transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reiniciar
                </button>
                <button
                  onClick={closeSessions}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cooltra-orange/90 hover:bg-cooltra-orange border border-cooltra-orange rounded-full text-cooltra-white text-xs font-extra uppercase tracking-[0.1em] transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {questions.map((q) => {
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
                        const color = PALETTE[i % PALETTE.length];
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

            <div className="mt-6 text-center text-cooltra-white/85 font-semi text-xs uppercase tracking-[0.18em]">
              {state.participants.length} participantes han votado
            </div>

            <ResultsActions game={game} questions={questions} state={state} />
          </div>
          <BrandFooter branding={branding} tone="white" />
        </div>
      );
    }

    return (
      <div className="relative min-h-screen bg-cooltra-blue px-5 md:px-8 pt-5 pb-16 flex flex-col">
        <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-2.5 py-1 rounded-full bg-cooltra-white text-cooltra-blue text-[11px] font-extra uppercase tracking-[0.18em]">
              Pregunta {state.currentQuestion + 1} / {questions.length}
            </div>
            <div className="flex items-center gap-1.5 text-cooltra-white/90 text-xs font-semi">
              <Users className="w-3.5 h-3.5" />
              {state.participants.length} conectados
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cooltra-white text-cooltra-blue shadow-cooltra">
              <BarChart3 className="w-4 h-4" />
              <span className="font-extra text-2xl md:text-3xl leading-none">{voteCount}</span>
              <span className="font-extra text-base md:text-lg text-cooltra-blue/55 leading-none">/ {state.participants.length}</span>
              <span className="text-[10px] font-extra uppercase tracking-[0.18em] text-cooltra-blue/70">votos</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetQuiz}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-cooltra-white/15 hover:bg-cooltra-white/25 border border-cooltra-white/30 rounded-full text-cooltra-white text-[11px] font-semi transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reiniciar
            </button>
            <button
              onClick={closeSessions}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-cooltra-orange/90 hover:bg-cooltra-orange border border-cooltra-orange rounded-full text-cooltra-white text-[11px] font-extra uppercase tracking-[0.1em] transition"
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
          <h2 className="font-extra text-cooltra-white text-3xl md:text-5xl text-center leading-[1.05] mb-6 md:mb-8">
            {currentQ.question}
          </h2>

          <div className="grid md:grid-cols-2 gap-3 mb-5">
            {currentQ.options.map((opt, i) => {
              const count = optionCounts[i];
              const pct = voteCount > 0 ? (count / voteCount) * 100 : 0;
              const color = PALETTE[i % PALETTE.length];
              return (
                <div
                  key={i}
                  className="relative bg-cooltra-white rounded-cooltra px-5 py-4 overflow-hidden shadow-cooltra"
                >
                  {state.showResults && (
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.18 }}
                    />
                  )}
                  <div className="relative flex items-center gap-3">
                    <span className="text-3xl leading-none">{opt.emoji}</span>
                    <span className="text-cooltra-dark text-base md:text-lg flex-1 font-semi leading-tight">{opt.text}</span>
                    {state.showResults && (
                      <div className="text-right">
                        <div className="font-extra text-cooltra-blue text-2xl leading-none">{count}</div>
                        <div className="text-cooltra-dark/60 text-[11px] font-semi">{pct.toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.showResults && currentQ.objective && (
            <div className="bg-cooltra-dark rounded-2xl px-4 py-3 mb-4 flex items-start gap-2.5 border border-cooltra-white/10">
              <Zap className="w-4 h-4 text-cooltra-green flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-cooltra-green text-[10px] font-extra uppercase tracking-[0.18em] mb-0.5">
                  Objetivo de esta pregunta
                </div>
                <div className="text-cooltra-white text-sm leading-snug">{currentQ.objective}</div>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            {!state.showResults ? (
              <button
                onClick={showResults}
                className="px-6 py-2.5 bg-cooltra-white text-cooltra-blue font-extra rounded-full transition flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-cooltra"
              >
                <BarChart3 className="w-4 h-4" />
                Mostrar resultados
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="px-6 py-2.5 bg-cooltra-white text-cooltra-blue font-extra rounded-full transition flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-cooltra"
              >
                {state.currentQuestion < questions.length - 1 ? 'Siguiente pregunta' : 'Ver resumen'}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <BrandFooter branding={branding} tone="white" />
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
        <BrandFooter branding={branding} tone="white" />
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
            Pregunta {state.currentQuestion + 1} / {questions.length}
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
            const color = PALETTE[i % PALETTE.length];

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
      <BrandFooter branding={branding} tone="blue" />
    </div>
  );
}
