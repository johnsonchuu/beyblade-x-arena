import React from 'react';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AppState, Player, Tournament, Format, Match, MatchRound, FinishType } from './lib/types';
import { uid, roundRobinMatches, bracketMatches } from './lib/engine';
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
  | { type: 'CREATE_TOURNAMENT'; name: string; format: Format; targetScore: number }
  | { type: 'SET_ACTIVE_TOURNAMENT'; id: string | null }
  | { type: 'START_MATCH'; matchId: string }
  | { type: 'RECORD_ROUND'; matchId: string; round: MatchRound }
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
    case 'FINISH_MATCH': {
      const tournaments = state.tournaments.map((t) => {
        if (t.id !== state.activeTournamentId) return t;
        const matches = t.matches.map((m) =>
          m.id === action.matchId
            ? { ...m, completed: true, winnerId: action.winnerId, p1Score: action.p1Score, p2Score: action.p2Score }
            : m
        );
        return { ...t, matches, activeMatchId: null };
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

function ptsForFinish(f: FinishType): number {
  switch (f) {
    case 'SPIN':
      return 1;
    case 'BURST':
    case 'OVER':
      return 2;
    case 'XTREME':
      return 3;
    default:
      return 0;
  }
}

const EMPTY_STATE: AppState = { players: [], tournaments: [], activeTournamentId: null };

export default function App() {
  // Restore persisted state as the *initial* state. It must be read here rather
  // than in a mount effect: effects run in declaration order, so a persist
  // effect declared first would write the empty initial state over the saved
  // data before a bootstrap effect could read it.
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
    (name: string, format: Format, targetScore: number) => {
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
    } else {
      matches = [];
    }
    // Commit matches to tournament (simplified: replace state)
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
            <h2 className="text-xl font-bold text-neon tracking-wider uppercase">{t('settingsTitle')}</h2>
            <div className="flex items-center gap-2 border-b border-gray-700 pb-4">
              <Languages size={18} className="text-gray-400" />
              <span className="text-sm text-gray-400">{t('language')}:</span>
              <button
                className={`btn-ghost text-xs py-1 px-3 ${lang === 'en' ? 'border-neon text-neon' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
              <button
                className={`btn-ghost text-xs py-1 px-3 ${lang === 'zh' ? 'border-neon text-neon' : ''}`}
                onClick={() => setLang('zh')}
              >
                中文
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-ghost flex items-center gap-2" onClick={handleExport}>
                <Download size={18} /> {t('exportJson')}
              </button>
              <button className="btn-ghost flex items-center gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} /> {t('importJson')}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <button className="btn-danger flex items-center gap-2" onClick={handleReset}>
                <Trash2 size={18} /> {t('resetAll')}
              </button>
            </div>
            {state.tournaments.length > 0 && (
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-3">{t('savedTournaments')}</h3>
                <div className="space-y-2">
                  {state.tournaments.map((tr) => (
                    <div key={tr.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 text-gray-200">{tr.name}</span>
                      <button
                        className="btn-ghost text-xs py-1 px-3"
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_TOURNAMENT', id: tr.id });
                          setScreen('dashboard');
                        }}
                      >
                        {t('switch')}
                      </button>
                      <button
                        className="text-danger text-xs hover:underline"
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
    <div className="min-h-screen bg-bg flex flex-col items-center px-3 py-4 pb-24">
      {/* Header */}
      <header className="w-full max-w-2xl text-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-neon tracking-widest uppercase" style={{ textShadow: '0 0 10px rgba(0,255,204,0.5)' }}>
          {t('appTitle')}
        </h1>
        <p className="text-gray-500 text-xs tracking-wider mt-1">{t('appSubtitle')}</p>
      </header>

      {/* Main content */}
      <main className="w-full max-w-2xl">{renderScreen()}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-panel border-t border-gray-700/80 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-14">
          {[
            { id: 'registration' as Screen, icon: Plus, label: t('navRegister') },
            { id: 'dashboard' as Screen, icon: Swords, label: t('navTourney') },
            { id: 'arena' as Screen, icon: Trophy, label: t('navArena') },
            { id: 'analytics' as Screen, icon: BarChart3, label: t('navStats') },
            { id: 'settings' as Screen, icon: Settings, label: t('navSettings') },
          ].map((tab) => {
            const active = screen === tab.id;
            // Only enable arena if there is an active match
            const disabled = tab.id === 'arena' && !activeTournament?.activeMatchId;
            return (
              <button
                key={tab.id}
                disabled={disabled}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors
                  ${active ? 'text-neon' : disabled ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-gray-200'}
                `}
                onClick={() => setScreen(tab.id)}
              >
                <tab.icon size={18} />
                <span className="text-[10px] uppercase tracking-widest">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}