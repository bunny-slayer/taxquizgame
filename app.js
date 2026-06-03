(function () {
  const bank = window.QUIZ_BANK || [];
  const topics = (window.QUIZ_TOPICS || []).filter((t) => t.id !== "all");

  const els = {
    topicGrid: document.getElementById("topic-grid"),
    poolStat: document.getElementById("pool-stat"),
    questionCount: document.getElementById("question-count"),
    btnTopicsAll: document.getElementById("btn-topics-all"),
    btnTopicsNone: document.getElementById("btn-topics-none"),
    shuffleQ: document.getElementById("shuffle-questions"),
    shuffleC: document.getElementById("shuffle-choices"),
    start: document.getElementById("btn-start"),
    reset: document.getElementById("btn-reset"),
    screenHome: document.getElementById("screen-home"),
    screenQuiz: document.getElementById("screen-quiz"),
    screenResult: document.getElementById("screen-result"),
    progress: document.getElementById("progress-text"),
    progressBar: document.getElementById("progress-bar"),
    qNum: document.getElementById("q-number"),
    qTopic: document.getElementById("q-topic"),
    qSource: document.getElementById("q-source"),
    stem: document.getElementById("q-stem"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("feedback"),
    btnSubmit: document.getElementById("btn-submit"),
    btnNext: document.getElementById("btn-next"),
    btnReveal: document.getElementById("btn-reveal"),
    scoreSummary: document.getElementById("score-summary"),
    wrongList: document.getElementById("wrong-list"),
    statTotal: document.getElementById("stat-total"),
    btnFinishEarly: document.getElementById("btn-finish-early"),
    resultTitle: document.getElementById("result-title"),
    resultNote: document.getElementById("result-note"),
  };

  let session = [];
  let index = 0;
  let selected = null;
  let answered = false;
  let score = 0;
  const wrong = [];

  function attemptedCount() {
    return score + wrong.length;
  }

  function topicLabel(id) {
    const t = topics.find((x) => x.id === id);
    return t ? t.label : id;
  }

  function countForTopic(topicId) {
    const meta = topics.find((t) => t.id === topicId);
    if (!meta) return 0;
    if (meta.filter) return bank.filter(meta.filter).length;
    return bank.filter((q) => q.topic === topicId).length;
  }

  function questionMatchesTopic(q, topicId) {
    const meta = topics.find((t) => t.id === topicId);
    if (!meta) return false;
    if (meta.filter) return meta.filter(q);
    return q.topic === topicId;
  }

  function getSelectedTopicIds() {
    return Array.from(
      els.topicGrid.querySelectorAll('input[type="checkbox"]:checked')
    ).map((cb) => cb.value);
  }

  function filterBank() {
    const selected = getSelectedTopicIds();
    if (!selected.length) return [];
    return bank.filter((q) =>
      selected.some((id) => questionMatchesTopic(q, id))
    );
  }

  function getQuestionLimit(poolSize) {
    const val = els.questionCount.value;
    if (val === "all") return poolSize;
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 1) return poolSize;
    return Math.min(n, poolSize);
  }

  function updatePoolStat() {
    const pool = filterBank();
    const n = pool.length;
    const selected = getSelectedTopicIds().length;
    if (!selected) {
      els.poolStat.textContent = "เลือกอย่างน้อย 1 หมวดเพื่อเริ่ม";
      els.poolStat.style.color = "var(--warn)";
      rebuildQuestionCountOptions(0);
      return;
    }
    const limit = getQuestionLimit(n);
    els.poolStat.style.color = "var(--accent2)";
    if (limit < n) {
      els.poolStat.textContent = `มี ${n} ข้อในหมวดที่เลือก · ชุดฝึกจะสุ่ม ${limit} ข้อ`;
    } else {
      els.poolStat.textContent = `มี ${n} ข้อในหมวดที่เลือก · ชุดฝึก ${limit} ข้อ`;
    }
    rebuildQuestionCountOptions(n);
  }

  function rebuildQuestionCountOptions(poolSize) {
    const prev = els.questionCount.value;
    const presets = [5, 10, 15, 20, 30, 50];
    if (poolSize > 0 && poolSize < 5 && !presets.includes(poolSize)) {
      presets.unshift(poolSize);
    }
    els.questionCount.innerHTML = "";

    presets.forEach((n) => {
      if (n <= poolSize || poolSize === 0) {
        const opt = document.createElement("option");
        opt.value = String(n);
        opt.textContent = `${n} ข้อ`;
        els.questionCount.appendChild(opt);
      }
    });

    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent =
      poolSize > 0 ? `ทั้งหมด (${poolSize} ข้อ)` : "ทั้งหมด";
    els.questionCount.appendChild(allOpt);

    if (poolSize > 0) {
      const want = prev === "all" ? "all" : prev;
      const exists = Array.from(els.questionCount.options).some(
        (o) => o.value === want
      );
      els.questionCount.value = exists ? want : String(Math.min(10, poolSize));
      if (
        !Array.from(els.questionCount.options).some(
          (o) => o.value === els.questionCount.value
        )
      ) {
        els.questionCount.value = "all";
      }
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function prepareQuestion(q) {
    const pairs = q.choices.map((text, i) => ({ text, orig: i }));
    let list = pairs;
    if (els.shuffleC.checked) list = shuffle(pairs);
    const correct = list.findIndex((p) => p.orig === q.correct);
    return { ...q, choiceList: list, correctIndex: correct };
  }

  function startSession() {
    let list = filterBank();
    if (!list.length) {
      alert("เลือกอย่างน้อย 1 หมวดที่มีข้อสอบ");
      return;
    }
    if (els.shuffleQ.checked) list = shuffle(list);
    const limit = getQuestionLimit(list.length);
    list = list.slice(0, limit);

    session = list.map(prepareQuestion);
    index = 0;
    score = 0;
    wrong.length = 0;
    els.screenHome.hidden = true;
    els.screenResult.hidden = true;
    els.screenQuiz.hidden = false;
    renderQuestion();
  }

  function renderQuestion() {
    const q = session[index];
    answered = false;
    selected = null;
    const total = session.length;
    const n = index + 1;
    els.progress.textContent = `ข้อ ${n} / ${total}`;
    els.progressBar.style.width = `${(n / total) * 100}%`;
    els.qNum.textContent = `ข้อที่ ${n}`;
    els.qTopic.textContent = topicLabel(q.topic);
    els.qSource.textContent =
      q.source === "professor"
        ? "ชุดอาจารย์"
        : q.source === "deep-dive"
          ? "Deep Dive"
          : q.source === "calc-long"
            ? "คำนวณยาว"
            : "แนวข้อสอบ";
    els.stem.textContent = q.question;
    els.feedback.hidden = true;
    els.feedback.className = "feedback";
    els.btnSubmit.disabled = false;
    els.btnSubmit.hidden = false;
    els.btnNext.hidden = true;
    els.btnReveal.hidden = false;

    els.choices.innerHTML = "";
    q.choiceList.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.dataset.index = String(i);
      const letter = String.fromCharCode(65 + i);
      btn.innerHTML = `<span class="letter">${letter}</span><span class="text">${escapeHtml(item.text)}</span>`;
      btn.addEventListener("click", () => pickChoice(i, btn));
      els.choices.appendChild(btn);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function pickChoice(i, btn) {
    if (answered) return;
    selected = i;
    els.choices.querySelectorAll(".choice-btn").forEach((b) => {
      b.classList.remove("selected");
    });
    btn.classList.add("selected");
  }

  function showFeedback(q, isCorrect) {
    answered = true;
    els.feedback.hidden = false;
    els.feedback.classList.add(isCorrect ? "ok" : "bad");
    const correctText = q.choiceList[q.correctIndex].text;
    els.feedback.innerHTML = isCorrect
      ? `<strong>ถูกต้อง</strong><p>${escapeHtml(q.explain)}</p>`
      : `<strong>ไม่ถูก</strong><p>คำตอบที่ถูก: <em>${escapeHtml(correctText)}</em></p><p>${escapeHtml(q.explain)}</p>`;

    els.choices.querySelectorAll(".choice-btn").forEach((b, i) => {
      b.disabled = true;
      if (i === q.correctIndex) b.classList.add("correct");
      if (i === selected && !isCorrect) b.classList.add("wrong");
    });

    els.btnSubmit.hidden = true;
    els.btnReveal.hidden = true;
    els.btnNext.hidden = false;
    els.btnNext.textContent =
      index < session.length - 1 ? "ข้อถัดไป →" : "ดูสรุปคะแนน";
  }

  function submitAnswer() {
    if (answered) return;
    if (selected === null) {
      els.feedback.hidden = false;
      els.feedback.className = "feedback hint";
      els.feedback.innerHTML = "<strong>เลือกคำตอบก่อน</strong>";
      return;
    }
    const q = session[index];
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) score++;
    else wrong.push({ q, picked: q.choiceList[selected].text });
    showFeedback(q, isCorrect);
  }

  function revealAnswer() {
    if (answered) return;
    const q = session[index];
    selected = q.correctIndex;
    els.choices.querySelectorAll(".choice-btn").forEach((b, i) => {
      b.classList.toggle("selected", i === q.correctIndex);
    });
    answered = true;
    els.feedback.hidden = false;
    els.feedback.className = "feedback reveal";
    const correctText = q.choiceList[q.correctIndex].text;
    els.feedback.innerHTML = `<strong>เฉลย (ไม่นับคะแนน)</strong><p>คำตอบ: <em>${escapeHtml(correctText)}</em></p><p>${escapeHtml(q.explain)}</p>`;
    els.choices.querySelectorAll(".choice-btn").forEach((b, i) => {
      b.disabled = true;
      if (i === q.correctIndex) b.classList.add("correct");
    });
    els.btnSubmit.hidden = true;
    els.btnReveal.hidden = true;
    els.btnNext.hidden = false;
    els.btnNext.textContent =
      index < session.length - 1 ? "ข้อถัดไป →" : "ดูสรุปคะแนน";
  }

  function nextOrFinish() {
    if (index < session.length - 1) {
      index++;
      renderQuestion();
      return;
    }
    finishSession({ completed: true });
  }

  function quitEarly() {
    const done = attemptedCount();
    const total = session.length;
    const skipped = Math.max(0, total - done);

    let msg = `จบแบบทดสอบตอนนี้?\n\nส่งคำตอบแล้ว ${done} จาก ${total} ข้อ`;
    if (skipped > 0) msg += `\nข้อที่ยังไม่ส่ง: ${skipped} ข้อ (ไม่นับในคะแนน)`;
    if (!done) msg += "\n\nยังไม่มีข้อที่ส่งคำตอบ — คะแนนจะเป็น 0";
    if (!confirm(msg)) return;

    finishSession({ completed: false, skipped });
  }

  function abandonQuiz() {
    if (
      session.length &&
      attemptedCount() > 0 &&
      !confirm("ยกเลิกทั้งหมดโดยไม่ดูสรุปคะแนน?")
    ) {
      return;
    }
    goHome();
  }

  function renderWrongList() {
    els.wrongList.innerHTML = "";
    if (!wrong.length) {
      els.wrongList.innerHTML =
        '<p class="empty">ไม่มีข้อที่ตอบผิด — ยอดเยี่ยม</p>';
      return;
    }
    const h = document.createElement("h3");
    h.textContent = `ทบทวน ${wrong.length} ข้อที่ตอบผิด`;
    els.wrongList.appendChild(h);
    wrong.forEach((item, i) => {
      const div = document.createElement("div");
      div.className = "review-item";
      const ans = item.q.choiceList[item.q.correctIndex].text;
      div.innerHTML = `<p class="review-q"><strong>${i + 1}.</strong> ${escapeHtml(item.q.question)}</p>
          <p class="review-pick">คุณเลือก: ${escapeHtml(item.picked)}</p>
          <p class="review-a">✓ ${escapeHtml(ans)}</p>
          <p class="review-e">${escapeHtml(item.q.explain)}</p>`;
      els.wrongList.appendChild(div);
    });
  }

  function finishSession(opts = { completed: true }) {
    const { completed, skipped = 0 } = opts;
    const totalInSession = session.length;
    const done = attemptedCount();
    const denom = completed ? totalInSession : done;
    const pct = denom ? Math.round((score / denom) * 100) : 0;

    els.screenQuiz.hidden = true;
    els.screenResult.hidden = false;

    if (completed) {
      els.resultTitle.textContent = "สรุปผล — ทำครบทุกข้อ";
      els.resultNote.hidden = true;
    } else {
      els.resultTitle.textContent = "สรุปผล — จบกลางทาง";
      els.resultNote.hidden = false;
      const skippedN = skipped || Math.max(0, totalInSession - done);
      els.resultNote.textContent = `ส่งคำตอบแล้ว ${done} จาก ${totalInSession} ข้อ · ข้าม ${skippedN} ข้อ`;
    }

    const scoreLabel = completed
      ? `<span class="big">${score}</span> / <span class="big">${totalInSession}</span>`
      : `<span class="big">${score}</span> / <span class="big">${done}</span> <span class="pct" style="font-size:.85rem">(จาก ${totalInSession} ข้อในชุด)</span>`;

    els.scoreSummary.innerHTML = `${scoreLabel} <span class="pct">(${pct}%)</span>`;
    if (!completed && done === 0) {
      els.wrongList.innerHTML = '<p class="empty">ยังไม่มีข้อที่ส่งคำตอบ</p>';
    } else {
      renderWrongList();
    }
  }

  function goHome() {
    els.screenQuiz.hidden = true;
    els.screenResult.hidden = true;
    els.screenHome.hidden = false;
    els.resultNote.hidden = true;
    els.resultTitle.textContent = "สรุปผล";
    updatePoolStat();
  }

  function setAllTopics(checked) {
    els.topicGrid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = checked;
    });
    updatePoolStat();
  }

  function buildTopicGrid() {
    els.topicGrid.innerHTML = "";
    topics.forEach((t) => {
      const count = countForTopic(t.id);
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = t.id;
      cb.checked = true;
      cb.addEventListener("change", updatePoolStat);
      const span = document.createElement("span");
      span.innerHTML = `${escapeHtml(t.label)} <span class="topic-count">(${count})</span>`;
      label.appendChild(cb);
      label.appendChild(span);
      els.topicGrid.appendChild(label);
    });
  }

  function init() {
    els.statTotal.textContent = String(bank.length);
    buildTopicGrid();
    updatePoolStat();

    els.btnTopicsAll.addEventListener("click", () => setAllTopics(true));
    els.btnTopicsNone.addEventListener("click", () => setAllTopics(false));
    els.questionCount.addEventListener("change", updatePoolStat);

    els.start.addEventListener("click", startSession);
    els.reset.addEventListener("click", abandonQuiz);
    els.btnFinishEarly.addEventListener("click", quitEarly);
    els.btnSubmit.addEventListener("click", submitAnswer);
    els.btnNext.addEventListener("click", nextOrFinish);
    els.btnReveal.addEventListener("click", revealAnswer);
    document.getElementById("btn-retry").addEventListener("click", goHome);
    document.getElementById("btn-retry-same").addEventListener("click", startSession);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
