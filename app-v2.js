(() => {
  "use strict";

  const data = window.SIM_DATA;
  const logic = window.SimLogic;
  let state = null;
  let lastResult = null;
  let selectedAction = "balance";
  let maxMonths = 12;
  let activeMode = "training12";

  const $ = (id) => document.getElementById(id);
  const el = {
    startScreen: $("startScreen"),
    gameScreen: $("gameScreen"),
    finalOverlay: $("finalOverlay"),
    modeSelect: $("modeSelect"),
    scenarioSelect: $("scenarioSelect"),
    difficultySelect: $("difficultySelect"),
    startButton: $("startButton"),
    resetButton: $("resetButton"),
    exportCsvButton: $("exportCsvButton"),
    closeFinalButton: $("closeFinalButton"),
    seasonLabel: $("seasonLabel"),
    missionTitle: $("missionTitle"),
    storyCard: $("storyCard"),
    cashValue: $("cashValue"),
    teamValue: $("teamValue"),
    careValue: $("careValue"),
    usersValue: $("usersValue"),
    cashMeter: $("cashMeter"),
    teamMeter: $("teamMeter"),
    careMeter: $("careMeter"),
    usersMeter: $("usersMeter"),
    monthProgressText: $("monthProgressText"),
    monthProgressBar: $("monthProgressBar"),
    moodLabel: $("moodLabel"),
    actionCards: $("actionCards"),
    advanceButton: $("advanceButton"),
    resultCard: $("resultCard"),
    badgeRow: $("badgeRow"),
    trendCanvas: $("trendCanvas"),
    detailPanel: $("detailPanel"),
    toggleDetails: $("toggleDetails"),
    finalRank: $("finalRank"),
    finalText: $("finalText")
  };

  const actions = {
    balance: {
      icon: "◎",
      title: "バランスを見る",
      copy: "受け入れ・チーム・請求を大きく崩さず、今月の状態を整えます。",
      impacts: ["安定", "迷ったらここ"],
      decisions: {
        acceptance: "standard",
        sales: "moderate",
        recruitment: "none",
        teamBuilding: "normal",
        management: "billing",
        fatigueCare: "none",
        financing: "none"
      }
    },
    grow: {
      icon: "↗",
      title: "利用者さんを増やす",
      copy: "紹介を取りに行き、受け入れも強めます。売上は伸びやすい一方で負荷も増えます。",
      impacts: ["売上↑", "疲弊↑"],
      decisions: {
        acceptance: "aggressive",
        sales: "active",
        recruitment: "none",
        teamBuilding: "normal",
        management: "utilization",
        fatigueCare: "none",
        financing: "none"
      }
    },
    team: {
      icon: "＋",
      title: "チームを整える",
      copy: "面談・会議・休息を優先します。短期成長は少し緩みますが、続ける力を戻します。",
      impacts: ["余裕↑", "成長↓"],
      decisions: {
        acceptance: "cautious",
        sales: "maintenance",
        recruitment: "none",
        teamBuilding: "meeting",
        management: "billing",
        fatigueCare: "visitControl",
        financing: "none"
      }
    },
    hire: {
      icon: "人",
      title: "採用に動く",
      copy: "将来の訪問余力を作ります。費用は先に出て、効果は翌月以降に出ます。",
      impacts: ["体制↑", "現金↓"],
      decisions: {
        acceptance: "standard",
        sales: "moderate",
        recruitment: "active",
        teamBuilding: "training",
        management: "billing",
        fatigueCare: "none",
        financing: "none"
      }
    },
    quality: {
      icon: "★",
      title: "品質と単価を育てる",
      copy: "請求・加算・制度対応を進めます。すぐ派手には伸びませんが、未来の土台になります。",
      impacts: ["単価↑", "信頼↑"],
      decisions: {
        acceptance: "standard",
        sales: "moderate",
        recruitment: "none",
        teamBuilding: "training",
        management: "addOn",
        fatigueCare: "adminSupport",
        financing: "none"
      }
    },
    cash: {
      icon: "守",
      title: "現金を守る",
      copy: "支出を抑え、必要なら借入でショートを避けます。成長より継続を優先します。",
      impacts: ["資金↑", "成長↓"],
      decisions: {
        acceptance: "cautious",
        sales: "maintenance",
        recruitment: "none",
        teamBuilding: "normal",
        management: "billing",
        fatigueCare: "none",
        financing: "borrow300"
      }
    }
  };

  function money(value) {
    return `${Math.round((value || 0) / 10000).toLocaleString("ja-JP")}万円`;
  }

  function pct(value) {
    return `${Math.round((value || 0) * 100)}%`;
  }

  function fillSelect(select, options, defaultKey) {
    select.textContent = "";
    Object.entries(options).forEach(([key, value]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = value.label;
      select.appendChild(option);
    });
    select.value = defaultKey;
  }

  function showPage(page) {
    document.querySelectorAll(".tab-page").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.page === page);
    });
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.target === page);
    });
    if (page === "review") drawTrend();
  }

  function getYearMonth(month) {
    return { year: Math.ceil(month / 12), month: ((month - 1) % 12) + 1 };
  }

  function metricHealth() {
    if (!state) return "落ち着いた月";
    if (state.gameOver) return "継続危機";
    if (state.cash < 3000000) return "資金注意";
    if (state.fatigue >= 70 || state.turnoverRisk >= 65) return "チーム注意";
    if (state.careQuality < 60 || state.billingQuality < 60) return "品質注意";
    if (state.utilization >= 0.92) return "高稼働";
    return "落ち着いた月";
  }

  function storyText() {
    if (!state) return "";
    const lines = [];
    if (state.cash < 3000000) lines.push("現金の余裕が少なく、次の支払いを意識した判断が必要です。");
    if (state.utilization >= 0.92) lines.push("利用者さんは増えていますが、訪問の詰まりが見え始めています。");
    if (state.fatigue >= 70) lines.push("スタッフの疲れが溜まっています。休息や業務整理が効く局面です。");
    if (state.careQuality < 60) lines.push("ケアの安定感が落ちています。教育・記録・連携を整えるタイミングです。");
    if (!lines.length) lines.push("大きな危険サインはありません。今月は、伸ばすか整えるかを選びやすい月です。");
    return lines[0];
  }

  function missionText() {
    if (!state) return "今月のミッション";
    if (state.cash < 3000000) return "現金を守ろう";
    if (state.fatigue >= 70 || state.turnoverRisk >= 65) return "チームを守ろう";
    if (state.careQuality < 60 || state.billingQuality < 60) return "品質を戻そう";
    if (state.utilization < 0.75) return "利用者さんを増やそう";
    return "よいバランスを続けよう";
  }

  function setMeter(node, value) {
    node.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  function renderHome() {
    const current = Math.min(state.month, maxMonths);
    const ym = getYearMonth(current);
    el.seasonLabel.textContent = `${ym.year}年目 ${ym.month}月`;
    el.missionTitle.textContent = missionText();
    el.storyCard.innerHTML = `<strong>${metricHealth()}</strong><p>${storyText()}</p>`;
    el.cashValue.textContent = money(state.cash);
    el.teamValue.textContent = String(Math.max(0, Math.round((state.teamCondition + (100 - state.fatigue) + (100 - state.turnoverRisk)) / 3)));
    el.careValue.textContent = String(Math.max(0, Math.round((state.careQuality + state.billingQuality) / 2)));
    el.usersValue.textContent = `${state.users}名`;
    setMeter(el.cashMeter, state.cash / 100000);
    setMeter(el.teamMeter, Math.max(0, Math.round((state.teamCondition + (100 - state.fatigue) + (100 - state.turnoverRisk)) / 3)));
    setMeter(el.careMeter, Math.max(0, Math.round((state.careQuality + state.billingQuality) / 2)));
    setMeter(el.usersMeter, Math.min(100, state.users / 1.8));
    const done = Math.max(0, Math.min(maxMonths, state.month - 1));
    el.monthProgressText.textContent = `${done} / ${maxMonths}か月`;
    el.monthProgressBar.style.width = `${(done / maxMonths) * 100}%`;
    el.moodLabel.textContent = metricHealth();
  }

  function renderActions() {
    el.actionCards.textContent = "";
    Object.entries(actions).forEach(([key, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `action-card${key === selectedAction ? " is-selected" : ""}`;
      button.dataset.action = key;
      const impacts = action.impacts.map((impact) => `<span>${impact}</span>`).join("");
      button.innerHTML = `
        <div class="action-icon">${action.icon}</div>
        <div>
          <h3>${action.title}</h3>
          <p>${action.copy}</p>
          <div class="impact-row">${impacts}</div>
        </div>
      `;
      button.addEventListener("click", () => {
        selectedAction = key;
        renderActions();
      });
      el.actionCards.appendChild(button);
    });
  }

  function voiceForResult(result) {
    if (result.gameOver) return ["管理者メモ", result.gameOverReason || "継続条件を満たせなくなりました。"];
    if (result.fatigue >= 70) return ["スタッフの声", "最近、記録や情報共有が後ろ倒しになっていて少し不安です。"];
    if (result.utilization >= 0.92) return ["スタッフの声", "訪問は回せています。でも、このペースが続くと少し苦しいです。"];
    if (result.careQuality < 60) return ["ケアマネの声", "最近、連絡のタイミングに少し波がありますね。"];
    if (result.cash < 3000000) return ["管理者メモ", "黒字かどうかだけでなく、手元に残る現金を見ておきたい月です。"];
    if (result.hired) return ["チームの声", "新しい仲間が増える見込みです。受け入れ準備も必要ですね。"];
    if (result.addOnAcquired) return ["管理者メモ", "加算対応が進みました。品質と請求体制を整えた成果です。"];
    return ["現場の空気", "大きな崩れはありません。次に伸ばすものを選べる状態です。"];
  }

  function badges(result) {
    const list = [];
    if (result.monthlyProfit > 0) list.push("黒字月");
    if (result.utilization >= 0.75 && result.utilization <= 0.9) list.push("ちょうどよい稼働");
    if (result.turnoverRisk < 35 && result.fatigue < 55) list.push("チームを守れた");
    if (result.addOnAcquired) list.push("加算獲得");
    if (result.hired) list.push("採用成功");
    if (result.cash > 5000000 && result.monthlyProfit > 0) list.push("資金安定");
    return list.slice(0, 4);
  }

  function renderResult(result) {
    const [speaker, voice] = voiceForResult(result);
    el.resultCard.classList.remove("empty");
    el.resultCard.innerHTML = `
      <span class="mini-label">月末結果</span>
      <h2>${result.decisionLabels.acceptance}・${result.decisionLabels.sales}</h2>
      <div class="voice-card"><b>${speaker}</b><p>${voice}</p></div>
      <div class="result-stats">
        <div><span>現金</span><strong>${money(result.cash)}</strong></div>
        <div><span>利益</span><strong>${money(result.monthlyProfit)}</strong></div>
        <div><span>入金</span><strong>${money(result.cashIn)}</strong></div>
      </div>
      <p>${(result.notes && result.notes[0]) || "今月の判断が、現金・人・品質にどう影響したかを見てみましょう。"}</p>
    `;
    el.badgeRow.textContent = "";
    badges(result).forEach((badge) => {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = badge;
      el.badgeRow.appendChild(span);
    });
  }

  function renderDetails() {
    if (!state) return;
    const last = state.history[state.history.length - 1] || {};
    const items = [
      ["月間売上", money(last.revenue || state.monthlyRevenue)],
      ["月間利益", money(state.monthlyProfit)],
      ["今月入金", money(last.cashIn || 0)],
      ["稼働率", pct(state.utilization)],
      ["スタッフ", `${state.staff}名`],
      ["訪問件数", `${state.visits}件`],
      ["地域信頼", state.regionalTrust],
      ["請求品質", state.billingQuality],
      ["疲弊度", state.fatigue],
      ["継続リスク", state.turnoverRisk]
    ];
    el.detailPanel.textContent = "";
    items.forEach(([label, value]) => {
      const div = document.createElement("div");
      div.textContent = `${label}: ${value}`;
      el.detailPanel.appendChild(div);
    });
  }

  function drawTrend() {
    if (!state) return;
    const canvas = el.trendCanvas;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const rows = state.history;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (!rows.length) {
      ctx.fillStyle = "#65758b";
      ctx.font = "24px sans-serif";
      ctx.fillText("月を進めると推移が表示されます", 90, 160);
      return;
    }
    const pad = { left: 54, right: 24, top: 28, bottom: 38 };
    const x = (i) => pad.left + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * (width - pad.left - pad.right));
    const y = (value) => pad.top + (1 - value / 100) * (height - pad.top - pad.bottom);
    ctx.strokeStyle = "#dbe5ee";
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach((tick) => {
      const yy = y(tick);
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(width - pad.right, yy);
      ctx.stroke();
      ctx.fillStyle = "#65758b";
      ctx.font = "15px sans-serif";
      ctx.fillText(String(tick), 16, yy + 5);
    });
    const drawLine = (color, getter) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      rows.forEach((row, index) => {
        const yy = y(getter(row));
        if (index === 0) ctx.moveTo(x(index), yy);
        else ctx.lineTo(x(index), yy);
      });
      ctx.stroke();
    };
    drawLine("#148477", (row) => Math.min(100, Math.max(0, row.cash / 100000)));
    drawLine("#497dcc", (row) => Math.max(0, Math.min(100, (row.teamCondition + (100 - row.fatigue) + (100 - row.turnoverRisk)) / 3)));
    drawLine("#f2b24d", (row) => Math.max(0, Math.min(100, (row.careQuality + row.billingQuality) / 2)));
    ctx.fillStyle = "#122034";
    ctx.font = "18px sans-serif";
    ctx.fillText("現金・チーム・ケアの安定", pad.left, 24);
  }

  function renderAll() {
    renderHome();
    renderActions();
    renderDetails();
    drawTrend();
  }

  function startGame() {
    activeMode = el.modeSelect.value;
    maxMonths = data.playModes[activeMode].months;
    state = logic.createInitialState(el.scenarioSelect.value, el.difficultySelect.value);
    lastResult = null;
    selectedAction = "balance";
    el.startScreen.classList.add("is-hidden");
    el.gameScreen.classList.remove("is-hidden");
    el.finalOverlay.classList.add("is-hidden");
    renderAll();
    showPage("home");
  }

  function advanceMonth() {
    if (!state || state.gameOver || state.month > maxMonths) return;
    const outcome = logic.advanceMonth(state, actions[selectedAction].decisions);
    state = outcome.state;
    lastResult = outcome.result;
    renderAll();
    renderResult(lastResult);
    showPage("result");
    if (state.gameOver || state.month > maxMonths) showFinal();
  }

  function showFinal() {
    const evaluation = logic.evaluateFinal(state);
    el.finalOverlay.classList.remove("is-hidden");
    el.finalRank.textContent = `${evaluation.rank}: ${evaluation.title}`;
    el.finalText.innerHTML = "";
    const ul = document.createElement("ul");
    evaluation.comments.forEach((comment) => {
      const li = document.createElement("li");
      li.textContent = comment;
      ul.appendChild(li);
    });
    el.finalText.appendChild(ul);
  }

  function exportCsv() {
    if (!state || !state.history.length) return;
    const headers = ["month", "cash", "revenue", "profit", "cashIn", "users", "visits", "staff", "utilization", "team", "fatigue", "risk", "care", "billing", "trust"];
    const rows = state.history.map((row) => [
      row.month,
      row.cash,
      row.revenue,
      row.monthlyProfit,
      row.cashIn,
      row.usersAfter,
      row.visits,
      row.staff,
      Math.round(row.utilization * 1000) / 10,
      row.teamCondition,
      row.fatigue,
      row.turnoverRisk,
      row.careQuality,
      row.billingQuality,
      row.regionalTrust
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visit-nursing-game-v2.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    fillSelect(el.modeSelect, data.playModes, "training12");
    fillSelect(el.scenarioSelect, data.scenarios, "existing");
    fillSelect(el.difficultySelect, data.difficulties, "normal");
    el.startButton.addEventListener("click", startGame);
    el.resetButton.addEventListener("click", () => {
      el.gameScreen.classList.add("is-hidden");
      el.startScreen.classList.remove("is-hidden");
    });
    el.advanceButton.addEventListener("click", advanceMonth);
    el.closeFinalButton.addEventListener("click", () => {
      el.finalOverlay.classList.add("is-hidden");
      showPage("review");
    });
    el.exportCsvButton.addEventListener("click", exportCsv);
    el.toggleDetails.addEventListener("click", () => {
      el.detailPanel.classList.toggle("is-hidden");
    });
    document.querySelectorAll(".tab-button, .next-tab").forEach((button) => {
      button.addEventListener("click", () => showPage(button.dataset.target));
    });
  }

  init();
})();
