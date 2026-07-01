(() => {
  "use strict";

  const data = window.SIM_DATA;
  const logic = window.SimLogic;
  const constants = data.constants;

  let state = null;
  let previousState = null;
  let lastResult = null;
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
    plSnapshot: $("plSnapshot"),
    presetCards: $("presetCards"),
    acceptanceLever: $("acceptanceLever"),
    salesLever: $("salesLever"),
    recruitmentLever: $("recruitmentLever"),
    teamLever: $("teamLever"),
    managementLever: $("managementLever"),
    fatigueLever: $("fatigueLever"),
    financingLever: $("financingLever"),
    choicePlPreview: $("choicePlPreview"),
    advanceButton: $("advanceButton"),
    impactDashboard: $("impactDashboard"),
    impactPl: $("impactPl"),
    impactExplanation: $("impactExplanation"),
    resultCard: $("resultCard"),
    badgeRow: $("badgeRow"),
    trendCanvas: $("trendCanvas"),
    detailPanel: $("detailPanel"),
    toggleDetails: $("toggleDetails"),
    finalRank: $("finalRank"),
    finalText: $("finalText")
  };

  const presets = {
    balanced: {
      title: "安定運営",
      copy: "標準受け入れ、請求管理、無理のない運営。",
      decisions: { acceptance: "standard", sales: "moderate", recruitment: "none", teamBuilding: "normal", management: "billing", fatigueCare: "none", financing: "none" }
    },
    growth: {
      title: "成長優先",
      copy: "営業と受け入れを強め、売上を伸ばす。",
      decisions: { acceptance: "aggressive", sales: "active", recruitment: "normal", teamBuilding: "normal", management: "utilization", fatigueCare: "none", financing: "none" }
    },
    team: {
      title: "チーム回復",
      copy: "受け入れを抑え、疲弊と継続リスクを下げる。",
      decisions: { acceptance: "cautious", sales: "maintenance", recruitment: "none", teamBuilding: "meeting", management: "billing", fatigueCare: "visitControl", financing: "none" }
    },
    capacity: {
      title: "体制づくり",
      copy: "採用と教育を進め、未来のケア時間を作る。",
      decisions: { acceptance: "standard", sales: "moderate", recruitment: "active", teamBuilding: "training", management: "billing", fatigueCare: "adminSupport", financing: "none" }
    },
    quality: {
      title: "単価・品質",
      copy: "加算、請求、教育に寄せて利益体質を作る。",
      decisions: { acceptance: "standard", sales: "moderate", recruitment: "none", teamBuilding: "training", management: "addOn", fatigueCare: "adminSupport", financing: "none" }
    },
    cash: {
      title: "資金防衛",
      copy: "現金ショートを避け、来月へつなぐ。",
      decisions: { acceptance: "cautious", sales: "maintenance", recruitment: "none", teamBuilding: "normal", management: "billing", fatigueCare: "none", financing: "borrow300" }
    }
  };

  const leverMap = {
    acceptance: "acceptanceLever",
    sales: "salesLever",
    recruitment: "recruitmentLever",
    teamBuilding: "teamLever",
    management: "managementLever",
    fatigueCare: "fatigueLever",
    financing: "financingLever"
  };

  function money(value) {
    return `${Math.round((value || 0) / 10000).toLocaleString("ja-JP")}万円`;
  }

  function pct(value) {
    return `${Math.round((value || 0) * 100)}%`;
  }

  function signed(value, formatter = (v) => v) {
    const rounded = Math.round(value);
    if (rounded > 0) return `+${formatter(rounded)}`;
    if (rounded < 0) return `-${formatter(Math.abs(rounded))}`;
    return "±0";
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

  function currentDecisions() {
    return {
      acceptance: el.acceptanceLever.value,
      sales: el.salesLever.value,
      recruitment: el.recruitmentLever.value,
      teamBuilding: el.teamLever.value,
      management: el.managementLever.value,
      fatigueCare: el.fatigueLever.value,
      financing: el.financingLever.value
    };
  }

  function applyPreset(key) {
    const preset = presets[key];
    Object.entries(preset.decisions).forEach(([decisionKey, value]) => {
      el[leverMap[decisionKey]].value = value;
    });
    renderChoicePreview();
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

  function fixedCostFor(targetState) {
    const vehicle = targetState.staff * constants.carCost;
    let scale = 0;
    if (targetState.staff >= 16) scale = constants.scaleAdminCost16 || 800000;
    else if (targetState.staff >= 12) scale = constants.scaleAdminCost12 || 500000;
    else if (targetState.staff >= 8) scale = constants.scaleAdminCost8 || 300000;
    return targetState.staff * constants.staffCost + constants.rentCost + constants.otherFixedCost + vehicle + scale;
  }

  function getPL(targetState, result) {
    const visits = result?.visits ?? targetState.visits;
    const users = result?.usersAfter ?? targetState.users;
    const staff = result?.staff ?? targetState.staff;
    const price = result?.averageVisitPrice ?? targetState.averageVisitPrice;
    const revenue = result?.revenue ?? visits * price;
    const cost = result?.totalExpense ?? fixedCostFor(targetState);
    const profit = result?.monthlyProfit ?? revenue - cost;
    const careHours = Math.round(visits);
    const carePerStaff = staff ? Math.round(careHours / staff) : 0;
    const carePerUser = users ? Math.round((careHours / users) * 10) / 10 : 0;
    return { users, staff, visits, price, revenue, cost, profit, careHours, carePerStaff, carePerUser };
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
    const lines = [];
    if (state.cash < 3000000) lines.push("現金の余裕が少なく、次の支払いを意識した判断が必要です。");
    if (state.utilization >= 0.92) lines.push("利用者さんは増えていますが、訪問の詰まりが見え始めています。");
    if (state.fatigue >= 70) lines.push("スタッフの疲れが溜まっています。休息や業務整理が効く局面です。");
    if (state.careQuality < 60) lines.push("ケアの安定感が落ちています。教育・記録・連携を整えるタイミングです。");
    if (!lines.length) lines.push("大きな危険サインはありません。今月は、伸ばすか整えるかを選びやすい月です。");
    return lines[0];
  }

  function missionText() {
    if (state.cash < 3000000) return "現金を守ろう";
    if (state.fatigue >= 70 || state.turnoverRisk >= 65) return "チームを守ろう";
    if (state.careQuality < 60 || state.billingQuality < 60) return "品質を戻そう";
    if (state.utilization < 0.75) return "ケア時間を増やそう";
    return "よいバランスを続けよう";
  }

  function setMeter(node, value) {
    node.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  function renderPLCard(node, title, pl, mode = "normal") {
    const profitClass = pl.profit >= 0 ? "good" : "bad";
    node.innerHTML = `
      <span class="mini-label">${title}</span>
      <div class="pl-main ${profitClass}">
        <strong>${money(pl.profit)}</strong>
        <span>利益 = 売上 ${money(pl.revenue)} - コスト ${money(pl.cost)}</span>
      </div>
      <div class="formula-stack">
        <div><b>売上</b><span>総ケア時間 ${pl.careHours}件 × 単価 ${Math.round(pl.price).toLocaleString("ja-JP")}円</span></div>
        <div><b>総ケア時間</b><span>利用者 ${pl.users}名 × 顧客あたり ${pl.carePerUser}件</span></div>
        <div><b>スタッフ負荷</b><span>${pl.staff}名 × 1人あたり ${pl.carePerStaff}件</span></div>
        <div><b>コスト</b><span>人件費 + 採用費 + その他販管費</span></div>
      </div>
      ${mode === "preview" ? "<p class=\"pl-note\">この構造を見ながら、受け入れ・営業・採用・品質投資を組み合わせます。</p>" : ""}
    `;
  }

  function renderHome() {
    const current = Math.min(state.month, maxMonths);
    const ym = getYearMonth(current);
    const teamScore = Math.max(0, Math.round((state.teamCondition + (100 - state.fatigue) + (100 - state.turnoverRisk)) / 3));
    const careScore = Math.max(0, Math.round((state.careQuality + state.billingQuality) / 2));
    el.seasonLabel.textContent = `${ym.year}年目 ${ym.month}月`;
    el.missionTitle.textContent = missionText();
    el.storyCard.innerHTML = `<strong>${metricHealth()}</strong><p>${storyText()}</p>`;
    el.cashValue.textContent = money(state.cash);
    el.teamValue.textContent = String(teamScore);
    el.careValue.textContent = String(careScore);
    el.usersValue.textContent = `${state.users}名`;
    setMeter(el.cashMeter, state.cash / 100000);
    setMeter(el.teamMeter, teamScore);
    setMeter(el.careMeter, careScore);
    setMeter(el.usersMeter, Math.min(100, state.users / 1.8));
    const done = Math.max(0, Math.min(maxMonths, state.month - 1));
    el.monthProgressText.textContent = `${done} / ${maxMonths}か月`;
    el.monthProgressBar.style.width = `${(done / maxMonths) * 100}%`;
    el.moodLabel.textContent = metricHealth();
    renderPLCard(el.plSnapshot, "今月のPL構造", getPL(state), "preview");
  }

  function renderPresets() {
    el.presetCards.textContent = "";
    Object.entries(presets).forEach(([key, preset]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-card";
      button.innerHTML = `<strong>${preset.title}</strong><span>${preset.copy}</span>`;
      button.addEventListener("click", () => applyPreset(key));
      el.presetCards.appendChild(button);
    });
  }

  function renderChoicePreview() {
    if (!state) return;
    const d = currentDecisions();
    const synthetic = { ...state };
    const acceptance = data.decisions.acceptance[d.acceptance];
    const sales = data.decisions.sales[d.sales];
    const recruitment = data.decisions.recruitment[d.recruitment];
    const management = data.decisions.management[d.management];
    const fatigueCare = data.decisions.fatigueCare[d.fatigueCare];
    const roughNewUsers = Math.round(((sales.minUsers || 0) + (sales.maxUsers || 0)) / 2 + (acceptance.deltaUsers || 0));
    synthetic.users = Math.max(0, state.users + roughNewUsers - Math.round(state.users * constants.userExitRate));
    synthetic.visits = Math.max(0, synthetic.users * constants.visitsPerUser + (management.visitAdjust || 0) + (fatigueCare.visitAdjust || 0));
    synthetic.staff = state.staff;
    const previewCost = fixedCostFor(synthetic) + (recruitment.monthlyCost || 0) + (management.cost || 0) + (fatigueCare.cost || 0);
    const previewRevenue = synthetic.visits * state.averageVisitPrice;
    const pl = getPL(synthetic, { visits: synthetic.visits, usersAfter: synthetic.users, staff: synthetic.staff, averageVisitPrice: state.averageVisitPrice, revenue: previewRevenue, totalExpense: previewCost, monthlyProfit: previewRevenue - previewCost });
    renderPLCard(el.choicePlPreview, "選択中のざっくりPL", pl, "preview");
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

  function deltaCard(label, before, after, formatter, lowerBetter = false) {
    const diff = after - before;
    const good = lowerBetter ? diff <= 0 : diff >= 0;
    return `<div class="delta-card ${good ? "good" : "bad"}"><span>${label}</span><strong>${formatter(after)}</strong><small>${signed(diff, (v) => formatter(v).replace("万円", ""))}</small></div>`;
  }

  function renderImpact(result) {
    const before = previousState;
    el.impactDashboard.innerHTML = [
      deltaCard("現金", before.cash, result.cash, money),
      deltaCard("利益", before.monthlyProfit, result.monthlyProfit, money),
      deltaCard("利用者", before.users, result.usersAfter, (v) => `${Math.round(v)}名`),
      deltaCard("訪問件数", before.visits, result.visits, (v) => `${Math.round(v)}件`),
      deltaCard("稼働率", before.utilization * 100, result.utilization * 100, (v) => `${Math.round(v)}%`, true),
      deltaCard("疲弊度", before.fatigue, result.fatigue, (v) => `${Math.round(v)}`, true)
    ].join("");
    renderPLCard(el.impactPl, "今月のPL変換", getPL(state, result));
    const points = [];
    points.push(`売上は「${result.visits}件 × ${Math.round(result.averageVisitPrice).toLocaleString("ja-JP")}円」で決まりました。`);
    points.push(`コストには固定費に加え、採用費・投資費・疲弊対策費が乗ります。`);
    if (result.cashIn !== result.revenue) points.push("売上と入金はズレます。今月の売上はすぐ現金になりません。");
    if (result.utilization >= 0.9) points.push("稼働が高いため、利益が出ても疲弊や品質に負荷が出ます。");
    el.impactExplanation.innerHTML = `<strong>この判断で起きたこと</strong><p>${points.join(" ")}</p>`;
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
    renderChoicePreview();
    renderDetails();
    drawTrend();
  }

  function startGame() {
    activeMode = el.modeSelect.value;
    maxMonths = data.playModes[activeMode].months;
    state = logic.createInitialState(el.scenarioSelect.value, el.difficultySelect.value);
    previousState = null;
    lastResult = null;
    el.startScreen.classList.add("is-hidden");
    el.gameScreen.classList.remove("is-hidden");
    el.finalOverlay.classList.add("is-hidden");
    applyPreset("balanced");
    renderAll();
    showPage("home");
  }

  function advanceMonth() {
    if (!state || state.gameOver || state.month > maxMonths) return;
    previousState = { ...state };
    const outcome = logic.advanceMonth(state, currentDecisions());
    state = outcome.state;
    lastResult = outcome.result;
    renderAll();
    renderImpact(lastResult);
    renderResult(lastResult);
    showPage("impact");
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
      row.month, row.cash, row.revenue, row.monthlyProfit, row.cashIn, row.usersAfter, row.visits, row.staff,
      Math.round(row.utilization * 1000) / 10, row.teamCondition, row.fatigue, row.turnoverRisk, row.careQuality, row.billingQuality, row.regionalTrust
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
    fillSelect(el.acceptanceLever, data.decisions.acceptance, "standard");
    fillSelect(el.salesLever, data.decisions.sales, "moderate");
    fillSelect(el.recruitmentLever, data.decisions.recruitment, "none");
    fillSelect(el.teamLever, data.decisions.teamBuilding, "normal");
    fillSelect(el.managementLever, data.decisions.management, "billing");
    fillSelect(el.fatigueLever, data.decisions.fatigueCare, "none");
    fillSelect(el.financingLever, data.decisions.financing, "none");
    renderPresets();
    Object.values(leverMap).forEach((id) => el[id].addEventListener("change", renderChoicePreview));
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
