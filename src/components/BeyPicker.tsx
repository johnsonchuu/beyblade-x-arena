import { useState } from 'react';
import type { Bey } from '../lib/types';
import { findParts } from '../lib/parts';
import { useI18n } from '../lib/i18n';

interface BeyPickerProps {
  value: Bey | null;
  onChange: (b: Bey | null) => void;
  index: number;
}

const KIND_KEY = { blade: 'blade', ratchet: 'ratchet', bit: 'bit' } as const;

function Field({
  label,
  value,
  kind,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  kind: 'blade' | 'ratchet' | 'bit';
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = findParts(query, kind);

  return (
    <div className="relative">
      <label className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">{label}</label>
      <input
        className="w-full px-3 py-2 bg-[#2a2d3e] border border-gray-600 rounded-md focus:border-neon outline-none text-sm font-mono"
        placeholder={placeholder}
        value={open ? query : value}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-[#2a2d3e] border border-gray-600 rounded-md shadow-xl">
          {matches.map((p) => (
            <li key={p.name}>
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-neon/10 text-gray-200"
                onMouseDown={() => {
                  onChange(p.name);
                  setOpen(false);
                }}
              >
                {p.name} <span className="text-gray-500 text-xs">({p.series})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BeyPicker({ value, onChange, index }: BeyPickerProps) {
  const { t } = useI18n();
  const setField = (field: 'blade' | 'ratchet' | 'bit') => (v: string) => {
    const current = value ?? { id: `bey-${index}`, blade: '', ratchet: '', bit: '' };
    onChange({ ...current, [field]: v });
  };

  return (
    <div className="bg-black/30 rounded-lg p-3 border border-gray-700/60 space-y-2">
      <div className="text-[11px] uppercase tracking-widest text-neon font-bold">{t('bey')} {index + 1}</div>
      <Field label={t('blade')} kind="blade" value={value?.blade ?? ''} onChange={setField('blade')} placeholder={t('blade')} />
      <Field label={t('ratchet')} kind="ratchet" value={value?.ratchet ?? ''} onChange={setField('ratchet')} placeholder={t('ratchet')} />
      <Field label={t('bit')} kind="bit" value={value?.bit ?? ''} onChange={setField('bit')} placeholder={t('bit')} />
      <div className="text-[10px] text-gray-500 font-mono truncate">
        {value?.blade && value.ratchet && value.bit ? `${value.blade} ${value.ratchet}${value.bit}` : '—'}
      </div>
    </div>
  );
}

export { KIND_KEY };