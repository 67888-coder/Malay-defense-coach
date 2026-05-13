function getCardsForDay(day) {
  const exact = phrases.filter((card) => card.day === day);
  if (exact.length) return exact;
  const fromPrevious = phrases
    .filter((card) => card.day <= day)
    .slice(-6);
  return fromPrevious;
}

function getVocabularyForDay(day) {
  const exact = vocabularyCards.filter((card) => card.day === day);
  if (exact.length) return exact;
  return vocabularyCards.filter((card) => card.day <= day).slice(-3);
}

function getAllCards() {
  return [...phrases, ...vocabularyCards, ...getWordbookCards(), ...(state.customCards || [])];
}

function getWordbookCards() {
  return Object.values(state.wordbook || {}).map((entry) => ({
    ...entry,
    id: `wb-${entry.key}`,
    day: getRecommendedDay(),
    category: "vocab",
    kind: "wordbook",
    note: entry.note || "生词本词汇",
  }));
}

function getDueCards() {
  const today = todayISO();
  return getAllCards()
    .filter((card) => {
      const stat = ensureCardStats(card);
      return stat.due <= today;
    })
    .sort((a, b) => ensureCardStats(a).due.localeCompare(ensureCardStats(b).due) || (a.day || 999) - (b.day || 999));
}

function ensureCardStats(card) {
  if (!state.cardStats[card.id]) {
    state.cardStats[card.id] = {
      due: card.id.startsWith("custom-") || card.kind === "wordbook" ? todayISO() : addDays(state.startDate, (card.day || 1) - 1),
      interval: 0,
      ease: 2.35,
      reps: 0,
      lapses: 0,
      lastReviewed: "",
    };
  }
  return state.cardStats[card.id];
}

function getReviewForecast() {
  const rows = [];
  let total = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(todayISO(), i);
    const count = getAllCards().filter((card) => ensureCardStats(card).due === date).length;
    total += count;
    rows.push(`<tr><td>${date}</td><td>${count} 张</td></tr>`);
  }
  return { total, rows: rows.join("") };
}

function startReview() {
  const due = getDueCards();
  reviewSession = { queue: due.map((card) => card.id), showAnswer: false };
  activeView = "review";
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  render();
}

function rateCurrentCard(rating) {
  const cardId = reviewSession.queue[0];
  const card = getAllCards().find((item) => item.id === cardId);
  if (!card) return;

  const stat = ensureCardStats(card);
  const today = todayISO();
  if (rating === "again") {
    stat.reps = 0;
    stat.interval = 0;
    stat.ease = Math.max(1.3, stat.ease - 0.2);
    stat.lapses += 1;
    stat.due = today;
  }
  if (rating === "hard") {
    stat.interval = stat.reps === 0 ? 1 : Math.max(1, Math.round(stat.interval * 1.2));
    stat.ease = Math.max(1.3, stat.ease - 0.15);
    stat.reps += 1;
    stat.due = addDays(today, stat.interval);
  }
  if (rating === "good") {
    stat.interval = stat.reps === 0 ? 1 : stat.reps === 1 ? 3 : Math.max(3, Math.round(stat.interval * stat.ease));
    stat.reps += 1;
    stat.due = addDays(today, stat.interval);
  }
  if (rating === "easy") {
    stat.interval = stat.reps === 0 ? 4 : Math.max(4, Math.round(stat.interval * stat.ease * 1.35));
    stat.ease = Math.min(3.0, stat.ease + 0.15);
    stat.reps += 1;
    stat.due = addDays(today, stat.interval);
  }
  stat.lastReviewed = today;
  delete state.manualReviewCards[cardId];
  markReviewCompletedForToday();
  markStudied(3);
  reviewSession.queue.shift();
  reviewSession.showAnswer = false;
  saveState();
  render();
}

function makeCardDue(cardId) {
  const card = getAllCards().find((item) => item.id === cardId);
  if (!card) return;
  const stat = ensureCardStats(card);
  const today = todayISO();
  if (stat.due <= today && !isManualReviewCard(cardId)) {
    showToast("这张卡本来就在今日复习中。");
    return;
  }
  state.manualReviewCards[cardId] = { previousDue: stat.due, addedOn: today };
  stat.due = today;
  saveState();
  showToast("已加入今日复习。");
  render();
}

function cancelCardDue(cardId) {
  const card = getAllCards().find((item) => item.id === cardId);
  if (!card || !isManualReviewCard(cardId)) return;
  const stat = ensureCardStats(card);
  const manual = state.manualReviewCards[cardId];
  stat.due = manual.previousDue && manual.previousDue > todayISO() ? manual.previousDue : addDays(todayISO(), 1);
  delete state.manualReviewCards[cardId];
  saveState();
  showToast("已取消今日复习。");
  render();
}

function completeDay(day) {
  state.completedLessons[day] = todayISO();
  state.selectedDay = getRecommendedDay();
  markStudied(state.dailyMinutes);
  saveState();
  showToast(`第 ${day} 天已记录。`);
  render();
}

function getLessonActivity(day) {
  state.lessonActivity[day] = state.lessonActivity[day] || {
    meaningsViewed: {},
    vocabViewed: {},
    reviewCount: 0,
  };
  state.lessonActivity[day].meaningsViewed = state.lessonActivity[day].meaningsViewed || {};
  state.lessonActivity[day].vocabViewed = state.lessonActivity[day].vocabViewed || {};
  return state.lessonActivity[day];
}

function markMeaningViewed(cardId, day) {
  const activity = getLessonActivity(day);
  if (!activity.meaningsViewed[cardId]) {
    activity.meaningsViewed[cardId] = todayISO();
    markStudied(1);
  }
  evaluateLessonCompletion(day);
  saveState();
  refreshAutoTaskList(day);
}

function markVocabViewed(cardId, day) {
  const activity = getLessonActivity(day);
  if (!activity.vocabViewed[cardId]) {
    activity.vocabViewed[cardId] = todayISO();
    markStudied(1);
  }
  evaluateLessonCompletion(day);
  saveState();
  refreshAutoTaskList(day);
}

function markReviewCompletedForToday() {
  const day = clamp(Number(state.selectedDay) || getRecommendedDay(), 1, 60);
  const activity = getLessonActivity(day);
  activity.reviewCount += 1;
  evaluateLessonCompletion(day);
}

function getTodayReviewedCount() {
  return getAllCards().filter((card) => ensureCardStats(card).lastReviewed === todayISO()).length;
}

function evaluateLessonCompletion(day) {
  const dayCards = getCardsForDay(day);
  const dayVocab = getVocabularyForDay(day);
  const allDone = getAutoTaskStatus(day, dayCards, dayVocab).every((task) => task.done);
  if (allDone && !state.completedLessons[day]) {
    state.completedLessons[day] = todayISO();
    showToast(`第 ${day} 天已自动完成。`);
  }
}

function addCustomCard() {
  const ms = document.getElementById("customMalay")?.value.trim();
  const zh = document.getElementById("customChinese")?.value.trim();
  const en = document.getElementById("customEnglish")?.value.trim();
  const note = document.getElementById("customNote")?.value.trim();
  if (!ms || !zh) {
    showToast("请至少填写马来语和中文含义。");
    return;
  }
  const card = {
    id: `custom-${Date.now()}`,
    day: getRecommendedDay(),
    category: "vocab",
    kind: "vocab",
    ms,
    zh,
    en,
    type: "custom",
    note: note || "自定义卡片",
  };
  state.customCards.push(card);
  state.cardStats[card.id] = {
    due: todayISO(),
    interval: 0,
    ease: 2.35,
    reps: 0,
    lapses: 0,
    lastReviewed: "",
  };
  const day = getRecommendedDay();
  markVocabViewed(card.id, day);
  markStudied(2);
  saveState();
  showToast("已加入复习。");
  renderReview();
}

function removeCustomCard(cardId) {
  state.customCards = state.customCards.filter((card) => card.id !== cardId);
  delete state.cardStats[cardId];
  saveState();
  renderReview();
}

function addWordbookEntry(dataset) {
  const ms = dataset.ms || "";
  const key = wordbookKey(ms);
  if (!ms || !key) return;
  state.wordbook[key] = {
    key,
    ms,
    zh: dataset.zh || "",
    en: dataset.en || "",
    type: dataset.type || "vocabulary",
    pron: makePronunciationHint(ms),
    addedOn: todayISO(),
  };
  const cardId = `wb-${key}`;
  state.cardStats[cardId] = state.cardStats[cardId] || {
    due: todayISO(),
    interval: 0,
    ease: 2.35,
    reps: 0,
    lapses: 0,
    lastReviewed: "",
  };
  markStudied(1);
  saveState();
  showToast("已加入生词本。");
  renderStatus();
}

function removeWordbookEntry(key) {
  if (!key || !state.wordbook?.[key]) return;
  delete state.wordbook[key];
  delete state.cardStats[`wb-${key}`];
  saveState();
  showToast("已从生词本移除。");
  render();
}

function saveSettings() {
  const startDate = document.getElementById("startDate")?.value || state.startDate;
  const defenseDate = document.getElementById("defenseDate")?.value || "";
  const dailyMinutes = Number(document.getElementById("dailyMinutes")?.value || state.dailyMinutes);
  const notes = document.getElementById("notes")?.value || "";
  const oldStartDate = state.startDate;

  state.startDate = startDate;
  state.defenseDate = defenseDate;
  state.dailyMinutes = clamp(dailyMinutes, 10, 180);
  state.notes = notes;
  if (oldStartDate !== startDate) rescheduleUnreviewedCards();
  saveState();
  showToast("设置已保存。");
  render();
}

function rescheduleUnreviewedCards() {
  phrases.forEach((card) => {
    const stat = state.cardStats[card.id];
    if (!stat || stat.reps > 0 || stat.lastReviewed) return;
    stat.due = addDays(state.startDate, (card.day || 1) - 1);
  });
}
