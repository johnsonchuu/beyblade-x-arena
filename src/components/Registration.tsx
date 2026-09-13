import { useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import type { Player, Format, Bey } from '../lib/types';
import { uid, TARGET_SCORE_OPTIONS } from '../lib/engine';
import { BeyPicker } from './BeyPicker';
import { useI18n } from '../lib/i18n';

interface Props {
  players: Player[];
  onAddPlayer: (p: Player) => void;
  onRemovePlayer: (id: string) => void;
  onStartTournament: (name: string, format: Format, targetScore: number) => void;
  hasTournament: boolean;
}

const FORMATS: Format[] = ['round-robin', 'single-elimination', 'swiss'];

const FORMAT_KEY: Record<Format, 'formatRoundRobin' | 'formatSingleElim' | 'formatSwiss'> = {
  'round-robin': 'formatRoundRobin',
  'single-elimination': 'formatSingleElim',
  swiss: 'formatSwiss',
};

export function RegistrationScreen({ players, onAddPlayer, onRemovePlayer, onStartTournament, hasTournament }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [beys, setBeys] = useState<[Bey | null, Bey | null, Bey | null]>([null, null, null]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [format, setFormat] = useState<Format>('round-robin');
  const [targetScore, setTargetScore] = useState(4);
  const [tourneyName, setTourneyName] = useState('');

  const setBey = (i: number, b: Bey | null) => {
    const next = [...beys] as [Bey | null, Bey | null, Bey | null];
    next[i] = b;
    setBeys(next);
  };

  const validateDeck = (): string => {
    const deck = beys.filter(Boolean) as Bey[];
    const dup = (arr: string[], key: 'errDupBlade' | 'errDupRatchet' | 'errDupBit') =>
      new Set(arr).size !== arr.length ? t(key) : '';
    return (
      dup(deck.map((b) => b.blade.toLowerCase()), 'errDupBlade') ||
      dup(deck.map((b) => b.ratchet.toLowerCase()), 'errDupRatchet') ||
      dup(deck.map((b) => b.bit.toLowerCase()), 'errDupBit') ||
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
  };

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <h2 className="text-lg font-bold text-neon tracking-wider uppercase mb-4">{t('registerTitle')}</h2>
        <div className="space-y-4">
          <input
            className="w-full px-4 py-3 bg-[#2a2d3e] border border-gray-600 rounded-lg focus:border-neon outline-none transition-colors"
            placeholder={t('registerName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <div className="grid sm:grid-cols-3 gap-2">
            {beys.map((b, i) => (
              <BeyPicker key={i} index={i} value={b} onChange={(nb) => setBey(i, nb)} />
            ))}
          </div>
          <button className="btn-primary w-full py-3" onClick={submit}>
            <span className="flex items-center justify-center gap-2"><Plus size={18} /> {t('addPlayer')}</span>
          </button>
          {error && <p className="text-danger text-sm">{error}</p>}
          {success && <p className="text-neon text-sm">{success}</p>}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold text-neon tracking-wider uppercase mb-4 flex items-center gap-2">
          <Users size={18} /> {t('registeredCount', { n: players.length })}
        </h2>
        {players.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('noPlayers')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {players.map((p) => (
              <div key={p.id} className="bg-black/30 rounded-lg p-3 border border-gray-700/60">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-neon font-bold uppercase tracking-wide">{p.name}</h3>
                  <button className="text-danger hover:opacity-70" onClick={() => onRemovePlayer(p.id)} aria-label={`${t('delete')} ${p.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="space-y-1">
                  {p.deck.map((b, i) => (
                    <div key={i} className="text-xs text-gray-400 font-mono">{i + 1}. {b.blade} · {b.ratchet} · {b.bit}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-bold text-neon tracking-wider uppercase mb-4">{t('tourneySetup')}</h2>
        <div className="space-y-4">
          <input
            className="w-full px-4 py-3 bg-[#2a2d3e] border border-gray-600 rounded-lg focus:border-neon outline-none"
            placeholder={t('tourneyName')}
            value={tourneyName}
            onChange={(e) => setTourneyName(e.target.value)}
          />
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-400 block mb-2">{t('format')}</label>
            <div className="grid sm:grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button key={f} className={`btn text-xs py-2 ${format === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFormat(f)}>
                  {t(FORMAT_KEY[f])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-gray-400 block mb-2">{t('targetScore')}{t('optional')}</label>
            <div className="flex gap-2">
              {TARGET_SCORE_OPTIONS.map((s) => (
                <button key={s} className={`btn text-sm py-2 px-4 ${targetScore === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTargetScore(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            className="btn-primary w-full py-3"
            disabled={players.length < 2}
            onClick={() => onStartTournament(tourneyName.trim() || '本地賽事', format, targetScore)}
          >
            {t('launch')}
          </button>
          {hasTournament && (
            <p className="text-gray-500 text-xs">{t('tourneyActive')}</p>
          )}
        </div>
      </section>
    </div>
  );
}