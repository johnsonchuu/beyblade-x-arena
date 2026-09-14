import { Swords, PlayCircle, Trophy, BarChart3, RefreshCw, Layers, UserCheck } from 'lucide-react';
import type { Match, Tournament, Player } from '../lib/types';
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
      <div className="panel p-8 text-center space-y-4">
        <Swords className="mx-auto text-neon animate-bounce-short" size={48} />
        <h2 className="text-xl font-bold uppercase tracking-wider font-heading">{t('noActiveTourney')}</h2>
        <p className="text-gray-400 text-sm">{t('noActiveTourneyDesc')}</p>
      </div>
    );
  }

  const rows = computeStandings(tournament.players, tournament.matches);
  const completed = tournament.matches.filter((m) => m.completed).length;
  const pct = tournament.matches.length ? Math.round((completed / tournament.matches.length) * 100) : 0;
  const winner = rows[0];

  // Group matches by round for rest-balanced circulation rundown
  const matchesByRound = new Map<number, Match[]>();
  tournament.matches.forEach((m) => {
    const list = matchesByRound.get(m.round) || [];
    list.push(m);
    matchesByRound.set(m.round, list);
  });
  const roundNumbers = Array.from(matchesByRound.keys()).sort((a, b) => a - b);

  // Determine current active/next round
  const currentRoundNum = roundNumbers.find((r) => {
    const ms = matchesByRound.get(r) || [];
    return ms.some((m) => !m.completed);
  }) ?? (roundNumbers[roundNumbers.length - 1] || 1);

  // Compute resting/bye bladers for the current round
  const currentRoundMatches = matchesByRound.get(currentRoundNum) || [];
  const activeBladerIdsInRound = new Set<string>();
  currentRoundMatches.forEach((m) => {
    if (m.p1Id) activeBladerIdsInRound.add(m.p1Id);
    if (m.p2Id) activeBladerIdsInRound.add(m.p2Id);
  });
  const restingBladers: Player[] = tournament.players.filter(
    (p) => !activeBladerIdsInRound.has(p.id)
  );

  return (
    <div className="space-y-6">
      {/* Header card with cyber glow */}
      <section className="panel p-5 relative overflow-hidden border border-neon/30">
        <div className="absolute top-0 right-0 w-48 h-48 bg-neon/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-neon uppercase tracking-wider font-heading">{tournament.name}</h2>
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest mt-1">
              {formatLabel(tournament.format)} · {tournament.targetScore !== null ? t('firstTo', { n: tournament.targetScore }) : t('firstToNone')}
            </p>
          </div>
          {winner && winner.wins > 0 && (
            <div className="flex items-center gap-2 text-gold bg-gold/10 px-3 py-1.5 rounded-xl border border-gold/40">
              <Trophy size={18} className="animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-sm font-heading">{winner.player.name}</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1 font-mono">
            <span>{t('matchesCompleted', { done: completed, total: tournament.matches.length })}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-[#1b1e2c] rounded-full overflow-hidden border border-gray-800">
            <div
              className="h-full bg-gradient-to-r from-neon via-teal-400 to-emerald-400 transition-all duration-500 shadow-glow"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Schedule Generator */}
      {tournament.matches.length === 0 && (
        <section className="panel p-6 text-center space-y-4 border border-dashed border-neon/40">
          <p className="text-gray-300 text-sm font-mono">{t('scheduleNotGenerated')}</p>
          <button className="btn-primary px-8 py-3.5 rounded-xl shadow-glow hover:shadow-glow-lg text-base" onClick={onGenerateMatches}>
            <span className="flex items-center justify-center gap-2 font-heading tracking-wider">
              <RefreshCw size={18} /> {t('generateSchedule')}
            </span>
          </button>
        </section>
      )}

      {/* Standings Leaderboard */}
      <section className="panel p-5">
        <h3 className="text-sm font-bold text-neon uppercase tracking-widest mb-3 font-heading flex items-center gap-2">
          <Trophy size={16} className="text-gold" /> {t('leaderboard')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider font-mono border-b border-gray-700/60">
                <th className="text-left py-2.5 px-2">#</th>
                <th className="text-left">Blader</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-center">D</th>
                <th className="text-center">{t('pts')}</th>
                <th className="text-center">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.player.id} className="border-t border-gray-800/80 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-2 font-mono text-gray-500">{i + 1}</td>
                  <td className="font-semibold text-white tracking-wide">
                    {r.player.name}
                    {i === 0 && r.wins > 0 && <span className="ml-2 text-xs text-gold">👑</span>}
                  </td>
                  <td className="text-center font-mono font-bold text-neon">{r.wins}</td>
                  <td className="text-center font-mono text-danger">{r.losses}</td>
                  <td className="text-center font-mono text-gray-400">{r.draws}</td>
                  <td className="text-center font-mono font-bold text-white">{r.pts}</td>
                  <td className="text-center font-mono text-gray-400">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Match Rundown: Grouped by Round with Rest Allocation */}
      {tournament.matches.length > 0 && (
        <section className="panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-neon uppercase tracking-widest font-heading flex items-center gap-2">
                <Layers size={16} className="text-neon" /> {t('matches')}
              </h3>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">{t('roundRundown')}</p>
            </div>

            {/* Resting / On deck bladers badge */}
            <div className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 bg-black/40 rounded-lg border border-gray-700/60">
              <UserCheck size={14} className="text-neon" />
              <span className="text-gray-400">{t('restingBladers')}:</span>
              {restingBladers.length > 0 ? (
                <span className="text-gold font-bold">
                  {restingBladers.map((b) => b.name).join(', ')}
                </span>
              ) : (
                <span className="text-gray-500">{t('noResting')}</span>
              )}
            </div>
          </div>

          {/* Swiss Next Round Pairing Button if applicable */}
          {tournament.format === 'swiss' && completed === tournament.matches.length && (
            <div className="text-center p-3 bg-black/40 rounded-xl border border-neon/40">
              <button
                className="btn-primary py-2.5 px-6 rounded-lg text-xs"
                onClick={onGenerateMatches}
              >
                <RefreshCw size={14} className="inline mr-1" />
                {t('generateNextRound')}
              </button>
            </div>
          )}

          {/* Rounds display */}
          <div className="space-y-6">
            {roundNumbers.map((roundNum) => {
              const roundMatches = matchesByRound.get(roundNum) || [];
              const isCurrentRound = roundNum === currentRoundNum;

              return (
                <div key={roundNum} className={`rounded-xl p-3.5 transition-all ${
                  isCurrentRound ? 'bg-black/40 border border-neon/40 shadow-glow' : 'bg-black/20 border border-gray-800'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isCurrentRound ? 'bg-neon animate-pulse' : 'bg-gray-600'}`} />
                      <h4 className="font-heading font-bold uppercase tracking-wider text-xs text-white">
                        {t('roundTitle', { r: roundNum })}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">
                      {roundMatches.filter((m) => m.completed).length} / {roundMatches.length} done
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {roundMatches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        tournament={tournament}
                        onStart={() => onStartMatch(m.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Button to navigate to social share card / meta stats */}
      <button className="btn-ghost w-full py-3.5 rounded-xl border border-neon/50 text-neon hover:bg-neon/10" onClick={() => onScreenChange('analytics')}>
        <span className="flex items-center justify-center gap-2 font-heading tracking-wider">
          <BarChart3 size={18} /> {t('viewMeta')}
        </span>
      </button>
    </div>
  );
}

function MatchCard({ match, tournament, onStart }: { match: Match; tournament: Tournament; onStart: () => void }) {
  const { t } = useI18n();
  const p1 = playerName(tournament.players, match.p1Id);
  const p2 = playerName(tournament.players, match.p2Id);
  const isActive = tournament.activeMatchId === match.id;
  const isReady = match.p1Id && match.p2Id && !match.completed && !isActive;

  return (
    <button
      onClick={() => isReady && onStart()}
      disabled={!isReady}
      className={`text-left rounded-xl p-3.5 border transition-all ${
        match.completed
          ? 'opacity-65 cursor-default bg-black/40 border-gray-800'
          : isActive
            ? 'border-neon shadow-glow bg-neon/10 cursor-default ring-1 ring-neon'
            : isReady
              ? 'border-gray-700 bg-black/30 hover:border-neon hover:bg-white/[0.03] cursor-pointer'
              : 'opacity-40 cursor-not-allowed border-gray-800 bg-black/20'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-sm font-semibold truncate flex-1">
          <span className={match.winnerId === match.p1Id ? 'text-gold font-bold' : 'text-white'}>{p1}</span>
          <span className="text-danger font-bold mx-1.5 text-xs">VS</span>
          <span className={match.winnerId === match.p2Id ? 'text-gold font-bold' : 'text-white'}>{p2}</span>
        </div>
      </div>

      {match.completed ? (
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-neon font-bold text-sm">
            {match.p1Score} - {match.p2Score}
          </span>
          <span className="text-gray-500">
            {match.rounds.length > 0 && `(${t('countRounds', { n: match.rounds.length })})`}
          </span>
        </div>
      ) : isActive ? (
        <div className="flex items-center gap-1.5 text-neon text-xs uppercase tracking-widest font-mono">
          <PlayCircle size={14} className="animate-spin" /> {t('inProgress')}
        </div>
      ) : isReady ? (
        <div className="text-gray-400 text-xs uppercase tracking-widest font-mono flex items-center gap-1">
          <Swords size={12} className="text-neon" /> {t('clickToPlay')}
        </div>
      ) : (
        <div className="text-gray-600 text-xs uppercase tracking-widest font-mono">
          Waiting for prior match
        </div>
      )}
    </button>
  );
}
