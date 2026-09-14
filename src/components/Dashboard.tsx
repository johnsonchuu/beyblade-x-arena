import { Swords, PlayCircle, Trophy, BarChart3, RefreshCw, Layers, UserCheck, Radio, Zap } from 'lucide-react';
import type { Match, Tournament, Player } from '../lib/types';
import { computeStandings, playerName, formatLabel, getNextReadyMatch } from '../lib/engine';
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
  const nextReadyMatch = getNextReadyMatch(tournament);

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

      {/* On-Deck Hero Banner */}
      {nextReadyMatch && (
        <section className="panel p-5 relative overflow-hidden border-2 border-neon/60 shadow-glow bg-gradient-to-r from-panel via-panel/95 to-neon/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-neon" />
                </span>
                <Radio size={16} className="text-neon animate-pulse" />
                <span className="font-heading font-bold text-xs uppercase tracking-widest text-neon">
                  {t('onDeck')}
                </span>
                <span className="text-[11px] font-mono text-gray-400 border border-gray-700/60 bg-black/40 px-2 py-0.5 rounded-md">
                  {t('matchNumShort', { n: tournament.matches.findIndex((m) => m.id === nextReadyMatch.id) + 1 })}
                </span>
              </div>
              <div className="text-lg sm:text-xl font-bold font-heading text-white truncate">
                <span className="text-white">{playerName(tournament.players, nextReadyMatch.p1Id)}</span>
                <span className="text-danger font-bold mx-2 text-sm">VS</span>
                <span className="text-white">{playerName(tournament.players, nextReadyMatch.p2Id)}</span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                {t('onDeckSub')}
              </p>
            </div>
            <button
              onClick={() => onStartMatch(nextReadyMatch.id)}
              className="btn-primary w-full sm:w-auto px-6 py-3 rounded-xl shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-2 font-heading text-sm tracking-wider flex-shrink-0"
            >
              <Zap size={16} className="fill-black" />
              {t('enterStadium')}
            </button>
          </div>
        </section>
      )}

      {/* Sequential 1-by-1 Match Queue */}
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

          {/* Sequential 1-by-1 Match List */}
          <div className="space-y-3">
            {tournament.matches.map((m, idx) => (
              <MatchCard
                key={m.id}
                matchIndex={idx + 1}
                isNextReady={nextReadyMatch?.id === m.id}
                match={m}
                tournament={tournament}
                onStart={() => onStartMatch(m.id)}
              />
            ))}
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

function MatchCard({
  match,
  matchIndex,
  isNextReady,
  tournament,
  onStart,
}: {
  match: Match;
  matchIndex: number;
  isNextReady: boolean;
  tournament: Tournament;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const p1 = playerName(tournament.players, match.p1Id);
  const p2 = playerName(tournament.players, match.p2Id);
  const isActive = tournament.activeMatchId === match.id;
  const isReady = Boolean(match.p1Id && match.p2Id && !match.completed && !isActive);

  // Status visual styles per brief:
  // ACTIVE: bg-neon/10 border-neon
  // NEXT READY: border-gold/60
  // READY: border-gray-700
  // COMPLETED: border-gray-800 bg-black/40 (visually muted, keep clickable)
  // WAITING: opacity-40
  const cardBorderClass = match.completed
    ? 'border-gray-800 bg-black/40 hover:border-gray-600 hover:bg-black/60 cursor-pointer'
    : isActive
      ? 'border-neon bg-neon/10 ring-1 ring-neon shadow-glow cursor-default'
      : isNextReady
        ? 'border-gold/60 bg-gold/[0.03] hover:border-gold hover:bg-gold/[0.08] shadow-[0_0_15px_rgba(255,230,0,0.15)] cursor-pointer'
        : isReady
          ? 'border-gray-700 bg-black/30 hover:border-neon hover:bg-white/[0.03] cursor-pointer'
          : 'border-gray-800 bg-black/20 opacity-40 cursor-not-allowed';

  return (
    <div
      onClick={() => {
        if (isReady) {
          onStart();
        }
      }}
      className={`rounded-xl p-4 border transition-all duration-200 ${cardBorderClass}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/50 border border-gray-700 text-neon">
            MATCH #{matchIndex}
          </span>
          <span className="text-[11px] font-mono text-gray-400 bg-black/30 px-2 py-0.5 rounded border border-gray-800">
            {t('roundTitle', { r: match.round })}
          </span>
          {isNextReady && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/40 animate-pulse">
              {t('onDeck')}
            </span>
          )}
        </div>

        {match.completed ? (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/50 text-gray-400 border border-gray-800">
            COMPLETED
          </span>
        ) : isActive ? (
          <div className="flex items-center gap-1.5 text-neon text-xs uppercase tracking-widest font-mono font-bold">
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
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-base font-semibold truncate flex-1 font-heading">
          <span className={match.winnerId === match.p1Id ? 'text-gold font-bold' : 'text-white'}>
            {p1}
          </span>
          <span className="text-danger font-bold mx-2 text-xs">VS</span>
          <span className={match.winnerId === match.p2Id ? 'text-gold font-bold' : 'text-white'}>
            {p2}
          </span>
        </div>

        {match.completed && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-neon font-bold text-base px-2.5 py-0.5 rounded bg-black/60 border border-neon/30">
              {match.p1Score} - {match.p2Score}
            </span>
            <span className="text-gray-500">
              {match.rounds.length > 0 && `(${t('countRounds', { n: match.rounds.length })})`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
