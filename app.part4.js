function render() {
  renderStatus();
  if (activeView === "today") renderToday();
  if (activeView === "review") renderReview();
  if (activeView === "phrases") renderPhrases();
  if (activeView === "resources") renderResources();
  if (activeView === "settings") renderSettings();
}

function renderStatus() {
  const completed = Object.keys(state.completedLessons).length;
  const due = getDueCards().length;
  const streak = getStreak();
  const currentDay = getRecommendedDay();
  statusStrip.innerHTML = [
    statusCard("学习进度", `${completed}/60`, `建议进入第 ${currentDay} 天`),
    statusCard("今日复习", `${due}`, "张卡片到期"),
    statusCard("连续学习", `${streak}`, "天"),
    statusCard("每日目标", `${state.dailyMinutes}`, "分钟"),
  ].join("");
}

function statusCard(label, value, hint) {
  return `<div class="status-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(hint)}</span></div>`;
}

function renderToday() {
  const recommendedDay = getRecommendedDay();
  const day = clamp(Number(state.selectedDay) || recommendedDay, 1, 60);
  const lesson = lessons[day - 1];
  const completed = Boolean(state.completedLessons[day]);
  const dayCards = getCardsForDay(day);
  const dayVocab = getVocabularyForDay(day);
  const nextRows = getTimelineRows(day);
  const progress = Math.round((Object.keys(state.completedLessons).length / 60) * 100);

  app.innerHTML = `
    <section class="grid-2">
      <div class="panel hero-panel">
        <div class="lesson-meta">
          <span class="pill">Day ${day}</span>
          <span class="pill amber">${escapeHtml(lesson.phase)}</span>
          <span class="pill coral">${completed ? "已完成" : "今日建议"}</span>
        </div>
        <h2 class="lesson-title">${escapeHtml(lesson.title)}</h2>
        <p class="lesson-summary">${escapeHtml(lesson.focus)}</p>
        <div class="auto-task-list" id="autoTaskList">${renderAutoTasks(day, dayCards, dayVocab)}</div>
        <div class="button-row">
          <button class="secondary-button" type="button" data-action="start-review">去复习到期卡片</button>
          <button class="secondary-button" type="button" data-action="jump-day" data-day="${Math.min(day + 1, 60)}">查看下一天</button>
        </div>
      </div>

      <aside class="panel">
        <h2>路线总览</h2>
        <p class="muted small-text">按完成度推进，不会因为隔天没学就自动跳过内容。</p>
        <div class="progress-track" aria-label="60天进度">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <p class="small-text muted" style="margin-top:8px">${progress}% 已完成</p>
        <div class="timeline">${nextRows}</div>
      </aside>
    </section>

    <section class="grid-2" style="margin-top:16px">
      <div class="panel">
        <h2>今日句子结构</h2>
        <p class="muted small-text">先看马来语句子，再点开“查看意思和结构”。系统会自动记录你已经学过哪些句子。</p>
        <div class="phrase-list">${renderPhraseCards(dayCards, { compact: false, day })}</div>
      </div>
      <div class="panel">
        <h2>今日基础词汇</h2>
        <p class="muted small-text">词汇会显示中文和英文含义，并说明词性或作用。点开词义后会自动计入今日学习。</p>
        <div class="phrase-list">${renderPhraseCards(dayVocab, { compact: false, day })}</div>
      </div>
    </section>

    <section class="grid-2" style="margin-top:16px">
      <div class="panel">
        <h2>今天外部资源</h2>
        <div class="quote-box">
          <strong>${escapeHtml(lesson.resource)}</strong>
          <p class="muted small-text" style="margin:6px 0 0">只用来补强今日任务，不把外部课程当成新的压力源。</p>
        </div>
        <div class="resource-list" style="margin-top:12px">
          ${resources
            .slice(0, 4)
            .map(
              (resource) => `
                <article class="mini-panel">
                  <span class="resource-type">${escapeHtml(resource.type)}</span>
                  <h3>${escapeHtml(resource.title)}</h3>
                  <p class="small-text muted">${escapeHtml(resource.use)}</p>
                  <a href="${resource.url}" target="_blank" rel="noreferrer">打开资源</a>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="panel">
        <h2>结构提示</h2>
        <div class="quote-box">
          <strong>马来语基础语序通常是：主语 + 动作/状态 + 补充信息。</strong>
          <p class="muted small-text" style="margin:6px 0 0">答辩中先背固定结构，再把你的研究题目、方法、发现替换进去。</p>
        </div>
        <div class="checklist">
          <div class="check-item"><span class="task-status done"></span><span><strong>Boleh saya ...?</strong><br><span class="muted small-text">我可以……吗？用于礼貌请求。</span></span></div>
          <div class="check-item"><span class="task-status done"></span><span><strong>Kajian ini ...</strong><br><span class="muted small-text">本研究……，用于介绍目的、方法和发现。</span></span></div>
          <div class="check-item"><span class="task-status done"></span><span><strong>Dapatan menunjukkan bahawa ...</strong><br><span class="muted small-text">研究发现显示……，用于结果陈述。</span></span></div>
        </div>
      </div>
    </section>
  `;
}

function getTimelineRows(currentDay) {
  const start = Math.max(1, currentDay - 2);
  const end = Math.min(60, start + 7);
  return lessons
    .slice(start - 1, end)
    .map((lesson) => {
      const isCurrent = lesson.day === currentDay;
      const done = Boolean(state.completedLessons[lesson.day]);
      return `
        <button class="lesson-row ${isCurrent ? "current" : ""}" type="button" data-action="jump-day" data-day="${lesson.day}">
          <span class="day-badge">${lesson.day}</span>
          <span>
            <strong>${escapeHtml(lesson.title)}</strong><br>
            <span class="small-text muted">${escapeHtml(lesson.phase)}</span>
          </span>
          <span class="pill ${done ? "" : "amber"}">${done ? "完成" : "待学"}</span>
        </button>
      `;
    })
    .join("");
}

function renderAutoTasks(day, dayCards, dayVocab) {
  const tasks = getAutoTaskStatus(day, dayCards, dayVocab);
  return tasks
    .map(
      (task) => `
        <div class="auto-task ${task.done ? "done" : ""}">
          <span class="task-status ${task.done ? "done" : ""}"></span>
          <span>
            <strong>${escapeHtml(task.title)}</strong><br>
            <span class="muted small-text">${escapeHtml(task.hint)}</span>
          </span>
        </div>
      `,
    )
    .join("");
}

function getAutoTaskStatus(day, dayCards, dayVocab) {
  const activity = getLessonActivity(day);
  const phraseTarget = Math.max(1, dayCards.length);
  const vocabTarget = Math.min(3, Math.max(1, dayVocab.length));
  const phraseCount = dayCards.filter((card) => activity.meaningsViewed?.[card.id]).length;
  const vocabCount = dayVocab.filter((card) => activity.vocabViewed?.[card.id]).length;
  const dueCount = getDueCards().length;
  const reviewedToday = getTodayReviewedCount();
  return [
    {
      title: "句子意思和结构",
      done: phraseCount >= phraseTarget,
      hint: `${phraseCount}/${phraseTarget} 个今日句子已查看结构`,
    },
    {
      title: "基础词汇中英文意思",
      done: vocabCount >= vocabTarget,
      hint: `${vocabCount}/${vocabTarget} 个今日词汇已查看`,
    },
    {
      title: "到期复习",
      done: dueCount === 0,
      hint: dueCount === 0 ? `今日到期卡片已完成；已复习 ${reviewedToday} 张` : `已复习 ${reviewedToday} 张；当前还有 ${dueCount} 张到期`,
    },
  ];
}

function refreshAutoTaskList(day) {
  if (activeView !== "today") return;
  const container = document.getElementById("autoTaskList");
  if (!container) return;
  const dayCards = getCardsForDay(day);
  const dayVocab = getVocabularyForDay(day);
  container.innerHTML = renderAutoTasks(day, dayCards, dayVocab);
  renderStatus();
}

function renderReview() {
  const dueCards = getDueCards();
  const forecast = getReviewForecast();
  const customCards = state.customCards || [];
  const wordbookCards = getWordbookCards();

  if (!reviewSession.queue.length && dueCards.length) {
    reviewSession.queue = dueCards.map((card) => card.id);
    reviewSession.showAnswer = false;
  }

  const currentCard = reviewSession.queue.length ? getAllCards().find((card) => card.id === reviewSession.queue[0]) : null;

  app.innerHTML = `
    <section class="grid-2">
      <div class="panel">
        <h2>间隔复习</h2>
        <p class="muted small-text">按钮会自动安排下一次复习：忘了今天再看，困难明天看，熟悉就延后。</p>
        ${
          currentCard
            ? renderReviewCard(currentCard)
            : `<div class="empty-state"><div><strong>今天没有到期卡片</strong><p>可以去“句库”把某句加入今日复习，或添加自己的专业词汇。</p></div></div>`
        }
      </div>

      <aside class="panel">
        <h2>复习计划</h2>
        <div class="grid-3">
          <div class="mini-panel"><span class="muted small-text">今日到期</span><strong style="display:block;font-size:1.8rem">${dueCards.length}</strong></div>
          <div class="mini-panel"><span class="muted small-text">生词本</span><strong style="display:block;font-size:1.8rem">${wordbookCards.length}</strong></div>
          <div class="mini-panel"><span class="muted small-text">未来7天</span><strong style="display:block;font-size:1.8rem">${forecast.total}</strong></div>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>日期</th><th>预计复习</th></tr></thead>
            <tbody>${forecast.rows}</tbody>
          </table>
        </div>
        <div class="button-row" style="margin-top:12px">
          <button class="secondary-button" type="button" data-action="export-anki">导出Anki卡片</button>
        </div>
      </aside>
    </section>

    <section class="grid-2" style="margin-top:16px">
      <div class="panel">
        <h2>添加你的专业词汇</h2>
        <div class="form-grid two">
          <input class="text-input" id="customMalay" placeholder="马来语或关键词，如: kajian tindakan" />
          <input class="text-input" id="customChinese" placeholder="中文含义，如: 行动研究" />
          <input class="text-input" id="customEnglish" placeholder="英文含义，如: action research" />
        </div>
        <textarea class="text-area" id="customNote" rows="3" style="margin-top:10px" placeholder="备注：可写词性、你的论文例句或用法提醒"></textarea>
        <div class="button-row" style="margin-top:10px">
          <button class="primary-button" type="button" data-action="add-custom-card">加入复习</button>
        </div>
      </div>

      <div class="panel">
        <h2>生词本</h2>
        <div class="card-list">
          ${
            wordbookCards.length
              ? wordbookCards
                  .map(
                    (card) => `
                      <article class="phrase-card">
                        <div class="phrase-topline">
                          <div>
                            <p class="malay-line">${escapeHtml(card.ms)}</p>
                            <p class="chinese-line">${escapeHtml(card.zh)}</p>
                            <p class="note-line">English: ${escapeHtml(card.en || "")} · 近似音标: ${escapeHtml(card.pron || makePronunciationHint(card.ms))}</p>
                          </div>
                          <button class="icon-button" type="button" data-action="remove-wordbook" data-key="${attr(card.key)}" aria-label="删除">删</button>
                        </div>
                      </article>
                    `,
                  )
                  .join("")
              : `<div class="empty-state">还没有生词。点开句子结构后，可以把表格里的词加入生词本。</div>`
          }
        </div>
      </div>
    </section>

    <section class="panel" style="margin-top:16px">
      <h2>自定义卡片</h2>
        <div class="card-list">
          ${
            customCards.length
              ? customCards
                  .map(
                    (card) => `
                      <article class="phrase-card">
                        <div class="phrase-topline">
                          <div>
                            <p class="malay-line">${escapeHtml(card.ms)}</p>
                            <p class="chinese-line">${escapeHtml(card.zh)}</p>
                            <p class="note-line">${escapeHtml(card.en || "")}</p>
                          </div>
                          <button class="icon-button" type="button" data-action="remove-custom-card" data-card-id="${card.id}" aria-label="删除">删</button>
                        </div>
                        <p class="note-line">${escapeHtml(card.note || "")}</p>
                      </article>
                    `,
                  )
                  .join("")
              : `<div class="empty-state">还没有自定义卡片。建议先加入论文题目、研究对象、方法名称。</div>`
          }
        </div>
    </section>
  `;
}
