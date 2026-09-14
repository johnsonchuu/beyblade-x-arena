import { useRef, useState } from 'react';
import { Share2, Download, Trophy, Sparkles, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { Tournament } from '../lib/types';
import { computeStandings, formatLabel } from '../lib/engine';
import { useI18n } from '../lib/i18n';

interface Props {
  tournament: Tournament | null;
}

export function ShareCard({ tournament }: Props) {
  const { t } = useI18n();
  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!tournament) return null;

  const standings = computeStandings(tournament.players, tournament.matches);
  const champion = standings[0];
  const allRounds = tournament.matches.flatMap((m) => m.rounds);

  const xtremes = allRounds.filter((r) => r.finish === 'XTREME').length;
  const bursts = allRounds.filter((r) => r.finish === 'BURST').length;
  const overs = allRounds.filter((r) => r.finish === 'OVER').length;
  const spins = allRounds.filter((r) => r.finish === 'SPIN').length;

  // Render high-res PNG
  const generatePng = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    return await toPng(cardRef.current, {
      backgroundColor: '#0a0c14',
      pixelRatio: 3, // High-res retina card export
      cacheBust: true,
    });
  };

  const handleDownload = async () => {
    setRendering(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `beyblade-x-${tournament.name.toLowerCase().replace(/\s+/g, '-')}-card.png`;
      a.click();
    } catch {
      alert(t('exportError'));
    } finally {
      setRendering(false);
    }
  };

  const handleShare = async () => {
    setRendering(true);
    try {
      const dataUrl = await generatePng();
      if (!dataUrl) return;

      // Check if navigator.share with files is supported
      if (navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'battle-card.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${tournament.name} - Beyblade X Arena`,
            text: `Beyblade X Arena Tournament Results: ${champion?.player.name} wins!`,
            files: [file],
          });
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
          return;
        }
      }

      // Fallback: download directly
      handleDownload();
    } catch {
      // User cancelled share or failed
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Esports Trading / Battle Card */}
      <div
        ref={cardRef}
        className="p-6 rounded-3xl relative overflow-hidden text-white border-2 border-neon/50 shadow-2xl"
        style={{
          background: 'radial-gradient(circle at 50% 0%, #171b2e 0%, #0d0e17 70%, #08090f 100%)',
          boxShadow: '0 0 50px rgba(0,255,204,0.25)',
        }}
      >
        {/* Holographic Arena Glow Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-neon/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-danger/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-gray-700/60 pb-4 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-mono text-neon tracking-widest uppercase">
              <Sparkles size={13} className="text-neon animate-pulse shrink-0" />
              <span className="truncate">BEYBLADE X ARENA · OFFICIAL BATTLE CARD</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-wider font-heading mt-0.5 text-white truncate">
              {tournament.name}
            </h2>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase bg-neon/10 border border-neon/40 text-neon">
              {formatLabel(tournament.format)}
            </span>
            <p className="text-[10px] font-mono text-gray-400 mt-1">
              {tournament.targetScore !== null ? t('firstTo', { n: tournament.targetScore }) : t('firstToNone')}
            </p>
          </div>
        </div>

        {/* Champion Showcase Banner */}
        {champion && champion.wins > 0 && (
          <div className="relative z-10 p-4 rounded-2xl bg-gradient-to-r from-gold/20 via-amber-500/10 to-transparent border border-gold/50 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gold/20 border border-gold/60 flex items-center justify-center text-gold shadow-glow-gold">
                <Trophy size={26} />
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono tracking-widest text-gold font-bold">
                  TOURNAMENT CHAMPION
                </div>
                <div className="text-2xl font-black uppercase tracking-wider font-heading text-white">
                  {champion.player.name}
                </div>
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-bold text-gold">{champion.wins}W - {champion.losses}L</div>
              <div className="text-[10px] text-gray-400">{champion.pts} {t('pts')}</div>
            </div>
          </div>
        )}

        {/* Standings Table in Card */}
        <div className="relative z-10 mb-5">
          <div className="text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-2 flex items-center justify-between">
            <span>FINAL STANDINGS</span>
            <span>W-L-D / PTS</span>
          </div>
          <div className="space-y-1.5">
            {standings.slice(0, 6).map((r, i) => (
              <div
                key={r.player.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-mono ${
                  i === 0
                    ? 'bg-gold/10 border-gold/40 text-gold font-bold'
                    : i === 1
                      ? 'bg-white/5 border-gray-600 text-gray-200'
                      : i === 2
                        ? 'bg-amber-900/10 border-amber-700/40 text-amber-200'
                        : 'bg-black/30 border-gray-800 text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center font-bold text-xs">{i + 1}</span>
                  <span className="font-heading tracking-wide uppercase">{r.player.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>{r.wins}-{r.losses}-{r.draws}</span>
                  <span className="w-10 text-right font-bold text-neon">{r.pts} PTS</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Battle Stats Breakdown Badges */}
        <div className="relative z-10 pt-3 border-t border-gray-800 grid grid-cols-4 gap-2 text-center font-mono">
          <div className="bg-black/40 p-2 rounded-xl border border-neon/30">
            <div className="text-[10px] text-gray-400 uppercase">Spin</div>
            <div className="text-lg font-bold text-neon">{spins}</div>
          </div>
          <div className="bg-black/40 p-2 rounded-xl border border-sky-400/30">
            <div className="text-[10px] text-gray-400 uppercase">Over</div>
            <div className="text-lg font-bold text-sky-400">{overs}</div>
          </div>
          <div className="bg-black/40 p-2 rounded-xl border border-orange-400/30">
            <div className="text-[10px] text-gray-400 uppercase">Burst</div>
            <div className="text-lg font-bold text-orange-400">{bursts}</div>
          </div>
          <div className="bg-black/40 p-2 rounded-xl border border-danger/30">
            <div className="text-[10px] text-gray-400 uppercase">Xtreme</div>
            <div className="text-lg font-bold text-danger">{xtremes}</div>
          </div>
        </div>

        {/* Footer watermark */}
        <div className="relative z-10 text-center mt-4 pt-2 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
          GENERATED ON BEYBLADE X ARENA · 3-ON-3 BATTLE SYSTEM
        </div>
      </div>

      {/* Sharing & Download Action Buttons */}
      <div className="flex gap-2.5">
        <button
          className="btn-primary flex-1 py-3.5 rounded-xl shadow-glow hover:shadow-glow-lg flex items-center justify-center gap-2 font-heading tracking-wider whitespace-nowrap"
          onClick={handleShare}
          disabled={rendering}
        >
          {copied ? <Check size={18} /> : <Share2 size={18} />}
          <span>{copied ? t('sharedSuccess') : t('shareSummary')}</span>
        </button>
        <button
          className="btn-ghost px-5 py-3.5 rounded-xl border border-gray-600 hover:border-neon flex items-center justify-center gap-2 font-mono text-sm text-gray-200"
          onClick={handleDownload}
          disabled={rendering}
        >
          <Download size={18} />
          <span>{rendering ? t('rendering') : 'PNG'}</span>
        </button>
      </div>
    </div>
  );
}
