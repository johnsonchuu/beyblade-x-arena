import React from 'react';
import { BarChart3, PieChart, Award, Image as ImageIcon } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { FinishType, Tournament } from '../lib/types';
import { computeStandings, formatLabel } from '../lib/engine';
import { useI18n, type TKey } from '../lib/i18n';

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
  const [exporting, setExporting] = React.useState(false);

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
      if (bey?.blade) bladeWins.set(bey.blade, (bladeWins.get(bey.blade) ?? 0) + 1);
    });
  });
  const topBlades = [...bladeWins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const rows = tournament ? computeStandings(tournament.players, tournament.matches) : [];
  const champion = rows[0];

  const finishColors: Record<FinishType, string> = {
    SPIN: 'bg-neon',
    OVER: 'bg-sky-400',
    BURST: 'bg-orange-400',
    XTREME: 'bg-danger',
    DRAW: 'bg-gray-500',
  };

  const exportSummary = async () => {
    setExporting(true);
    try {
      const node = document.getElementById('summary-card');
      if (!node) return;
      const dataUrl = await toPng(node, { backgroundColor: '#0d0e15', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `beyblade-summary-${tournament?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'tournament'}.png`;
      a.click();
    } catch {
      alert(t('exportError'));
    } finally {
      setExporting(false);
    }
  };

  const pct = (f: FinishType) => (totalFinishes ? Math.round((finishCounts[f] ?? 0) / totalFinishes * 100) : 0);

  return (
    <div className="space-y-6">
      {!tournament || tournament.matches.length === 0 ? (
        <div className="panel p-8 text-center">
          <BarChart3 className="mx-auto text-neon mb-3" size={36} />
          <p className="text-gray-400 text-sm">{t('noStats')}</p>
        </div>
      ) : (
        <>
          {/* Summary export card (hidden locally, captured via html-to-image) */}
          <div id="summary-card" className="panel p-6 relative" style={{ background: 'linear-gradient(160deg, #10121d 0%, #0d0e15 100%)' }}>
            <div className="text-center mb-5">
              <h2 className="text-xl font-bold text-neon uppercase tracking-widest">🏆 {tournament.name}</h2>
              <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">{formatLabel(tournament.format)} · {t('firstTo', { n: tournament.targetScore })}</p>
            </div>
            {champion && (
              <div className="text-center mb-6">
                <Award className="mx-auto text-gold mb-1" size={28} />
                <div className="text-2xl font-bold text-gold uppercase tracking-widest">{champion.player.name}</div>
              </div>
            )}
            <div className="space-y-1 mb-6">
              {rows.slice(0, 8).map((r, i) => (
                <div key={r.player.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 text-center font-bold ${i === 0 ? 'text-gold' : 'text-gray-500'}`}>{i + 1}</span>
                  <span className="flex-1 truncate">{r.player.name}</span>
                  <span className="text-gray-400 text-xs">{t('pts')} {r.pts}</span>
                </div>
              ))}
            </div>
            <button
              className="btn-ghost w-full py-3"
              onClick={exportSummary}
              disabled={exporting}
            >
              <span className="flex items-center justify-center gap-2">
                <ImageIcon size={16} /> {exporting ? t('rendering') : t('exportSummary')}
              </span>
            </button>
          </div>

          {/* Finish-type distribution */}
          <section className="panel p-5">
            <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3 flex items-center gap-2">
              <PieChart size={15} /> {t('finishDistribution')}
            </h3>
            <div className="space-y-3">
              {(['SPIN', 'OVER', 'BURST', 'XTREME', 'DRAW'] as FinishType[]).map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="w-20 text-xs uppercase text-gray-400">{t(FINISH_KEY[f])}</span>
                  <div className="flex-1 h-2 bg-[#2a2d3e] rounded-full overflow-hidden">
                    <div className={`h-full ${finishColors[f]} transition-all duration-500`} style={{ width: `${pct(f)}%` }} />
                  </div>
                  <span className="w-10 text-xs text-right text-gray-400">{pct(f)}%</span>
                </div>
              ))}
              <p className="text-gray-600 text-xs pt-1">{t('recordedRounds', { n: totalFinishes })}</p>
            </div>
          </section>

          {/* Top blades */}
          <section className="panel p-5">
            <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3">{t('topBlades')}</h3>
            {topBlades.length === 0 ? (
              <p className="text-gray-500 text-sm">{t('noRoundData')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topBlades.map(([blade, count]) => (
                  <div key={blade} className="bg-neon/10 border border-neon/40 rounded-full px-3 py-1 text-sm">
                    {blade} <span className="text-neon font-bold ml-1">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}