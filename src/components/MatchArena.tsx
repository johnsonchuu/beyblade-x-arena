import { useEffect, useRef, useState } from 'react';
import { Trophy, Volume2, VolumeX, Zap, RotateCcw, Check, Info } from 'lucide-react';
import type { FinishType, MatchRound, Player, Tournament, Bey } from '../lib/types';
import { playerName } from '../lib/engine';
import { useI18n, type TKey } from '../lib/i18n';

interface Props {
  tournament: Tournament | null;
  players: Player[];
  onRecordRound: (matchId: string, round: MatchRound) => void;
  onFinishMatch: (matchId: string, p1Score: number, p2Score: number, winnerId: string | null) => void;
  onCancel: () => void;
}

const FINISH_KEY: Record<FinishType, TKey> = {
  SPIN: 'finishSPIN',
  OVER: 'finishOVER',
  BURST: 'finishBURST',
  XTREME: 'finishXTREME',
  DRAW: 'finishDRAW',
};

const FINISH_DESC: Record<FinishType, TKey> = {
  SPIN: 'finishSpinDesc',
  OVER: 'finishOverDesc',
  BURST: 'finishBurstDesc',
  XTREME: 'finishXtremeDesc',
  DRAW: 'finishDrawDesc',
};

export function MatchArenaScreen({ tournament, onRecordRound, onFinishMatch, onCancel }: Props) {
  const { t } = useI18n();
  const match = tournament?.matches.find((m) => m.id === tournament.activeMatchId) ?? null;
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  // Countdown state
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      playGo();
      setCountdown(null);
      return;
    }
    if (countdown > 0) playBeep();
    const tm = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(tm);
  }, [countdown]);

  const beep = (freq: number, dur = 0.09) => {
    if (muted) return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.18;
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      /* audio unavailable */
    }
  };

  const playBeep = () => beep(880);
  const playGo = () => beep(1320, 0.25);

  // Derived
  const totalRounds = match?.rounds.length ?? 0;
  const winnerDeclared =
    match && (match.p1Score >= (tournament?.targetScore ?? 4) || match.p2Score >= (tournament?.targetScore ?? 4));

  const startCountdown = () => setCountdown(3);

  const recordFinish = (finish: FinishType, scorer: 1 | 2) => {
    if (!match || !tournament) return;
    if (winnerDeclared) return; // locked once decided

    const slotIdx = (totalRounds + 1) % 3; // rotate slots
    const p1 = tournament.players.find((p) => p.id === match.p1Id);
    const p2 = tournament.players.find((p) => p.id === match.p2Id);
    if (!p1 || !p2) return;

    const round: MatchRound = {
      slot: slotIdx,
      p1Bey: p1.deck[slotIdx],
      p2Bey: p2.deck[slotIdx],
      finish,
      winnerId: finish === 'DRAW' ? null : scorer === 1 ? match.p1Id : match.p2Id,
    };
    onRecordRound(match.id, round);
  };

  const finishMatch = () => {
    if (!match || !tournament) return;
    const target = tournament.targetScore;
    let winnerId: string | null = null;
    if (match.p1Score >= target) winnerId = match.p1Id;
    else if (match.p2Score >= target) winnerId = match.p2Id;
    onFinishMatch(match.id, match.p1Score, match.p2Score, winnerId);
  };

  if (!match || !tournament) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-gray-400 text-sm">{t('noActiveMatch')}</p>
      </div>
    );
  }

  const p1 = tournament.players.find((p) => p.id === match.p1Id) ?? null;
  const p2 = tournament.players.find((p) => p.id === match.p2Id) ?? null;
  const target = tournament.targetScore;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-neon uppercase tracking-wider">{t('matchArena')}</h2>
          <p className="text-gray-500 text-xs">{t('roundCount', { n: totalRounds + 1 })} · {t('firstTo', { n: target })}</p>
        </div>
        <button className="btn-ghost p-2" onClick={() => setMuted((m) => !m)} aria-label={t('toggleSound')}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Scoring legend */}
      <div className="panel p-3 space-y-1 text-xs text-gray-400">
        <div className="flex items-center gap-1 text-neon uppercase tracking-widest font-bold mb-1"><Info size={12} /> {t('finishType')}</div>
        {(['SPIN', 'OVER', 'BURST', 'XTREME'] as FinishType[]).map((f) => (
          <div key={f} className="flex items-center justify-between">
            <span className="font-semibold text-gray-200">{t(FINISH_KEY[f])}</span>
            <span className="text-gray-500">{t(FINISH_DESC[f])}</span>
          </div>
        ))}
      </div>

      {/* Scoreboard */}
      <section className="panel p-4">
        <div className="grid grid-cols-2 gap-3">
          <PlayerSide
            name={playerName(tournament.players, match.p1Id)}
            score={match.p1Score}
            bey={p1?.deck[0] ?? null}
            highlight={match.winnerId === match.p1Id}
            onClickFinish={(f) => recordFinish(f, 1)}
          />
          <PlayerSide
            name={playerName(tournament.players, match.p2Id)}
            score={match.p2Score}
            bey={p2?.deck[0] ?? null}
            highlight={match.winnerId === match.p2Id}
            onClickFinish={(f) => recordFinish(f, 2)}
          />
        </div>

        {/* Round log */}
        <div className="mt-4 border-t border-gray-700/60 pt-3 space-y-1">
          {match.rounds.length === 0 ? (
            <p className="text-gray-600 text-xs">{t('noRoundsYet')}</p>
          ) : (
            match.rounds.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 w-6">#{i + 1}</span>
                <span className="font-mono text-gray-300 w-40 truncate">{r.p1Bey?.blade ?? '—'}</span>
                <span className="text-gray-500">vs</span>
                <span className="font-mono text-gray-300 w-40 truncate">{r.p2Bey?.blade ?? '—'}</span>
                <span className="ml-auto font-bold uppercase tracking-wider text-gray-400">{t(FINISH_KEY[r.finish])}</span>
                <span className="text-neon font-bold w-6 text-right">{r.winnerId ? r.winnerId === match.p1Id ? 'P1' : 'P2' : 'D'}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Countdown / GO button */}
      <div className="text-center space-y-2">
        {countdown === null ? (
          <button className="btn-primary w-full py-4 text-xl" onClick={startCountdown} disabled={winnerDeclared ?? false}>
            <span className="flex items-center justify-center gap-2"><Zap size={20} /> {t('goShoot')}</span>
          </button>
        ) : (
          <div className="py-4">
            <span className="text-7xl font-bold text-neon" style={{ textShadow: '0 0 30px rgba(0,255,204,0.6)' }}>
              {countdown}
            </span>
            {countdown === 0 && <div className="text-gold font-bold mt-2">GO!</div>}
          </div>
        )}
        <p className="text-gray-600 text-xs">{t('deckRotate')}</p>
      </div>

      {/* Winner banner */}
      {winnerDeclared && (
        <section className="panel border-2 border-gold p-5 text-center" style={{ boxShadow: '0 0 30px rgba(255,230,0,0.25)' }}>
          <Trophy className="mx-auto text-gold mb-2" size={36} />
          <h2 className="text-2xl font-bold text-gold uppercase tracking-widest">
            {t('wins', { name: match.p1Score >= target ? playerName(tournament.players, match.p1Id) : playerName(tournament.players, match.p2Id) })}
          </h2>
          <p className="text-gray-300 mt-2">
            {match.p1Score} - {match.p2Score}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {t('roundsAndXtreme', { rounds: match.rounds.length, xtreme: match.rounds.filter((r) => r.finish === 'XTREME').length })}
          </p>
          <button className="btn-primary w-full mt-4 py-3" onClick={finishMatch}>
            <span className="flex items-center justify-center gap-2"><Check size={18} /> {t('recordResult')}</span>
          </button>
        </section>
      )}

      {/* Cancel */}
      <button className="btn-danger w-full py-3" onClick={() => confirm(t('cancelConfirm')) && onCancel()}>
        <span className="flex items-center justify-center gap-2"><RotateCcw size={16} /> {t('cancelMatch')}</span>
      </button>
    </div>
  );
}

function PlayerSide({
  name,
  score,
  bey,
  highlight,
  onClickFinish,
}: {
  name: string;
  score: number;
  bey: Bey | null;
  highlight: boolean;
  onClickFinish: (f: FinishType) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'border border-gold bg-gold/5' : 'bg-black/30 border border-gray-700/60'}`}>
      <h3 className={`font-bold uppercase tracking-wider text-sm mb-1 ${highlight ? 'text-gold' : 'text-neon'}`}>{name}</h3>
      {bey ? (
        <p className="text-[10px] text-gray-500 font-mono truncate mb-2">{bey.blade}</p>
      ) : (
        <p className="text-[10px] text-gray-600 mb-2">—</p>
      )}
      <div className="text-5xl font-mono font-bold text-neon mb-3" style={{ textShadow: '0 0 14px rgba(0,255,204,0.4)' }}>
        {score}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <FinishButton label={t('finishSpin')} desc={t('finishSpinDesc')} onClick={() => onClickFinish('SPIN')} />
        <FinishButton label={t('finishOver')} desc={t('finishOverDesc')} onClick={() => onClickFinish('OVER')} accent="sky" />
        <FinishButton label={t('finishBurst')} desc={t('finishBurstDesc')} onClick={() => onClickFinish('BURST')} accent="orange" />
        <FinishButton label={t('finishXtreme')} desc={t('finishXtremeDesc')} onClick={() => onClickFinish('XTREME')} accent="danger" />
      </div>
    </div>
  );
}

function FinishButton({
  label,
  desc,
  onClick,
  accent,
}: {
  label: string;
  desc: string;
  onClick: () => void;
  accent?: 'sky' | 'orange' | 'danger';
}) {
  const accentCls =
    accent === 'danger'
      ? 'bg-transparent border border-danger text-danger hover:bg-danger hover:text-white'
      : accent === 'orange'
        ? 'bg-transparent border border-orange-400 text-orange-300 hover:bg-orange-400/10'
        : accent === 'sky'
          ? 'bg-transparent border border-sky-400 text-sky-300 hover:bg-sky-400/10'
          : 'bg-transparent border border-gray-400 text-gray-200 hover:bg-white/10';
  return (
    <button onClick={onClick} className={`btn text-xs py-2.5 ${accentCls}`}>
      <span className="block">{label}</span>
      <span className="block text-[9px] font-normal opacity-70 normal-case">{desc}</span>
    </button>
  );
}