const vocabularyCards = baseVocabulary.map((item, index) => ({
  ...item,
  id: `v${String(index + 1).padStart(3, "0")}`,
  day: Math.min(60, Math.floor(index / 3) + 1),
  category: "vocab",
  kind: "vocab",
  note: item.note || `${item.type}；用于理解答辩句子的组成。`,
}));

const vocabularyIndex = buildVocabularyIndex();

const dayTopics = [
  "词义、问候和基础句型",
  "自我介绍和身份说明",
  "承认水平并争取理解",
  "请求重复和放慢语速",
  "预约导师与礼貌开头",
  "发送文件与确认时间",
  "修改承诺和反馈请求",
  "正式答辩开场",
  "题目介绍和时间说明",
  "报告结构一：四部分框架",
  "报告结构二：方法与发现",
  "报告结构三：结论",
  "研究问题与研究目标",
  "目标句型强化",
  "质性/量化方法表达",
  "数据收集表达",
  "样本与分析工具",
  "发现与结果",
  "总体解释和局限转折",
  "局限与未来研究",
  "贡献和重要性",
  "答辩问答缓冲",
  "两段式回答",
  "用数据和文献回答",
  "表达观点与边界",
  "承认局限",
  "被问住时的稳妥回应",
  "结束陈述和进入问答",
  "答辩后感谢",
  "争取思考时间",
  "学术词汇：背景与问题",
  "学术词汇：目标与问题",
  "学术词汇：文献与理论",
  "学术词汇：方法与工具",
  "学术词汇：发现与讨论",
  "学术词汇：结论与建议",
  "高价值问题回应",
  "PPT与导师沟通",
  "扩展开场和选题理由",
  "创新点和实践启示",
  "1分钟自我介绍整合",
  "3分钟研究概述整合",
  "方法部分口头复述",
  "发现部分口头复述",
  "局限与未来研究复述",
  "答辩问答10题演练",
  "听力压力训练",
  "老师消息回复训练",
  "邮件短句训练",
  "PPT页码定位训练",
  "模拟答辩一",
  "模拟答辩复盘",
  "模拟答辩二",
  "弱项句子补强",
  "高频句只练流利度",
  "答辩当天流程彩排",
  "开场到结尾完整演练",
  "问答兜底表达冲刺",
  "轻量复习和睡前回顾",
  "最终自信版脚本",
];

const phaseByDay = [
  { max: 7, name: "基础开口", resource: "L-Lingo + GroVo", focus: "先理解问候、自我介绍、请求重复这些基础句子的词义和结构。" },
  { max: 14, name: "答辩框架", resource: "FutureLearn + 句库", focus: "把开场、结构、研究目的拆开学，知道每个部分是什么意思。" },
  { max: 21, name: "研究内容", resource: "Kamus DBP", focus: "把自己的题目、方法、发现放进固定模板，重点看词汇替换。" },
  { max: 30, name: "问答生存", resource: "Hilokal + 平台复习", focus: "理解确认问题、争取时间、承认局限的固定结构。" },
  { max: 40, name: "学术表达", resource: "DBP + Wikibooks", focus: "补齐论文关键词和正式表达。" },
  { max: 50, name: "整合输出", resource: "平台句库 + Anki", focus: "把句子连成1分钟、3分钟和10分钟版本。" },
  { max: 60, name: "模拟冲刺", resource: "平台复习 + 备用翻译", focus: "减少新内容，只做流利度和压力演练。" },
];

function getPhase(day) {
  return phaseByDay.find((phase) => day <= phase.max) || phaseByDay[phaseByDay.length - 1];
}

const lessons = Array.from({ length: 60 }, (_, index) => {
  const day = index + 1;
  const phase = getPhase(day);
  return {
    day,
    title: dayTopics[index],
    phase: phase.name,
    resource: phase.resource,
    focus: phase.focus,
    tasks: [
      `查看今日句子的中文意思、英文辅助和结构拆解。`,
      `学习今日基础词汇，理解它们在句子里的作用。`,
      `完成今日到期复习，系统会自动安排下次复习。`,
    ],
  };
});

const defaultState = {
  startDate: todayISO(),
  defenseDate: "",
  dailyMinutes: 35,
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

let state = loadState();
let activeView = "today";
let phraseSearch = "";
let phraseCategory = "all";
let reviewSession = { queue: [], showAnswer: false };

const app = document.getElementById("app");
const statusStrip = document.getElementById("statusStrip");
const toast = document.getElementById("toast");

render();

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-view]");
  if (tab) {
    activeView = tab.dataset.view;
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === activeView);
    });
    render();
    app.focus();
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "copy") copyText(button.dataset.text || "");
  if (action === "complete-day") completeDay(Number(button.dataset.day));
  if (action === "jump-day") {
    state.selectedDay = Number(button.dataset.day);
    saveState();
    renderToday();
  }
  if (action === "start-review") startReview();
  if (action === "reveal-answer") {
    reviewSession.showAnswer = true;
    renderReview();
  }
  if (action === "rate-card") rateCurrentCard(button.dataset.rating);
  if (action === "make-due") makeCardDue(button.dataset.cardId);
  if (action === "cancel-due") cancelCardDue(button.dataset.cardId);
  if (action === "export-anki") exportAnkiDeck();
  if (action === "backup") exportBackup();
  if (action === "save-settings") saveSettings();
  if (action === "reset-progress") resetProgress();
  if (action === "add-custom-card") addCustomCard();
  if (action === "remove-custom-card") removeCustomCard(button.dataset.cardId);
  if (action === "add-wordbook") addWordbookEntry(button.dataset);
  if (action === "remove-wordbook") removeWordbookEntry(button.dataset.key);
  if (action === "import-backup") document.getElementById("backupFile")?.click();
});

document.addEventListener(
  "toggle",
  (event) => {
    const details = event.target.closest("details[data-meaning-card], details[data-vocab-card]");
    if (!details || !details.open) return;
    const day = Number(details.dataset.day) || getRecommendedDay();
    if (details.dataset.meaningCard) markMeaningViewed(details.dataset.meaningCard, day);
    if (details.dataset.vocabCard) markVocabViewed(details.dataset.vocabCard, day);
  },
  true,
);

document.addEventListener("change", (event) => {
  const check = event.target.closest("[data-task-check]");
  if (check) {
    const day = Number(check.dataset.day);
    const index = Number(check.dataset.index);
    state.taskChecks[day] = state.taskChecks[day] || {};
    state.taskChecks[day][index] = check.checked;
    markStudied(2);
    saveState();
    renderStatus();
  }

  if (event.target.id === "backupFile" && event.target.files?.[0]) {
    importBackup(event.target.files[0]);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "phraseSearch") {
    phraseSearch = event.target.value;
    renderPhrases();
  }
  if (event.target.id === "phraseCategory") {
    phraseCategory = event.target.value;
    renderPhrases();
  }
});

document.getElementById("studyNowButton").addEventListener("click", () => {
  activeView = "today";
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeView);
  });
  render();
  app.focus();
});

document.getElementById("backupButton").addEventListener("click", exportBackup);
