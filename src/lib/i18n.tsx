import React, { createContext, useContext, useState } from 'react';

export type Lang = 'zh' | 'en';

const dict = {
  appTitle: { zh: 'Beyblade X 競技場', en: 'Beyblade X Arena' },
  appSubtitle: { zh: '3對3 錦標賽管理及計分引擎', en: '3-on-3 Tournament Manager & Scoring Engine' },
  navRegister: { zh: '登記', en: 'Register' },
  navTourney: { zh: '賽事', en: 'Tourney' },
  navArena: { zh: '競技場', en: 'Arena' },
  navStats: { zh: '戰報/總結', en: 'Battle Card' },
  navSettings: { zh: '設定', en: 'Settings' },

  registerTitle: { zh: '選手登記', en: 'Blader Registration' },
  registerName: { zh: '選手名稱', en: 'Blader name' },
  addPlayer: { zh: '加入選手', en: 'Add Blader' },
  expandDeck: { zh: '配置 3 隻陀螺卡組（可選）', en: 'Configure 3-Bey Deck (Optional)' },
  collapseDeck: { zh: '收起卡組配置', en: 'Hide Deck Config' },
  deckConfigured: { zh: '已設定卡組', en: 'Deck configured' },
  deckEmpty: { zh: '預設/未設定', en: 'Default / Unset' },
  registered: { zh: '已登記選手', en: 'Registered Bladers' },
  registeredCount: { zh: '已登記選手（{n}）', en: 'Registered ({n})' },
  noPlayers: { zh: '尚未登記任何選手 — 請至少加入 2 名選手方可開始。', en: 'No Bladers yet — add at least 2 to start.' },
  tourneySetup: { zh: '賽事設定', en: 'Tournament Setup' },
  tourneyName: { zh: '賽事名稱（例如：週五之夜對戰）', en: 'Tournament name (e.g. Friday Night Fights)' },
  format: { zh: '賽制', en: 'Format' },
  targetScore: { zh: '目標分數（先到）', en: 'Target Score (first to)' },
  targetScoreNone: { zh: '無限制（自由對戰 / 手動結束）', en: 'No Limit (Free Play / Manual End)' },
  freePlay: { zh: '自由對戰', en: 'Free Play' },
  launch: { zh: '開始賽事 →', en: 'Launch Tournament →' },
  tourneyActive: { zh: '已有賽事進行中 — 請前往「賽事」繼續，或到「設定」管理已儲存的賽事。', en: 'A tournament is already active — go to Tourney to resume or Settings to manage saved tournaments.' },

  formatRoundRobin: { zh: '單循環賽', en: 'Round Robin' },
  formatSingleElim: { zh: '單淘汰賽', en: 'Single Elimination' },
  formatSwiss: { zh: '瑞士制', en: 'Swiss System' },

  errNameRequired: { zh: '請輸入選手名稱。', en: 'Enter a Blader name.' },
  errNameExists: { zh: '已有同名選手。', en: 'A Blader with that name already exists.' },
  errDupBlade: { zh: '卡組內不允許重複的刃擊環（Blade）。', en: 'Blade duplication not allowed in a deck.' },
  errDupRatchet: { zh: '卡組內不允許重複的棘輪（Ratchet）。', en: 'Ratchet duplication not allowed in a deck.' },
  errDupBit: { zh: '卡組內不允許重複的軸心（Bit）。', en: 'Bit duplication not allowed in a deck.' },
  notSet: { zh: '未設定', en: 'Not set' },
  optional: { zh: '（可選）', en: ' (optional)' },

  bey: { zh: '陀螺', en: 'Bey' },
  blade: { zh: '刃擊環', en: 'Blade' },
  ratchet: { zh: '棘輪', en: 'Ratchet' },
  bit: { zh: '軸心', en: 'Bit' },

  noActiveTourney: { zh: '沒有進行中的賽事', en: 'No Active Tournament' },
  noActiveTourneyDesc: { zh: '請先登記選手並開始賽事。', en: 'Register bladers and launch a tournament to get started.' },
  leaderboard: { zh: '排行榜', en: 'Leaderboard' },
  pts: { zh: '分', en: 'Pts' },
  countRounds: { zh: '{n} 回合', en: '{n} rounds' },
  matches: { zh: '對戰 rundown', en: 'Match Rundown' },
  scheduleNotGenerated: { zh: '尚未生成賽程。', en: 'Schedule has not been generated yet.' },
  generateSchedule: { zh: '生成賽程', en: 'Generate Schedule' },
  generateNextRound: { zh: '生成下一輪對戰（瑞士制）', en: 'Pair Next Round (Swiss)' },
  matchesCompleted: { zh: '已完成 {done} / {total} 場', en: '{done} / {total} matches completed' },
  firstTo: { zh: '先到 {n} 分', en: 'First to {n}' },
  firstToNone: { zh: '無限制（自由對戰）', en: 'Free Play (No Target Score)' },
  clickToPlay: { zh: '按此開戰', en: 'Click to Battle' },
  inProgress: { zh: '激戰中 — 前往競技場', en: 'In Progress — tap Arena' },
  viewMeta: { zh: '生成戰報分享卡（PNG / 截圖）', en: 'Generate Battle Card (PNG / Share)' },

  roundTitle: { zh: '第 {r} 輪', en: 'Round {r}' },
  roundRundown: { zh: '輪次對戰次序（避免連續作戰）', en: 'Round Sequence (Rest-Balanced)' },
  restingBladers: { zh: '輪空／休息選手', en: 'Resting / On Deck' },
  noResting: { zh: '全員出戰', en: 'All In Action' },

  matchArena: { zh: '對戰競技場', en: 'Match Arena' },
  roundCount: { zh: '回合 {n}', en: 'Round {n}' },
  toggleSound: { zh: '切換音效', en: 'Toggle sound' },
  noActiveMatch: { zh: '沒有進行中的比賽。請從「賽事」畫面開啟。', en: 'No active match. Open one from the Tourney screen.' },
  noRoundsYet: { zh: '尚未開始 — 按 GO，然後記錄得分結果。', en: 'No rounds yet — press GO, then record the finish.' },
  goShoot: { zh: 'GO SHOOT! ３·２·１ 發射！', en: '3, 2, 1... GO SHOOT!' },
  wins: { zh: '{name} 獲勝！', en: '{name} WINS!' },
  roundsAndXtreme: { zh: '{rounds} 回合 · {xtreme} 次極限', en: '{rounds} rounds · {xtreme} Xtreme' },
  recordResult: { zh: '記錄結果並結束比賽', en: 'Record Result & Finish Match' },
  endMatchManual: { zh: '結束比賽並判定勝負', en: 'Declare Winner & End Match' },
  cancelMatch: { zh: '取消比賽', en: 'Cancel Match' },
  cancelConfirm: { zh: '取消此比賽？目前分數將被清空。', en: 'Cancel this match? Score will be lost.' },
  deckRotate: { zh: '得分動作會自動輪換卡組位置（1 → 2 → 3）', en: 'Finish actions auto-rotate deck slots (Slot 1 → 2 → 3)' },

  finishSpin: { zh: '+1 旋轉', en: '+1 Spin' },
  finishOver: { zh: '+2 擊出', en: '+2 Over' },
  finishBurst: { zh: '+2 爆裂', en: '+2 Burst' },
  finishXtreme: { zh: '+3 極限', en: '+3 Xtreme' },
  finishDrawBtn: { zh: '+0 平手', en: '+0 Draw' },

  finishType: { zh: '得分類型', en: 'Finish' },
  finishSPIN: { zh: '旋轉勝利 (Spin)', en: 'Spin Finish' },
  finishOVER: { zh: '擊出勝利 (Over)', en: 'Over Finish' },
  finishBURST: { zh: '爆裂勝利 (Burst)', en: 'Burst Finish' },
  finishXTREME: { zh: '極限勝利 (Xtreme)', en: 'Xtreme Finish' },
  finishDRAW: { zh: '平手 (Draw 重賽)', en: 'Draw (Replay)' },

  finishSpinDesc: { zh: '旋轉時間比對手長，得 1 分', en: 'Outspin opponent, score 1' },
  finishOverDesc: { zh: '將對手擊退至 Over Zone，得 2 分', en: 'Knock opponent to Over Zone, score 2' },
  finishBurstDesc: { zh: '將對手的陀螺擊碎解體，得 2 分', en: 'Burst opponent\'s Bey, score 2' },
  finishXtremeDesc: { zh: '將對手猛烈擊飛至 Xtreme Zone，得 3 分', en: 'Smash opponent to Xtreme Zone, score 3' },
  finishDrawDesc: { zh: '同時出界／平手，重賽一回合（0 分）', en: 'Simultaneous Over / Draw — replay round' },

  statsTitle: { zh: '賽事戰報與總結卡', en: 'Esports Battle Card & Stats' },
  noStats: { zh: '先進行一些比賽 — 戰績總結卡會在此生成。', en: 'Play some matches first — shareable battle card will generate here.' },
  finishDistribution: { zh: '得分終結分佈', en: 'Finish Distribution' },
  topBlades: { zh: '勝出率最高之刃擊環', en: 'Top Winning Blades' },
  exportSummary: { zh: '下載對戰分享卡（PNG）', en: 'Download Battle Card (PNG)' },
  shareSummary: { zh: '即時分享（WhatsApp / IG / Discord）', en: 'Share Card' },
  rendering: { zh: '炫酷渲染中…', en: 'Rendering Battle Card…' },
  recordedRounds: { zh: '{n} 個已記錄回合', en: '{n} recorded rounds' },
  noRoundData: { zh: '暫無回合數據。', en: 'No round data yet.' },
  exportError: { zh: '無法匯出圖片。請嘗試截圖或使用 Chromium 系瀏覽器。', en: 'Could not export image. Try taking a screenshot or use Chromium.' },
  sharedSuccess: { zh: '已分享！', en: 'Card shared!' },

  settingsTitle: { zh: '設定', en: 'Settings' },
  exportJson: { zh: '匯出 JSON 備份', en: 'Export JSON' },
  importJson: { zh: '匯入 JSON', en: 'Import JSON' },
  resetAll: { zh: '清除所有資料', en: 'Reset All Data' },
  resetConfirm: { zh: '確定要清除所有資料嗎？此操作無法復原。', en: 'Reset all data?' },
  savedTournaments: { zh: '已儲存的賽事', en: 'Saved Tournaments' },
  switch: { zh: '切換', en: 'Switch' },
  delete: { zh: '刪除', en: 'Delete' },
  deleteConfirm: { zh: '確定要刪除「{name}」？', en: 'Delete "{name}"?' },
  language: { zh: '語言', en: 'Language' },
} as const;

export type TKey = keyof typeof dict;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>(null as unknown as I18nCtx);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');
  const t = (key: TKey, vars?: Record<string, string | number>): string => {
    let s: string = dict[key]?.[lang] ?? String(key);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  };
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
