function renderReviewCard(card) {
  const answer = reviewSession.showAnswer
    ? `
      <div class="review-answer">
        <p class="chinese-line">${escapeHtml(card.zh)}</p>
        ${card.en ? `<p class="note-line"><strong>English:</strong> ${escapeHtml(card.en)}</p>` : ""}
        ${isVocabularyCard(card) ? `<p class="note-line"><strong>近似音标:</strong> ${escapeHtml(card.pron || makePronunciationHint(card.ms))}</p>` : ""}
        <p class="note-line">${escapeHtml(card.note || "")}</p>
        ${!isVocabularyCard(card) ? renderMeaningDetails(card, { open: true, inReview: true }) : ""}
        <div class="review-actions" style="justify-content:center;margin-top:14px">
          <button class="rating-button again" type="button" data-action="rate-card" data-rating="again">忘了</button>
          <button class="rating-button hard" type="button" data-action="rate-card" data-rating="hard">困难</button>
          <button class="rating-button good" type="button" data-action="rate-card" data-rating="good">熟悉</button>
          <button class="rating-button easy" type="button" data-action="rate-card" data-rating="easy">很熟</button>
        </div>
      </div>
    `
    : `
      <div class="review-actions" style="justify-content:center">
        <button class="primary-button" type="button" data-action="reveal-answer">显示答案</button>
      </div>
    `;

  return `
    <div class="review-card">
      <span class="category-tag">${escapeHtml(categoryLabels[card.category] || "复习")}</span>
      <div class="review-question">${escapeHtml(card.ms)}</div>
      ${answer}
    </div>
  `;
}

function renderPhrases() {
  const allCards = getAllCards();
  const query = phraseSearch.trim().toLowerCase();
  const filtered = allCards.filter((card) => {
    const inCategory = phraseCategory === "all" || card.category === phraseCategory;
    const haystack = `${card.ms} ${card.zh} ${card.note || ""}`.toLowerCase();
    return inCategory && (!query || haystack.includes(query));
  });

  app.innerHTML = `
    <section class="panel">
      <h2>句库与词汇</h2>
      <p class="muted small-text">这些内容按两个月答辩场景挑选。点开“查看意思和结构”学习句子组成；词汇卡会显示中文和英文含义。</p>
      <div class="filter-row">
        <input class="search-input" id="phraseSearch" value="${attr(phraseSearch)}" placeholder="搜索中文、马来语或备注" />
        <select class="select-input" id="phraseCategory">
          <option value="all"${phraseCategory === "all" ? " selected" : ""}>全部类别</option>
          ${Object.entries(categoryLabels)
            .map(([id, label]) => `<option value="${id}"${phraseCategory === id ? " selected" : ""}>${escapeHtml(label)}</option>`)
            .join("")}
        </select>
      </div>
      <div class="phrase-list">${renderPhraseCards(filtered, { compact: false })}</div>
    </section>
  `;
}

function renderReviewControl(card) {
  const stat = ensureCardStats(card);
  const manual = isManualReviewCard(card.id);
  if (manual) {
    return `<button class="danger-button" type="button" data-action="cancel-due" data-card-id="${card.id}">取消今日复习</button>`;
  }
  if (stat.due <= todayISO()) {
    return `<span class="pill amber">今日已到期</span>`;
  }
  return `<button class="secondary-button" type="button" data-action="make-due" data-card-id="${card.id}">加入今日复习</button>`;
}

function renderWordbookButton(word) {
  if (!word?.ms || word.zh === "待补充") return `<span class="muted small-text">待补充</span>`;
  const key = wordbookKey(word.ms);
  if (state.wordbook?.[key]) return `<span class="pill">已加入</span>`;
  return `
    <button
      class="secondary-button compact-button"
      type="button"
      data-action="add-wordbook"
      data-ms="${attr(word.ms)}"
      data-zh="${attr(word.zh)}"
      data-en="${attr(word.en || "")}"
      data-type="${attr(word.type || "")}"
    >加入</button>
  `;
}

function renderMeaningDetails(card, options = {}) {
  const day = Number(options.day || card.day || getRecommendedDay());
  if (isVocabularyCard(card)) {
    return `
      <details class="meaning-details" data-vocab-card="${attr(card.id)}" data-day="${day}" ${options.open ? "open" : ""}>
        <summary>查看中文/英文意思</summary>
        <div class="meaning-grid">
          <div><span>中文</span><strong>${escapeHtml(card.zh)}</strong></div>
          <div><span>English</span><strong>${escapeHtml(card.en || "")}</strong></div>
          <div><span>近似音标</span><strong>${escapeHtml(makePronunciationHint(card.ms))}</strong></div>
          <div><span>作用</span><strong>${escapeHtml(card.type || card.note || "词汇")}</strong></div>
        </div>
        <div class="button-row">
          ${renderWordbookButton(card)}
        </div>
        ${card.note ? `<p class="note-line">${escapeHtml(card.note)}</p>` : ""}
      </details>
    `;
  }

  const words = getSentenceBreakdown(card.ms);
  return `
    <details class="meaning-details" data-meaning-card="${attr(card.id)}" data-day="${day}" ${options.open ? "open" : ""}>
      <summary>查看意思和结构</summary>
      <div class="meaning-grid">
        <div><span>中文</span><strong>${escapeHtml(card.zh)}</strong></div>
        <div><span>英文辅助</span><strong>${escapeHtml(buildEnglishGloss(words))}</strong></div>
        <div><span>结构</span><strong>${escapeHtml(explainSentencePattern(card.ms))}</strong></div>
      </div>
      ${card.note ? `<p class="note-line">${escapeHtml(card.note)}</p>` : ""}
      <div class="table-wrap">
        <table class="word-table">
          <thead><tr><th>词/短语</th><th>中文</th><th>English</th><th>近似音标</th><th>作用</th><th>生词本</th></tr></thead>
          <tbody>
            ${words
              .map(
                (word) => `
                  <tr>
                    <td>${escapeHtml(word.ms)}</td>
                    <td>${escapeHtml(word.zh)}</td>
                    <td>${escapeHtml(word.en)}</td>
                    <td>${escapeHtml(makePronunciationHint(word.ms))}</td>
                    <td>${escapeHtml(word.type)}</td>
                    <td>${renderWordbookButton(word)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function renderPhraseCards(cards, options = {}) {
  if (!cards.length) return `<div class="empty-state">没有匹配的句子。</div>`;
  return cards
    .map(
      (card) => {
        const reviewControl = renderReviewControl(card);
        return `
        <article class="phrase-card">
          <div class="phrase-topline">
            <div>
              <span class="category-tag">${escapeHtml(categoryLabels[card.category] || "句子")}</span>
              <p class="malay-line" style="margin-top:8px">${escapeHtml(card.ms)}</p>
            </div>
            <div class="button-row">
              <button class="icon-button" type="button" data-action="copy" data-text="${attr(card.ms)}" aria-label="复制">复制</button>
            </div>
          </div>
          ${renderMeaningDetails(card, { day: options.day })}
          ${
            options.compact
              ? ""
              : `<div class="button-row">${reviewControl}</div>`
          }
        </article>
      `;
      },
    )
    .join("");
}

function renderResources() {
  app.innerHTML = `
    <section class="grid-2">
      <div class="panel">
        <h2>资源怎么融入学习</h2>
        <div class="quote-box">
          <strong>主线只用这个平台。</strong>
          <p class="muted small-text" style="margin:6px 0 0">外部资源只负责补强：课程打底、词典校正、口语实战、开源工具备份。两个月内不要同时追太多课程。</p>
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table>
            <thead><tr><th>阶段</th><th>资源用法</th></tr></thead>
            <tbody>
              <tr><td>第1-2周</td><td>先学基础词汇的中文/英文意思，再理解问候和导师沟通句的结构。</td></tr>
              <tr><td>第3-4周</td><td>把答辩开场、结构词、研究目的句拆开学，知道每个词负责什么功能。</td></tr>
              <tr><td>第5-6周</td><td>用DBP查论文关键词；把研究目的、方法、发现写成自己的马来语模板。</td></tr>
              <tr><td>第7-8周</td><td>只复习平台和Anki卡组；RTranslator作为备用，不当主训练。</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <h2>推荐组合</h2>
        <div class="checklist">
          <div class="check-item"><span></span><span>每天：平台今日句子结构 + 今日基础词汇 + 到期复习。</span></div>
          <div class="check-item"><span></span><span>每周2-3次：外部课程只用来补充例句和查证发音，每次20分钟以内。</span></div>
          <div class="check-item"><span></span><span>每周1次：把自己的论文标题、方法、发现写入自定义卡片，并补上英文意思。</span></div>
        </div>
      </div>
    </section>

    <section class="panel" style="margin-top:16px">
      <h2>免费资源卡片</h2>
      <div class="resource-list">
        ${resources
          .map(
            (resource) => `
              <article class="resource-card">
                <span class="resource-type">${escapeHtml(resource.type)}</span>
                <h3>${escapeHtml(resource.title)}</h3>
                <p>${escapeHtml(resource.value)}</p>
                <p class="muted small-text">${escapeHtml(resource.use)}</p>
                <a href="${resource.url}" target="_blank" rel="noreferrer">打开链接</a>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  app.innerHTML = `
    <section class="grid-2">
      <div class="panel">
        <h2>学习设置</h2>
        <div class="form-grid two">
          <label>
            <span class="small-text muted">开始日期</span>
            <input class="text-input" id="startDate" type="date" value="${attr(state.startDate)}" />
          </label>
          <label>
            <span class="small-text muted">答辩日期</span>
            <input class="text-input" id="defenseDate" type="date" value="${attr(state.defenseDate)}" />
          </label>
          <label>
            <span class="small-text muted">每日目标分钟</span>
            <input class="text-input" id="dailyMinutes" type="number" min="10" max="180" value="${attr(String(state.dailyMinutes))}" />
          </label>
        </div>
        <label style="display:block;margin-top:12px">
          <span class="small-text muted">你的备注</span>
          <textarea class="text-area" id="notes" rows="6" placeholder="例如：我的研究主题、老师常问的问题、答辩时间要求">${escapeHtml(state.notes || "")}</textarea>
        </label>
        <div class="button-row" style="margin-top:12px">
          <button class="primary-button" type="button" data-action="save-settings">保存设置</button>
          <button class="secondary-button" type="button" data-action="backup">导出备份</button>
          <button class="secondary-button" type="button" data-action="import-backup">导入备份</button>
          <button class="danger-button" type="button" data-action="reset-progress">清空进度</button>
        </div>
        <input id="backupFile" type="file" accept="application/json" hidden />
      </div>

      <div class="panel">
        <h2>记忆功能说明</h2>
        <div class="quote-box">
          <p style="margin:0">进度、复习间隔、自定义卡片和备注会保存在当前浏览器本地。换浏览器或清理浏览器数据前，先导出备份。</p>
        </div>
        <div class="resource-list" style="margin-top:12px">
          <article class="mini-panel">
            <h3>复习排程</h3>
            <p class="muted small-text">“忘了”当天再看；“困难”明天看；“熟悉/很熟”会逐步拉长间隔。</p>
          </article>
          <article class="mini-panel">
            <h3>建议节奏</h3>
            <p class="muted small-text">每天30-45分钟足够。答辩前两周不要加太多新句子，重点练稳定输出。</p>
          </article>
        </div>
      </div>
    </section>
  `;
}
