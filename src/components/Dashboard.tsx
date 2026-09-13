import { Swords, PlayCircle, Trophy, BarChart3, RefreshCw } from 'lucide-react';
import type { Match, Tournament } from '../lib/types';
import { computeStandings, playerName, formatLabel } from '../lib/engine';
import { useI18n } from '../lib/i18n';

interface Props {
  tournament: Tournament | null;
  onGenerateMatches: () => void;
  onStartMatch: (matchId: string) => void;
  onScreenChange: (s: 'analytics') => void;
}

export function DashboardScreen({ tournament, onGenerateMatches, onStartMatch, onScreenChange }: Props) {
  const { t } = useI18n();
  if (!tournament) {
    return (
      <div className="panel p-6 text-center space-y-4">
        <Swords className="mx-auto text-neon" size={40} />
        <h2 className="text-xl font-bold uppercase tracking-wider">{t('noActiveTourney')}</h2>
        <p className="text-gray-500 text-sm">{t('noActiveTourneyDesc')}</p>
      </div>
    );
  }

  const rows = computeStandings(tournament.players, tournament.matches);
  const completed = tournament.matches.filter((m) => m.completed).length;
  const pct = tournament.matches.length ? Math.round((completed / tournament.matches.length) * 100) : 0;
  const winner = rows[0];

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neon uppercase tracking-wider">{tournament.name}</h2>
            <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">
              {formatLabel(tournament.format)} · {t('firstTo', { n: tournament.targetScore })}
            </p>
          </div>
          {winner && winner.wins > 0 && (
            <div className="flex items-center gap-2 text-gold">
              <Trophy size={18} />
              <span className="font-bold uppercase tracking-wider text-sm">{winner.player.name}</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-1">{t('matchesCompleted', { done: completed, total: tournament.matches.length })}</div>
          <div className="h-2 bg-[#2a2d3e] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-neon to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </section>

      {tournament.matches.length === 0 && (
        <section className="panel p-5 text-center">
          <p className="text-gray-400 text-sm mb-4">{t('scheduleNotGenerated')}</p>
          <button className="btn-primary px-6 py-3" onClick={onGenerateMatches}>
            <span className="flex items-center justify-center gap-2"><RefreshCw size={16} /> {t('generateSchedule')}</span>
          </button>
        </section>
      )}

      {/* Standings */}
      <section className="panel p-5">
        <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3">{t('leaderboard')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left py-2">#</th>
                <th className="text-left">Blader</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-center">{t('pts')}</th>
                <th className="text-center">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.player.id} className="border-t border-gray-700/60">
                  <td className="py-2 px-1 text-gray-500">{i + 1}</td>
                  <td className="font-semibold">{r.player.name}</td>
                  <td className="text-center text-neon">{r.wins}</td>
                  <td className="text-center text-danger">{r.losses}</td>
                  <td className="text-center">{r.pts}</td>
                  <td className="text-center text-gray-400">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Matches */}
      {tournament.matches.length > 0 && (
        <section className="panel p-5">
          <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3">{t('matches')}</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {tournament.matches.map((m) => (
              <MatchCard key={m.id} match={m} tournament={tournament} onStart={() => onStartMatch(m.id)} />
            ))}
          </div>
        </section>
      )}

      <button className="btn-ghost w-full py-3" onClick={() => onScreenChange('analytics')}>
        <span className="flex items-center justify-center gap-2"><BarChart3 size={16} /> {t('viewMeta')}</span>
      </button>
    </div>
  );
}

function MatchCard({ match, tournament, onStart }: { match: Match; tournament: Tournament; onStart: () => void }) {
  const { t } = useI18n();
  const p1 = playerName(tournament.players, match.p1Id);
  const p2 = playerName(tournament.players, match.p2Id);
  const isActive = tournament.activeMatchId === match.id;

  return (
    <button
      onClick={() => !match.completed && onStart()}
      disabled={match.completed || isActive}
      className={`text-left rounded-lg p-3 border transition-all
        ${match.completed
          ? 'opacity-50 cursor-default border-gray-700'
          : isActive
            ? 'border-neon shadow-glow bg-neon/5 cursor-default'
            : 'border-gray-700 hover:border-neon cursor-pointer'}`}
    >
      <div className="text-sm font-semibold mb-1">
        {p1} <span className="text-danger font-bold mx-1">VS</span> {p2}
      </div>
      {match.completed ? (
        <div className="text-neon font-bold">
          {match.p1Score} - {match.p2Score}
          {match.rounds.length > 0 && <span className="text-gray-500 text-xs ml-2">({t('countRounds', { n: match.rounds.length })})</span>}
        </div>
      ) : isActive ? (
        <div className="flex items-center gap-1 text-neon text-xs uppercase tracking-widest"><PlayCircle size={14} /> {t('inProgress')}</div>
      ) : (
        <div className="text-gray-500 text-xs uppercase tracking-widest">{t('clickToPlay')}</div>
      )}
    </button>
  );
}