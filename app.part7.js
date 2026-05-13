function resetProgress() {
  const ok = window.confirm("确定清空学习进度、复习记录和自定义卡片吗？此操作不可撤销。");
  if (!ok) return;
  state = {
    ...defaultState,
    startDate: todayISO(),
    completedLessons: {},
    taskChecks: {},
    lessonActivity: {},
    manualReviewCards: {},
    wordbook: {},
    studyLog: {},
    cardStats: {},
    customCards: [],
    selectedDay: null,
    notes: "",
  };
  reviewSession = { queue: [], showAnswer: false };
  saveState();
  showToast("进度已清空。");
  render();
}

function exportAnkiDeck() {
  const rows = [];
  getAllCards().forEach((card) => {
    const tag = `bm-defense ${card.category || "general"} day-${card.day || "custom"}`;
    rows.push([card.ms, `${card.zh}<br>${card.en ? `English: ${card.en}<br>` : ""}${card.note || ""}`, tag].map(cleanField).join("\t"));
  });
  downloadFile(`malay-defense-anki-${todayISO()}.tsv`, rows.join("\n"), "text/tab-separated-values;charset=utf-8");
  showToast("Anki卡片已导出。");
}

function exportBackup() {
  downloadFile(`malay-defense-backup-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
  showToast("备份已导出。");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = mergeState(defaultState, parsed);
      saveState();
      showToast("备份已导入。");
      render();
    } catch (error) {
      showToast("导入失败：文件格式不正确。");
    }
  };
  reader.readAsText(file, "utf-8");
}

function markStudied(minutes) {
  const today = todayISO();
  state.studyLog[today] = state.studyLog[today] || { minutes: 0, sessions: 0 };
  state.studyLog[today].minutes += Number(minutes) || 0;
  state.studyLog[today].sessions += 1;
}

function getRecommendedDay() {
  for (let day = 1; day <= 60; day += 1) {
    if (!state.completedLessons[day]) return day;
  }
  return 60;
}

function getStreak() {
  let cursor = todayISO();
  let streak = 0;
  if (!state.studyLog[cursor]) cursor = addDays(cursor, -1);
  while (state.studyLog[cursor]) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function buildVocabularyIndex() {
  const index = new Map();
  baseVocabulary.forEach((item) => {
    const keys = [item.ms, ...(item.aliases || [])];
    keys.forEach((key) => index.set(normalizeMalay(key), item));
  });
  return index;
}

function normalizeMalay(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[?.,;:!()]/g, "")
    .replace(/[_]+/g, "")
    .trim();
}

function wordbookKey(value) {
  return normalizeMalay(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makePronunciationHint(value) {
  return normalizeMalay(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .replace(/ngg/g, "ŋg")
        .replace(/ng/g, "ŋ")
        .replace(/ny/g, "ɲ")
        .replace(/sy/g, "ʃ")
        .replace(/kh/g, "x")
        .replace(/c/g, "tʃ")
        .replace(/j/g, "dʒ")
        .replace(/e/g, "ə"),
    )
    .join(" ");
}

function isVocabularyCard(card) {
  return card?.kind === "vocab" || card?.kind === "wordbook" || String(card?.id || "").startsWith("v");
}

function isManualReviewCard(cardId) {
  return Boolean(state.manualReviewCards?.[cardId]);
}

function getSentenceBreakdown(sentence) {
  const normalized = normalizeMalay(sentence);
  const remainingWords = normalized.split(/\s+/).filter(Boolean);
  const result = [];

  for (let index = 0; index < remainingWords.length; index += 1) {
    const three = remainingWords.slice(index, index + 3).join(" ");
    const two = remainingWords.slice(index, index + 2).join(" ");
    const one = remainingWords[index];
    const matchKey = vocabularyIndex.get(three) ? three : vocabularyIndex.get(two) ? two : one;
    const match = vocabularyIndex.get(matchKey);

    if (match) {
      result.push({
        ms: match.ms,
        zh: match.zh,
        en: match.en,
        type: match.type,
      });
      index += matchKey.split(/\s+/).length - 1;
    } else {
      result.push({
        ms: one,
        zh: "待补充",
        en: "to add",
        type: "unknown",
      });
    }
  }

  return result;
}

function buildEnglishGloss(words) {
  return words.map((word) => `${word.ms} = ${word.en}`).join("; ");
}

function explainSentencePattern(sentence) {
  const lower = normalizeMalay(sentence);
  if (lower.startsWith("boleh saya")) return "Boleh + saya + 动词：礼貌地问“我可以……吗？”";
  if (lower.includes("terima kasih")) return "Terima kasih + atas/kepada + 对象或原因：表达感谢。";
  if (lower.startsWith("saya akan")) return "Saya + akan + 动词：我将会做某事。";
  if (lower.startsWith("saya ingin")) return "Saya + ingin + 动词：我想要做某事，比 mahu 更礼貌。";
  if (lower.startsWith("kajian ini")) return "Kajian ini + 动词/说明：本研究……，适合介绍目的、方法、发现。";
  if (lower.includes("bertujuan untuk")) return "主语 + bertujuan untuk + 动词：说明研究目的。";
  if (lower.includes("menunjukkan bahawa")) return "主语/结果 + menunjukkan bahawa + 从句：说明数据或发现表明什么。";
  if (lower.includes("dikumpulkan melalui")) return "Data + 被动动词 + melalui + 方法：说明数据通过什么方式收集。";
  if (lower.includes("terdiri daripada")) return "主语 + terdiri daripada + 成员：说明由哪些对象组成。";
  return "基本结构：主语 + 动作/状态 + 补充信息。先识别主语，再看动词和后面的说明。";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制。");
  } catch (error) {
    showToast(text);
  }
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return mergeState(defaultState, parsed || {});
  } catch (error) {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeState(base, incoming) {
  return {
    ...base,
    ...incoming,
    completedLessons: { ...(base.completedLessons || {}), ...(incoming.completedLessons || {}) },
    taskChecks: { ...(base.taskChecks || {}), ...(incoming.taskChecks || {}) },
    lessonActivity: { ...(base.lessonActivity || {}), ...(incoming.lessonActivity || {}) },
    manualReviewCards: { ...(base.manualReviewCards || {}), ...(incoming.manualReviewCards || {}) },
    wordbook: { ...(base.wordbook || {}), ...(incoming.wordbook || {}) },
    studyLog: { ...(base.studyLog || {}), ...(incoming.studyLog || {}) },
    cardStats: { ...(base.cardStats || {}), ...(incoming.cardStats || {}) },
    customCards: Array.isArray(incoming.customCards) ? incoming.customCards : [],
  };
}

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function cleanField(value) {
  return String(value ?? "").replaceAll("\t", " ").replaceAll("\n", "<br>");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}
