import { useState, useEffect } from 'react';
import { Zap, Volume2, VolumeX, Trophy, RotateCcw, Check, Swords, Flag } from 'lucide-react';
import type { Match, Tournament, Player, FinishType, MatchRound, Bey } from '../lib/types';
import { playerName, getNextReadyMatch } from '../lib/engine';
import { useI18n } from '../lib/i18n';

interface Props {
  tournament: Tournament | null;
  players: Player[];
  onRecordRound: (matchId: string, round: MatchRound) => void;
  onFinishMatch: (matchId: string, p1Score: number, p2Score: number, winnerId: string | null) => void;
  onUndoRound: (matchId: string) => void;
  onProceedToNextMatch: (matchId: string, p1Score: number, p2Score: number, winnerId: string | null) => void;
  onCancel: () => void;
}

const FINISH_KEY: Record<FinishType, 'finishSPIN' | 'finishOVER' | 'finishBURST' | 'finishXTREME' | 'finishDRAW'> = {
  SPIN: 'finishSPIN',
  OVER: 'finishOVER',
  BURST: 'finishBURST',
  XTREME: 'finishXTREME',
  DRAW: 'finishDRAW',
};

export function MatchArenaScreen({ tournament, onRecordRound, onFinishMatch, onUndoRound, onProceedToNextMatch, onCancel }: Props) {
  const { t } = useI18n();
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [activeFinish, setActiveFinish] = useState<FinishType | null>(null);
  const [undoFeedback, setUndoFeedback] = useState(false);

  const undoLastRound = (matchId: string) => {
    onUndoRound(matchId);
    setUndoFeedback(true);
    window.setTimeout(() => setUndoFeedback(false), 1500);
  };

  const match: Match | null = tournament?.matches.find((m) => m.id === tournament.activeMatchId) ?? null;

  // Sound synthesis
  const beep = (freq: number, duration: number = 0.15) => {
    if (muted) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // audio context may fail if no user gesture
    }
  };

  const playBeep = () => beep(880);
  const playGo = () => beep(1320, 0.25);

  const playFinishSound = (finish: FinishType) => {
    if (muted) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (finish === 'XTREME') {
        // Heavy pitch drop bass shockwave
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (finish === 'BURST') {
        // Fast explosive burst
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (finish === 'OVER') {
        // Ascending whoosh ejection
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (finish === 'SPIN') {
        // High chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}
  };

  // Derived
  const totalRounds = match?.rounds.length ?? 0;
  const target = tournament?.targetScore ?? null;

  // If targetScore is set (e.g. 4, 5), check if threshold reached. If null (free play), winnerDeclared is false until manual end
  const winnerDeclared =
    match && target !== null && (match.p1Score >= target || match.p2Score >= target);

  const startCountdown = () => {
    setCountdown(3);
    playBeep();
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (prev === 1) playGo();
          return 0;
        }
        playBeep();
        return prev - 1;
      });
    }, 800);
    setTimeout(() => setCountdown(null), 3200);
  };

  const recordFinish = (finish: FinishType, scorer: 1 | 2 | 0) => {
    if (!match || !tournament) return;
    if (winnerDeclared) return; // locked once decided

    // Trigger sound and finish overlay
    playFinishSound(finish);
    setActiveFinish(finish);

    // Blind deck-slot selection: use the match's pre-shuffled order for this round.
    // Falls back to a simple rotation for legacy matches saved without an order array.
    const slotIdx = match.order?.length === 3 ? match.order[totalRounds % 3] : totalRounds % 3;
    const p1 = tournament.players.find((p) => p.id === match.p1Id);
    const p2 = tournament.players.find((p) => p.id === match.p2Id);
    if (!p1 || !p2) return;

    const round: MatchRound = {
      slot: slotIdx,
      p1Bey: p1.deck[slotIdx],
      p2Bey: p2.deck[slotIdx],
      finish,
      winnerId: finish === 'DRAW' || scorer === 0 ? null : scorer === 1 ? match.p1Id : match.p2Id,
    };
    onRecordRound(match.id, round);
  };

  const finishMatch = (explicitWinnerId?: string | null) => {
    if (!match || !tournament) return;
    let winnerId: string | null = null;
    if (explicitWinnerId !== undefined) {
      winnerId = explicitWinnerId;
    } else if (target !== null) {
      if (match.p1Score >= target) winnerId = match.p1Id;
      else if (match.p2Score >= target) winnerId = match.p2Id;
    } else {
      // Free play finish: whichever player has higher score, or null if tie
      if (match.p1Score > match.p2Score) winnerId = match.p1Id;
      else if (match.p2Score > match.p1Score) winnerId = match.p2Id;
    }
    onFinishMatch(match.id, match.p1Score, match.p2Score, winnerId);
  };

  // Winner ID derived the same way as finishMatch, used for banner navigation buttons
  const winnerIdForNextBanner = (() => {
    if (!match) return null;
    if (target !== null) {
      if (match.p1Score >= target) return match.p1Id;
      if (match.p2Score >= target) return match.p2Id;
      return null;
    }
    if (match.p1Score > match.p2Score) return match.p1Id;
    if (match.p2Score > match.p1Score) return match.p2Id;
    return null;
  })();

  if (!match || !tournament) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-gray-400 text-sm">{t('noActiveMatch')}</p>
      </div>
    );
  }

  const p1 = tournament.players.find((p) => p.id === match.p1Id) ?? null;
  const p2 = tournament.players.find((p) => p.id === match.p2Id) ?? null;
  const currentSlot = match.order?.length === 3 ? match.order[totalRounds % 3] : totalRounds % 3;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neon uppercase tracking-wider font-heading">{t('matchArena')}</h2>
          <p className="text-gray-400 text-xs font-mono">
            {t('roundCount', { n: totalRounds + 1 })} · {target !== null ? t('firstTo', { n: target }) : t('firstToNone')}
          </p>
        </div>
        <button className="btn-ghost p-2 rounded-xl" onClick={() => setMuted((m) => !m)} aria-label={t('toggleSound')}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-neon" />}
        </button>
      </div>

      {/* Countdown / GO Shoot Banner */}
      <div className="text-center">
        {countdown === null ? (
          <button
            className="btn-primary w-full py-4 text-xl tracking-wider rounded-xl font-heading shadow-glow hover:shadow-glow-lg transition-all"
            onClick={startCountdown}
            disabled={winnerDeclared ?? false}
          >
            <span className="flex items-center justify-center gap-2">
              <Zap size={22} className="fill-black" /> {t('goShoot')}
            </span>
          </button>
        ) : (
          <div className="py-5 bg-black/40 rounded-xl border border-neon/50 animate-pulse">
            <span className="text-6xl font-black text-neon font-mono" style={{ textShadow: '0 0 35px rgba(0,255,204,0.8)' }}>
              {countdown === 0 ? 'GO SHOOT!' : countdown}
            </span>
          </div>
        )}
      </div>

      {/* Scoreboard Arena */}
      <section className="panel p-4 border border-gray-700/80 relative overflow-hidden">
        <div className="grid grid-cols-2 gap-3 relative">
          <PlayerSide
            name={playerName(tournament.players, match.p1Id)}
            score={match.p1Score}
            bey={p1?.deck[currentSlot] ?? null}
            slotIndex={currentSlot}
            highlight={match.winnerId === match.p1Id}
            onClickFinish={(f) => recordFinish(f, 1)}
          />
          <PlayerSide
            name={playerName(tournament.players, match.p2Id)}
            score={match.p2Score}
            bey={p2?.deck[currentSlot] ?? null}
            slotIndex={currentSlot}
            highlight={match.winnerId === match.p2Id}
            onClickFinish={(f) => recordFinish(f, 2)}
          />
        </div>

        {/* Global Action: Draw Button (0 pts, replay round) */}
        <div className="mt-3 pt-3 border-t border-gray-800 flex justify-center">
          <button
            type="button"
            disabled={winnerDeclared ?? false}
            onClick={() => recordFinish('DRAW', 0)}
            className="w-full py-2 px-3 rounded-lg border border-dashed border-gray-600 bg-black/30 hover:bg-white/5 text-gray-300 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2"
          >
            <span className="text-neon font-bold">{t('finishDrawBtn')}</span>
            <span>—</span>
            <span className="text-gray-400">{t('finishDrawDesc')}</span>
          </button>
        </div>

        {/* Free Play Manual End Match Actions */}
        {target === null && !winnerDeclared && (
          <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center justify-between gap-2">
            <button
              className="btn-ghost flex-1 py-2 text-xs border-neon/50 text-neon hover:bg-neon/10"
              onClick={() => finishMatch(match.p1Score >= match.p2Score ? match.p1Id : match.p2Id)}
            >
              <Flag size={14} className="inline mr-1" />
              {t('endMatchManual')}
            </button>
          </div>
        )}

        {/* Round by round battle log */}
        <div className="mt-4 border-t border-gray-700/60 pt-3 space-y-1.5">
          {undoFeedback && (
            <p className="text-[11px] font-mono text-neon animate-pulse">{t('undoToast')}</p>
          )}
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-mono flex items-center gap-1 mb-1">
            <Swords size={12} className="text-neon" /> Battle Log
            {match.rounds.length > 0 && !winnerDeclared && (
              <button
                type="button"
                className="btn-ghost py-1.5 px-3 text-xs text-danger/90 hover:text-danger hover:bg-danger/10 border-danger/30 flex items-center gap-1.5 rounded-lg transition-colors font-mono ml-auto"
                onClick={() => undoLastRound(match.id)}
              >
                <RotateCcw size={14} />
                <span>{t('undoRound')}</span>
              </button>
            )}
          </div>
          {match.rounds.length === 0 ? (
            <p className="text-gray-500 text-xs font-mono">{t('noRoundsYet')}</p>
          ) : (
            match.rounds.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-black/30 border border-gray-800">
                <span className="text-gray-500 font-mono w-6">#{i + 1}</span>
                <span className="font-mono text-gray-300 flex-1 truncate">
                  {r.p1Bey?.blade || 'Bey 1'} vs {r.p2Bey?.blade || 'Bey 2'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  r.finish === 'XTREME' ? 'bg-danger/20 text-danger border border-danger/40' :
                  r.finish === 'BURST' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                  r.finish === 'OVER' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' :
                  r.finish === 'DRAW' ? 'bg-gray-700 text-gray-300' :
                  'bg-neon/20 text-neon border border-neon/40'
                }`}>
                  {t(FINISH_KEY[r.finish])}
                </span>
                <span className="text-neon font-bold w-7 text-right font-mono">
                  {r.winnerId ? (r.winnerId === match.p1Id ? 'P1' : 'P2') : 'DRAW'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Winner Banner when Match is Decided */}
      {winnerDeclared && (
        <section className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" style={{ boxShadow: '0 0 35px rgba(255,230,0,0.3)' }}>
          <div className="panel border-2 border-gold p-5 text-center w-full max-w-md">
          <Trophy className="mx-auto text-gold mb-2 animate-pulse" size={42} />
          <h2 className="text-2xl font-black text-gold uppercase tracking-widest font-heading">
            {t('wins', {
              name: match.p1Score >= (target ?? 4)
                ? playerName(tournament.players, match.p1Id)
                : playerName(tournament.players, match.p2Id),
            })}
          </h2>
          <p className="text-white text-2xl font-mono font-bold mt-2">
            {match.p1Score} - {match.p2Score}
          </p>
          <p className="text-gray-400 text-xs mt-1 font-mono">
            {t('roundsAndXtreme', {
              rounds: match.rounds.length,
              xtreme: match.rounds.filter((r) => r.finish === 'XTREME').length,
            })}
          </p>
          <button className="btn-primary w-full mt-4 py-3.5 text-base tracking-wider" onClick={() => finishMatch()}>
            <span className="flex items-center justify-center gap-2">
              <Check size={18} /> {t('recordResult')}
            </span>
          </button>
          {(() => {
            const next = getNextReadyMatch(tournament);
            return (
              <div className="mt-2 pt-3 border-t border-gray-700/60 space-y-2">
                {next && (
                  <button
                    type="button"
                    className="btn-primary w-full py-3 text-sm tracking-wider"
                    onClick={() => onProceedToNextMatch(match.id, match.p1Score, match.p2Score, winnerIdForNextBanner)}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Check size={16} /> {t('proceedNextMatch', { n: next.round })}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost w-full py-2.5 text-xs tracking-wider"
                  onClick={() => onProceedToNextMatch(match.id, match.p1Score, match.p2Score, winnerIdForNextBanner)}
                >
                  {t('returnToTourney')}
                </button>
              </div>
            );
          })()}
          </div>
        </section>
      )}

      {/* Arcade Finish Overlay */}
      {activeFinish && (
        <ArcadeFinishOverlay finish={activeFinish} onDismiss={() => setActiveFinish(null)} />
      )}

      {/* Cancel Match */}
      <button className="btn-danger w-full py-3 rounded-xl" onClick={() => confirm(t('cancelConfirm')) && onCancel()}>
        <span className="flex items-center justify-center gap-2">
          <RotateCcw size={16} /> {t('cancelMatch')}
        </span>
      </button>
    </div>
  );
}

function PlayerSide({
  name,
  score,
  bey,
  slotIndex,
  highlight,
  onClickFinish,
}: {
  name: string;
  score: number;
  bey: Bey | null;
  slotIndex: number;
  highlight: boolean;
  onClickFinish: (f: FinishType) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`rounded-xl p-3 flex flex-col justify-between ${highlight ? 'border border-gold bg-gold/5' : 'bg-black/40 border border-gray-700/70'}`}>
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-bold uppercase tracking-wider text-sm truncate ${highlight ? 'text-gold' : 'text-neon'}`}>{name}</h3>
          <span className="text-[9px] font-mono text-gray-500 uppercase">Slot {slotIndex + 1}</span>
        </div>
        {bey && bey.blade ? (
          <p className="text-[11px] text-gray-300 font-mono truncate mb-2">{bey.blade}</p>
        ) : (
          <p className="text-[11px] text-gray-600 font-mono mb-2">—</p>
        )}
      </div>

      <div className="text-5xl font-mono font-black text-neon my-2 text-center" style={{ textShadow: '0 0 16px rgba(0,255,204,0.45)' }}>
        {score}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <FinishButton label={t('finishSpin')} onClick={() => onClickFinish('SPIN')} />
        <FinishButton label={t('finishOver')} onClick={() => onClickFinish('OVER')} accent="sky" />
        <FinishButton label={t('finishBurst')} onClick={() => onClickFinish('BURST')} accent="orange" />
        <FinishButton label={t('finishXtreme')} onClick={() => onClickFinish('XTREME')} accent="danger" />
      </div>
    </div>
  );
}

function FinishButton({
  label,
  onClick,
  accent,
}: {
  label: string;
  onClick: () => void;
  accent?: 'sky' | 'orange' | 'danger';
}) {
  const accentCls =
    accent === 'danger'
      ? 'bg-transparent border border-danger text-danger hover:bg-danger hover:text-white'
      : accent === 'orange'
        ? 'bg-transparent border border-orange-400 text-orange-300 hover:bg-orange-400/20'
        : accent === 'sky'
          ? 'bg-transparent border border-sky-400 text-sky-300 hover:bg-sky-400/20'
          : 'bg-transparent border border-gray-500 text-gray-200 hover:bg-white/15';
  return (
    <button onClick={onClick} className={`btn text-xs py-2.5 px-1 rounded-lg ${accentCls} transition-all`}>
      <span className="block font-bold">{label}</span>
    </button>
  );
}

function ArcadeFinishOverlay({
  finish,
  onDismiss,
}: {
  finish: FinishType;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const configs: Record<
    FinishType,
    {
      text: string;
      sub: string;
      color: string;
      glow: string;
      bgOverlay: string;
      border: string;
    }
  > = {
    XTREME: {
      text: '⚡ XTREME FINISH!',
      sub: '+3 POINTS',
      color: 'text-danger',
      glow: 'rgba(255, 0, 85, 0.8)',
      bgOverlay: 'from-danger/30 via-red-950/70 to-black/90',
      border: 'border-danger/60',
    },
    BURST: {
      text: '💥 BURST FINISH!',
      sub: '+2 POINTS',
      color: 'text-orange-400',
      glow: 'rgba(251, 146, 60, 0.8)',
      bgOverlay: 'from-orange-600/30 via-orange-950/70 to-black/90',
      border: 'border-orange-500/60',
    },
    OVER: {
      text: '🚀 OVER FINISH!',
      sub: '+2 POINTS',
      color: 'text-cyan-400',
      glow: 'rgba(34, 211, 238, 0.8)',
      bgOverlay: 'from-cyan-600/30 via-sky-950/70 to-black/90',
      border: 'border-cyan-400/60',
    },
    SPIN: {
      text: '🌀 SPIN FINISH!',
      sub: '+1 POINT',
      color: 'text-emerald-400',
      glow: 'rgba(52, 211, 153, 0.8)',
      bgOverlay: 'from-emerald-600/30 via-emerald-950/70 to-black/90',
      border: 'border-emerald-400/60',
    },
    DRAW: {
      text: '⚔️ DRAW / REPLAY',
      sub: 'NO POINTS AWARDED',
      color: 'text-gray-300',
      glow: 'rgba(209, 213, 219, 0.8)',
      bgOverlay: 'from-gray-600/30 via-gray-900/70 to-black/90',
      border: 'border-gray-400/60',
    },
  };

  const c = configs[finish];

  return (
    <div
      onClick={onDismiss}
      className={`fixed inset-0 z-[70] flex items-center justify-center cursor-pointer bg-gradient-to-b ${c.bgOverlay} backdrop-blur-md animate-screen-rumble select-none`}
    >
      <div className={`text-center p-8 rounded-2xl border-2 ${c.border} bg-black/60 shadow-2xl animate-flash-burst mx-4 max-w-lg w-full`}>
        <h1
          className={`text-3xl md:text-5xl font-black uppercase tracking-wider font-heading ${c.color} drop-shadow-lg`}
          style={{ textShadow: `0 0 30px ${c.glow}, 0 0 60px ${c.glow}` }}
        >
          {c.text}
        </h1>
        <p
          className="text-white text-lg md:text-xl font-mono font-bold mt-2 tracking-widest uppercase opacity-90"
        >
          {c.sub}
        </p>
        <p className="text-gray-400 text-xs font-mono mt-4 opacity-60">Click anywhere to skip</p>
      </div>
    </div>
  );
}

