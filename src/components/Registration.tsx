import { useState } from 'react';
import { Plus, Trash2, Users, ChevronDown, ChevronUp, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import type { Player, Format, Bey } from '../lib/types';
import { uid, TARGET_SCORE_OPTIONS } from '../lib/engine';
import { BeyPicker } from './BeyPicker';
import { useI18n } from '../lib/i18n';

interface Props {
  players: Player[];
  onAddPlayer: (p: Player) => void;
  onRemovePlayer: (id: string) => void;
  onLoadSampleRoster: () => void;
  onStartTournament: (name: string, format: Format, targetScore: number | null) => void;
  hasTournament: boolean;
}

const FORMATS: Format[] = ['round-robin', 'single-elimination', 'swiss'];

const FORMAT_KEY: Record<Format, 'formatRoundRobin' | 'formatSingleElim' | 'formatSwiss'> = {
  'round-robin': 'formatRoundRobin',
  'single-elimination': 'formatSingleElim',
  swiss: 'formatSwiss',
};

export function RegistrationScreen({ players, onAddPlayer, onRemovePlayer, onLoadSampleRoster, onStartTournament, hasTournament }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [showDeckConfig, setShowDeckConfig] = useState(false);
  const [beys, setBeys] = useState<[Bey | null, Bey | null, Bey | null]>([null, null, null]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [format, setFormat] = useState<Format>('round-robin');
  const [targetScore, setTargetScore] = useState<number | null>(4); // null = open / free play
  const [tourneyName, setTourneyName] = useState('');

  const setBey = (i: number, b: Bey | null) => {
    const next = [...beys] as [Bey | null, Bey | null, Bey | null];
    next[i] = b;
    setBeys(next);
  };

  const hasConfiguredDeck = beys.some((b) => b && (b.blade || b.ratchet || b.bit));

  const validateDeck = (): string => {
    const deck = beys.filter(Boolean) as Bey[];
    const dup = (arr: string[], key: 'errDupBlade' | 'errDupRatchet' | 'errDupBit') =>
      new Set(arr.filter(Boolean)).size !== arr.filter(Boolean).length ? t(key) : '';
    return (
      dup(deck.map((b) => b.blade.toLowerCase().trim()), 'errDupBlade') ||
      dup(deck.map((b) => b.ratchet.toLowerCase().trim()), 'errDupRatchet') ||
      dup(deck.map((b) => b.bit.toLowerCase().trim()), 'errDupBit') ||
      ''
    );
  };

  const submit = () => {
    setError('');
    setSuccess('');
    const trimmed = name.trim();
    if (!trimmed) return setError(t('errNameRequired'));
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return setError(t('errNameExists'));

    const invalid = validateDeck();
    if (invalid) return setError(invalid);

    const deck = beys.map(
      (b, i) => b ?? { id: `bey-${i}`, blade: t('notSet'), ratchet: t('notSet'), bit: t('notSet') }
    ) as Player['deck'];

    onAddPlayer({ id: uid(), name: trimmed, deck });
    setSuccess(`${trimmed} ✓`);
    setName('');
    setBeys([null, null, null]);
    setShowDeckConfig(false);
  };

  return (
    <div className="space-y-6">
      {/* Quick Add Blader Section */}
      <section className="panel p-5 border border-neon/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neon tracking-wider uppercase flex items-center gap-2">
            <Sparkles size={18} className="text-neon animate-pulse" />
            {t('registerTitle')}
          </h2>
          <span className="text-xs text-gray-400 font-mono">STEP 1</span>
        </div>

        <div className="space-y-4">
          {/* Quick Load Sample Roster */}
          <div className="flex justify-end mb-2">
            <button
              type="button"
              className="btn-ghost text-xs py-1.5 px-3 rounded-lg border-neon/40 text-neon hover:bg-neon/10 flex items-center gap-1.5 font-mono"
              onClick={() => {
                onLoadSampleRoster();
                setSuccess(t('sampleLoaded'));
              }}
            >
              <Sparkles size={14} className="text-neon" />
              <span>{t('loadSampleRoster')}</span>
            </button>
          </div>

          {/* Direct Blader Name Input */}
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-3 bg-[#1e2235] border border-gray-600/80 rounded-xl focus:border-neon focus:ring-1 focus:ring-neon outline-none transition-all placeholder:text-gray-500 font-semibold text-white tracking-wide"
              placeholder={t('registerName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button
              className="btn-primary px-5 py-3 rounded-xl flex items-center gap-2 shrink-0"
              onClick={submit}
            >
              <Plus size={18} />
              <span>{t('addPlayer')}</span>
            </button>
          </div>

          {/* Clean Expandable Deck Configuration */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowDeckConfig((prev) => !prev)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-mono rounded-lg bg-black/40 hover:bg-black/60 border border-gray-700/60 text-gray-300 transition-colors"
            >
              <span className="flex items-center gap-2">
                {hasConfiguredDeck ? (
                  <CheckCircle2 size={14} className="text-neon" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                )}
                {showDeckConfig ? t('collapseDeck') : t('expandDeck')}
              </span>
              {showDeckConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDeckConfig && (
              <div className="mt-3 p-3 bg-black/30 rounded-xl border border-gray-700/50 space-y-2 animate-fadeIn">
                <p className="text-[11px] text-gray-400 font-mono mb-2">
                  {t('deckRotate')}
                </p>
                <div className="grid sm:grid-cols-3 gap-2">
                  {beys.map((b, i) => (
                    <BeyPicker key={i} index={i} value={b} onChange={(nb) => setBey(i, nb)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-danger text-sm flex items-center gap-1.5 bg-danger/10 p-2.5 rounded-lg border border-danger/30">
              <ShieldAlert size={16} /> {error}
            </p>
          )}
          {success && <p className="text-neon text-sm font-semibold">{success}</p>}
        </div>
      </section>

      {/* Registered Players List */}
      <section className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neon tracking-wider uppercase flex items-center gap-2">
            <Users size={18} /> {t('registeredCount', { n: players.length })}
          </h2>
          <span className="text-xs text-gray-400 font-mono">
            {players.length < 2 ? 'Need 2+ to launch' : 'Ready to battle'}
          </span>
        </div>

        {players.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-700 rounded-xl">
            <p className="text-gray-500 text-sm">{t('noPlayers')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {players.map((p) => {
              const hasCustomBeys = p.deck.some(
                (b) => b.blade !== t('notSet') && b.blade !== '未設定' && b.blade !== 'Not set'
              );
              return (
                <div
                  key={p.id}
                  className="bg-black/40 rounded-xl p-3.5 border border-gray-700/70 hover:border-gray-600 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
                      <h3 className="text-neon font-bold uppercase tracking-wider text-base">{p.name}</h3>
                    </div>
                    <button
                      className="text-gray-500 hover:text-danger p-1 transition-colors"
                      onClick={() => onRemovePlayer(p.id)}
                      aria-label={`${t('delete')} ${p.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="space-y-1 bg-black/20 p-2 rounded-lg border border-gray-800/80">
                    {hasCustomBeys ? (
                      p.deck.map((b, i) => (
                        <div key={i} className="text-xs text-gray-300 font-mono truncate">
                          <span className="text-neon/80 font-bold mr-1">#{i + 1}</span> {b.blade} · {b.ratchet} · {b.bit}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic font-mono">{t('deckEmpty')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Tournament Setup Section */}
      <section className="panel p-5 border border-gray-700/80">
        <h2 className="text-lg font-bold text-neon tracking-wider uppercase mb-4">{t('tourneySetup')}</h2>
        <div className="space-y-4">
          <input
            className="w-full px-4 py-3 bg-[#1e2235] border border-gray-600 rounded-xl focus:border-neon outline-none text-white placeholder:text-gray-500"
            placeholder={t('tourneyName')}
            value={tourneyName}
            onChange={(e) => setTourneyName(e.target.value)}
          />

          {/* Format Selection */}
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-400 block mb-2">{t('format')}</label>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`btn text-xs py-2.5 px-2 rounded-xl transition-all ${
                    format === f ? 'btn-primary border-transparent' : 'btn-ghost border-gray-700'
                  }`}
                  onClick={() => setFormat(f)}
                >
                  {t(FORMAT_KEY[f])}
                </button>
              ))}
            </div>
          </div>

          {/* Target Score Selection: Optional with No Limit Option */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-widest text-gray-400 block">
                {t('targetScore')}{t('optional')}
              </label>
              {targetScore === null && (
                <span className="text-xs text-neon font-mono">{t('freePlay')}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* No limit button */}
              <button
                type="button"
                className={`btn text-xs py-2 px-3 rounded-lg ${
                  targetScore === null ? 'btn-primary' : 'btn-ghost border-gray-700'
                }`}
                onClick={() => setTargetScore(null)}
              >
                {t('targetScoreNone')}
              </button>

              {/* Fixed scores: 4, 5, 6, 7 */}
              {TARGET_SCORE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn text-sm font-bold py-2 px-4 rounded-lg ${
                    targetScore === s ? 'btn-primary' : 'btn-ghost border-gray-700'
                  }`}
                  onClick={() => setTargetScore(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary w-full py-3.5 rounded-xl text-base tracking-widest uppercase font-bold"
            disabled={players.length < 2}
            onClick={() => onStartTournament(tourneyName.trim() || 'Beyblade X 錦標賽', format, targetScore)}
          >
            {t('launch')}
          </button>

          {hasTournament && (
            <p className="text-gray-400 text-xs text-center">{t('tourneyActive')}</p>
          )}
        </div>
      </section>
    </div>
  );
}
