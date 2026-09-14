import React from 'react';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AppState, Player, Tournament, Format, Match, MatchRound } from './lib/types';
import {
  uid,
  roundRobinMatches,
  bracketMatches,
  advanceBracketWinner,
  resetDownstreamBracketMatches,
  swissRound,
  ptsForFinish,
  SAMPLE_ROSTER,
} from './lib/engine';
import { loadState, saveState, clearState, exportJson, importJson } from './lib/storage';
import { RegistrationScreen } from './components/Registration';
import { DashboardScreen } from './components/Dashboard';
import { MatchArenaScreen } from './components/MatchArena';
import { AnalyticsScreen } from './components/Analytics';
import { Trophy, BarChart3, Settings, Download, Upload, Trash2, Plus, Swords, Languages } from 'lucide-react';
import { useI18n } from './lib/i18n';

type Screen = 'registration' | 'dashboard' | 'arena' | 'analytics' | 'settings';

type Action =
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'LOAD_SAMPLE_ROSTER' }
  | { type: 'CREATE_TOURNAMENT'; name: string; format: Format; targetScore: number | null }
  | { type: 'SET_ACTIVE_TOURNAMENT'; id: string | null }
  | { type: 'START_MATCH'; matchId: string }
  | { type: 'RECORD_ROUND'; matchId: string; round: MatchRound }
  | { type: 'UNDO_ROUND'; matchId: string }
  | { type: 'REPLAY_MATCH'; matchId: string }
  | { type: 'EDIT_MATCH_IN_ARENA'; matchId: string }
  | { type: 'FINISH_MATCH'; matchId: string; p1Score: number; p2Score: number; winnerId: string | null }
  | { type: 'CANCEL_MATCH' }
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'RESET_ALL' }
  | { type: 'DELETE_TOURNAMENT'; id: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PLAYERS':
      return { ...state, players: action.players };
    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.player] };
    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter((p) => p.id !== action.id) };
    case 'LOAD_SAMPLE_ROSTER':
      return { ...state, players: [...SAMPLE_ROSTER] };
    case 'CREATE_TOURNAMENT': {
      const t: Tournament = {
        id: uid(),
        name: action.name,
        format: action.format,
        targetScore: action.targetScore,
        createdAt: Date.now(),
        players: [...state.players],
        matches: [],
        activeMatchId: null,
      };
      return { ...state, tournaments: [...state.tournaments, t], activeTournamentId: t.id };
    }
    case 'SET_ACTIVE_TOURNAMENT':
      return { ...state, activeTournamentId: action.id };
    case 'START_MATCH': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        const matches = t.matches.map((m) => (m.id === action.matchId ? { ...m } : m));
        return { ...t, matches, activeMatchId: action.matchId };
      });
      return { ...state, tournaments };
    }
    case 'RECORD_ROUND': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        const matches = t.matches.map((m) => {
          if (m.id !== action.matchId) return m;
          const rounds = [...m.rounds, action.round];
          const r = action.round;
          let p1Score = m.p1Score;
          let p2Score = m.p2Score;
          if (r.winnerId === m.p1Id) p1Score += ptsForFinish(r.finish);
          else if (r.winnerId === m.p2Id) p2Score += ptsForFinish(r.finish);
          return { ...m, rounds, p1Score, p2Score };
        });
        return { ...t, matches };
      });
      return { ...state, tournaments };
    }
    case 'UNDO_ROUND': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        const matches = t.matches.map((m) => {
          if (m.id !== action.matchId || m.rounds.length === 0) return m;
          const rounds = m.rounds.slice(0, -1);
          let p1Score = 0;
          let p2Score = 0;
          rounds.forEach((r) => {
            if (r.winnerId === m.p1Id) p1Score += ptsForFinish(r.finish);
            else if (r.winnerId === m.p2Id) p2Score += ptsForFinish(r.finish);
          });
          return { ...m, rounds, p1Score, p2Score, completed: false, winnerId: null };
        });
        return { ...t, matches };
      });
      return { ...state, tournaments };
    }
    case 'REPLAY_MATCH': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        let matches = t.matches.map((m) =>
          m.id === action.matchId
            ? { ...m, rounds: [], p1Score: 0, p2Score: 0, winnerId: null, completed: false }
            : m
        );
        if (t.format === 'single-elimination') {
          matches = resetDownstreamBracketMatches(matches, action.matchId);
        }
        return { ...t, matches, activeMatchId: action.matchId };
      });
      return { ...state, tournaments };
    }
    case 'EDIT_MATCH_IN_ARENA': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        const matches = t.matches.map((m) =>
          m.id === action.matchId
            ? { ...m, completed: false, winnerId: null }
            : m
        );
        return { ...t, matches, activeMatchId: action.matchId };
      });
      return { ...state, tournaments };
    }
    case 'FINISH_MATCH': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        let updatedMatches = t.matches.map((m) =>
          m.id === action.matchId
            ? { ...m, completed: true, winnerId: action.winnerId, p1Score: action.p1Score, p2Score: action.p2Score }
            : m
        );
        // If single elimination, automatically propagate winner to the next round bracket match
        if (t.format === 'single-elimination') {
          updatedMatches = advanceBracketWinner(updatedMatches, action.matchId, action.winnerId);
        }
        return { ...t, matches: updatedMatches, activeMatchId: null };
      });
      return { ...state, tournaments };
    }
    case 'CANCEL_MATCH': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        return { ...t, activeMatchId: null };
      });
      return { ...state, tournaments };
    }
    case 'LOAD_STATE':
      return action.state;
    case 'RESET_ALL':
      return { players: [], tournaments: [], activeTournamentId: null };
    case 'DELETE_TOURNAMENT': {
      const tournaments = state.tournaments.filter((t) => t.id !== action.id);
      const activeTournamentId = state.activeTournamentId === action.id ? null : state.activeTournamentId;
      return { ...state, tournaments, activeTournamentId };
    }
    default:
      return state;
  }
}

const EMPTY_STATE: AppState = { players: [], tournaments: [], activeTournamentId: null };

export default function App() {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE, (fallback) => loadState() ?? fallback);
  const [screen, setScreen] = React.useState<Screen>('registration');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, lang, setLang } = useI18n();

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Derive current tournament
  const activeTournament = state.tournaments.find((t) => t.id === state.activeTournamentId) ?? null;

  const handleStartTournament = useCallback(
    (name: string, format: Format, targetScore: number | null) => {
      dispatch({ type: 'CREATE_TOURNAMENT', name, format, targetScore });
      setScreen('dashboard');
    },
    []
  );

  const handleGenerateMatches = useCallback(() => {
    if (!activeTournament) return;
    let matches: Match[];
    const t = activeTournament;

    if (t.format === 'round-robin') {
      matches = roundRobinMatches(t.players);
    } else if (t.format === 'single-elimination') {
      matches = bracketMatches(t.players, true);
    } else if (t.format === 'swiss') {
      // If no matches yet, generate round 1
      if (t.matches.length === 0) {
        matches = swissRound(t.players, [], 1);
      } else {
        // Generate next round based on previous completed rounds
        const maxRound = Math.max(...t.matches.map((m) => m.round), 0);
        const nextRoundMatches = swissRound(t.players, t.matches, maxRound + 1);
        matches = [...t.matches, ...nextRoundMatches];
      }
    } else {
      matches = [];
    }

    // Commit matches to tournament
    const tournaments = state.tournaments.map((ot) => {
      if (ot.id !== t.id) return ot;
      return { ...ot, matches };
    });
    dispatch({ type: 'LOAD_STATE', state: { ...state, tournaments } });
  }, [activeTournament, state]);

  const handleExport = () => {
    exportJson(state);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importJson(file).then((s) => {
      dispatch({ type: 'LOAD_STATE', state: s });
      e.target.value = '';
    });
  };

  const handleReset = () => {
    if (confirm('Reset all data?')) {
      clearState();
      dispatch({ type: 'RESET_ALL' });
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'registration':
        return (
          <RegistrationScreen
            players={state.players}
            onAddPlayer={(p) => dispatch({ type: 'ADD_PLAYER', player: p })}
            onRemovePlayer={(id) => dispatch({ type: 'REMOVE_PLAYER', id })}
            onLoadSampleRoster={() => dispatch({ type: 'LOAD_SAMPLE_ROSTER' })}
            onStartTournament={handleStartTournament}
            hasTournament={!!activeTournament}
          />
        );
      case 'dashboard':
        return (
          <DashboardScreen
            tournament={activeTournament}
            onGenerateMatches={handleGenerateMatches}
            onStartMatch={(matchId) => {
              dispatch({ type: 'START_MATCH', matchId });
              setScreen('arena');
            }}
            onReplayMatch={(matchId) => {
              dispatch({ type: 'REPLAY_MATCH', matchId });
              setScreen('arena');
            }}
            onEditMatchInArena={(matchId) => {
              dispatch({ type: 'EDIT_MATCH_IN_ARENA', matchId });
              setScreen('arena');
            }}
            onScreenChange={setScreen}
          />
        );
      case 'arena':
        return (
          <MatchArenaScreen
            tournament={activeTournament}
            players={state.players}
            onRecordRound={(matchId, round) => dispatch({ type: 'RECORD_ROUND', matchId, round })}
            onFinishMatch={(matchId, p1Score, p2Score, winnerId) => {
              dispatch({ type: 'FINISH_MATCH', matchId, p1Score, p2Score, winnerId });
              setScreen('dashboard');
            }}
            onCancel={() => {
              dispatch({ type: 'CANCEL_MATCH' });
              setScreen('dashboard');
            }}
          />
        );
      case 'analytics':
        return (
          <AnalyticsScreen tournament={activeTournament} />
        );
      case 'settings':
        return (
          <div className="panel p-6 space-y-6">
            <h2 className="text-xl font-bold text-neon tracking-wider uppercase font-heading">{t('settingsTitle')}</h2>
            <div className="flex items-center gap-2 border-b border-gray-700 pb-4">
              <Languages size={18} className="text-gray-400" />
              <span className="text-sm text-gray-400 font-mono">{t('language')}:</span>
              <button
                className={`btn-ghost text-xs py-1.5 px-3 rounded-lg ${lang === 'en' ? 'border-neon text-neon' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
              <button
                className={`btn-ghost text-xs py-1.5 px-3 rounded-lg ${lang === 'zh' ? 'border-neon text-neon' : ''}`}
                onClick={() => setLang('zh')}
              >
                中文
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-ghost flex items-center gap-2 py-2 px-4 rounded-xl" onClick={handleExport}>
                <Download size={18} /> {t('exportJson')}
              </button>
              <button className="btn-ghost flex items-center gap-2 py-2 px-4 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} /> {t('importJson')}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <button className="btn-danger flex items-center gap-2 py-2 px-4 rounded-xl" onClick={handleReset}>
                <Trash2 size={18} /> {t('resetAll')}
              </button>
            </div>
            {state.tournaments.length > 0 && (
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-3 font-mono">{t('savedTournaments')}</h3>
                <div className="space-y-2">
                  {state.tournaments.map((tr) => (
                    <div key={tr.id} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-black/20 border border-gray-800">
                      <span className="flex-1 text-gray-200 font-medium">{tr.name}</span>
                      <button
                        className="btn-ghost text-xs py-1 px-3 rounded"
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_TOURNAMENT', id: tr.id });
                          setScreen('dashboard');
                        }}
                      >
                        {t('switch')}
                      </button>
                      <button
                        className="text-danger text-xs hover:underline px-2"
                        onClick={() => {
                          if (confirm(t('deleteConfirm', { name: tr.name }))) {
                            dispatch({ type: 'DELETE_TOURNAMENT', id: tr.id });
                          }
                        }}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-3 py-4 pb-32">
      {/* Header */}
      <header className="w-full max-w-2xl text-center mb-4 pt-1">
        <h1 className="text-2xl sm:text-3xl font-black text-neon tracking-widest uppercase font-heading" style={{ textShadow: '0 0 15px rgba(0,255,204,0.6)' }}>
          {t('appTitle')}
        </h1>
        <p className="text-gray-400 text-xs tracking-wider mt-1 font-mono uppercase">{t('appSubtitle')}</p>
      </header>

      {/* Main content */}
      <main className="w-full max-w-2xl">{renderScreen()}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-panel/95 backdrop-blur-md border-t border-gray-700/80 z-50 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-15 py-1">
          {[
            { id: 'registration' as Screen, icon: Plus, label: t('navRegister') },
            { id: 'dashboard' as Screen, icon: Swords, label: t('navTourney') },
            { id: 'arena' as Screen, icon: Trophy, label: t('navArena') },
            { id: 'analytics' as Screen, icon: BarChart3, label: t('navStats') },
            { id: 'settings' as Screen, icon: Settings, label: t('navSettings') },
          ].map((tab) => {
            const active = screen === tab.id;
            const disabled = tab.id === 'arena' && !activeTournament?.activeMatchId;
            return (
              <button
                key={tab.id}
                disabled={disabled}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all
                  ${active ? 'text-neon font-bold scale-105' : disabled ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200'}
                `}
                onClick={() => setScreen(tab.id)}
              >
                <tab.icon size={19} className={active ? 'text-neon animate-pulse' : ''} />
                <span className="text-[10px] uppercase tracking-widest font-mono">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
