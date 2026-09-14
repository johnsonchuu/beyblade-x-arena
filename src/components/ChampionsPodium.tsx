import { useMemo } from 'react';
import { X, BarChart3 } from 'lucide-react';
import type { Tournament } from '../lib/types';
import { computeStandings, playerName } from '../lib/engine';
import { useI18n } from '../lib/i18n';

interface Props {
  tournament: Tournament;
  onViewBattleCard: () => void;
  onClose: () => void;
}

const PODIUM_STYLES = [
  {
    // 1st place: gold, tallest, glowing
    pedestal: 'h-24 bg-gradient-to-t from-gold/40 to-gold/10 border-gold',
    rankLabel: 'text-gold',
    medal: '🥇',
    name: 'text-gold',
    shadow: 'shadow-glow-gold',
  },
  {
    // 2nd place: silver
    pedestal: 'h-16 bg-gradient-to-t from-gray-300/30 to-gray-400/5 border-gray-300',
    rankLabel: 'text-gray-300',
    medal: '🥈',
    name: 'text-gray-200',
    shadow: '',
  },
  {
    // 3rd place: bronze
    pedestal: 'h-10 bg-gradient-to-t from-amber-700/40 to-amber-700/10 border-amber-600',
    rankLabel: 'text-amber-500',
    medal: '🥉',
    name: 'text-amber-400',
    shadow: '',
  },
];

/** Display order: 2nd, 1st, 3rd so the champion stands in the middle. */
const DISPLAY_ORDER = [1, 0, 2];

export function ChampionsPodium({ tournament, onViewBattleCard, onClose }: Props) {
  const { t } = useI18n();

  const rows = useMemo(() => computeStandings(tournament.players, tournament.matches), [tournament]);

  // Burst King: player with the most BURST + XTREME round finishes
  const burstKingId = useMemo(() => {
    const counts = new Map<string, number>();
    tournament.matches.forEach((m) => {
      if (!m.completed) return;
      m.rounds.forEach((r) => {
        if (r.finish === 'BURST' || r.finish === 'XTREME') {
          if (!r.winnerId) return;
          counts.set(r.winnerId, (counts.get(r.winnerId) ?? 0) + 1);
        }
      });
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 && sorted[0][1] > 0 ? sorted[0][0] : null;
  }, [tournament]);

  const top3 = rows.slice(0, 3);
  const rankLabels = [t('champion1st'), t('runnerUp2nd'), t('third3rd')];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Confetti field */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => {
          const colors = ['bg-gold', 'bg-neon', 'bg-danger', 'bg-gray-300', 'bg-amber-500'];
          const color = colors[i % colors.length];
          const left = `${(i * 41 + 7) % 100}%`;
          const delay = `${(i % 12) * 0.25}s`;
          const duration = `${3 + (i % 5) * 0.7}s`;
          return (
            <span
              key={i}
              className={`absolute top-0 w-1.5 h-3 rounded-sm ${color} confetti-fall`}
              style={{ left, animationDelay: delay, animationDuration: duration }}
            />
          );
        })}
      </div>

      <div className="panel w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-gold/60 shadow-glow-gold rounded-2xl p-6 space-y-5 relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 text-center flex-1">
            <h2 className="text-xl font-bold font-heading text-gold uppercase tracking-wider" style={{ textShadow: '0 0 15px rgba(255,230,0,0.5)' }}>
              {t('podiumTitle')}
            </h2>
            <p className="text-xs text-gray-400 font-mono">{t('podiumSubtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Podium: 2nd, 1st, 3rd display order */}
        <div className="flex items-end justify-center gap-3 pt-2">
          {DISPLAY_ORDER.map((rankIdx) => {
            const row = top3[rankIdx];
            if (!row) return <div key={rankIdx} className="w-24" />;
            const style = PODIUM_STYLES[rankIdx];
            const isBurstKing = burstKingId === row.player.id;
            return (
              <div key={row.player.id} className="flex flex-col items-center gap-2 w-24">
                {isBurstKing && (
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-danger bg-danger/10 border border-danger/50 px-2 py-0.5 rounded-md animate-pulse text-center">
                    {t('burstKing')}
                  </span>
                )}
                <span className={`text-2xl leading-none ${rankIdx === 0 ? 'animate-bounce-short' : ''}`}>{style.medal}</span>
                {rankIdx === 0 && <span className="text-2xl leading-none -mb-2">👑</span>}
                <span className={`text-xs font-bold font-heading truncate w-full text-center ${style.name}`}>
                  {playerName(tournament.players, row.player.id)}
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-widest ${style.rankLabel}`}>
                  {row.wins}W · {row.pts}
                  {t('pts')}
                </span>
                <div className={`w-full rounded-t-lg border-t border-x ${style.pedestal} ${style.shadow} flex items-start justify-center pt-1`}>
                  <span className={`text-lg font-black font-heading ${style.rankLabel}`}>{rankIdx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Labels under podium */}
        <div className="flex justify-center gap-3">
          {DISPLAY_ORDER.map((rankIdx) => {
            const row = top3[rankIdx];
            const style = PODIUM_STYLES[rankIdx];
            return (
              <span key={rankIdx} className={`w-24 text-center text-[10px] font-mono uppercase tracking-widest ${row ? style.rankLabel : 'opacity-0'}`}>
                {rankLabels[rankIdx]}
              </span>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-3 border-t border-gray-800">
          <button
            onClick={onViewBattleCard}
            className="btn-primary w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-heading text-sm tracking-wider"
          >
            <BarChart3 size={16} /> {t('viewMeta')}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-heading text-sm tracking-wider"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
