import { BarChart3, PieChart, Shield, Award } from 'lucide-react';
import type { FinishType, Tournament } from '../lib/types';
import { useI18n, type TKey } from '../lib/i18n';
import { ShareCard } from './ShareCard';

interface Props {
  tournament: Tournament | null;
}

const FINISH_KEY: Record<FinishType, TKey> = {
  SPIN: 'finishSPIN',
  OVER: 'finishOVER',
  BURST: 'finishBURST',
  XTREME: 'finishXTREME',
  DRAW: 'finishDRAW',
};

export function AnalyticsScreen({ tournament }: Props) {
  const { t } = useI18n();

  // Collect all round finishes across completed matches
  const allRounds = tournament?.matches.flatMap((m) => m.rounds) ?? [];
  const finishCounts: Record<string, number> = {};
  allRounds.forEach((r) => {
    finishCounts[r.finish] = (finishCounts[r.finish] ?? 0) + 1;
  });
  const totalFinishes = allRounds.length;

  // Top Blades: count by bey-name (winner's blade)
  const bladeWins = new Map<string, number>();
  tournament?.matches.forEach((m) => {
    if (!m.completed || !m.winnerId) return;
    m.rounds.forEach((r) => {
      if (!r.winnerId) return;
      const bey = r.winnerId === m.p1Id ? r.p1Bey : r.p2Bey;
      if (bey?.blade && bey.blade !== '未設定' && bey.blade !== 'Not set') {
        bladeWins.set(bey.blade, (bladeWins.get(bey.blade) ?? 0) + 1);
      }
    });
  });
  const topBlades = [...bladeWins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const finishColors: Record<FinishType, string> = {
    SPIN: 'bg-neon',
    OVER: 'bg-sky-400',
    BURST: 'bg-orange-400',
    XTREME: 'bg-danger',
    DRAW: 'bg-gray-500',
  };

  const pct = (f: FinishType) => (totalFinishes ? Math.round(((finishCounts[f] ?? 0) / totalFinishes) * 100) : 0);

  return (
    <div className="space-y-6">
      {!tournament || tournament.matches.length === 0 ? (
        <div className="panel p-8 text-center">
          <BarChart3 className="mx-auto text-neon mb-3 animate-pulse" size={40} />
          <p className="text-gray-400 text-sm font-mono">{t('noStats')}</p>
        </div>
      ) : (
        <>
          {/* Official Shareable Battle Card */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-neon uppercase tracking-widest font-heading flex items-center gap-1.5">
                <Award size={16} className="text-gold" /> {t('statsTitle')}
              </h3>
            </div>
            <ShareCard tournament={tournament} />
          </section>

          {/* Finish-type distribution */}
          <section className="panel p-5 border border-gray-700/80">
            <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3 flex items-center gap-2 font-heading">
              <PieChart size={15} /> {t('finishDistribution')}
            </h3>
            <div className="space-y-3">
              {(['SPIN', 'OVER', 'BURST', 'XTREME', 'DRAW'] as FinishType[]).map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="w-24 text-xs font-mono uppercase text-gray-300">{t(FINISH_KEY[f])}</span>
                  <div className="flex-1 h-2.5 bg-[#171926] rounded-full overflow-hidden border border-gray-800">
                    <div className={`h-full ${finishColors[f]} transition-all duration-500`} style={{ width: `${pct(f)}%` }} />
                  </div>
                  <span className="w-12 text-xs font-mono font-bold text-right text-gray-300">{pct(f)}%</span>
                </div>
              ))}
              <p className="text-gray-500 font-mono text-xs pt-2">{t('recordedRounds', { n: totalFinishes })}</p>
            </div>
          </section>

          {/* Top blades meta leaderboard */}
          {topBlades.length > 0 && (
            <section className="panel p-5 border border-gray-700/80">
              <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3 flex items-center gap-2 font-heading">
                <Shield size={15} className="text-neon" /> {t('topBlades')}
              </h3>
              <div className="space-y-2">
                {topBlades.map(([blade, wins], i) => (
                  <div key={blade} className="flex items-center justify-between p-2.5 rounded-lg bg-black/30 border border-gray-800 text-sm font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 font-bold ${i === 0 ? 'text-gold' : 'text-gray-500'}`}>{i + 1}</span>
                      <span className="font-semibold text-white">{blade}</span>
                    </div>
                    <span className="text-neon font-bold">{wins} wins</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
