(() => {
  "use strict";
  const D = window.SIM_DATA;
  const L = window.SimLogic;
  let state = null;
  let maxMonths = 12;
  let playMode = "training12";
  const $ = (id) => document.getElementById(id);
  const ids = ["setupPanel","gamePanel","finalPanel","finalTitle","guideOverlay","openGuideButton","closeGuideButton","playModeSelect","scenarioSelect","difficultySelect","startButton","resetButton","exportCsvButton","decisionForm","advanceButton","acceptanceSelect","salesSelect","recruitmentSelect","teamBuildingSelect","managementSelect","fatigueCareSelect","financingSelect","decisionPreviewList","monthSummaryBox","currentMonth","monthCaption","monthProgressLabel","monthProgressTrack","annualTargetBox","cashMetric","fixedCostMetric","profitMetric","cashInMetric","utilizationMetric","turnoverMetric","usersKpi","visitsKpi","staffKpi","trustKpi","teamKpi","fatigueKpi","careKpi","billingKpi","resultSummary","tutorialBox","strategyBox","questionBox","eventCard","reasonDetails","reasonList","eventList","finalContent","trendCanvas"];
  const el = Object.fromEntries(ids.map((id) => [id, $(id)]));
  const money = (v) => `${Math.round((v || 0) / 10000).toLocaleString("ja-JP")}万円`;
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  const signed = (v) => v > 0 ? `+${v}` : v < 0 ? String(v) : "±0";
  const ym = (m) => ({ y: Math.ceil(m / 12), m: ((m - 1) % 12) + 1 });
  const text = (node, value) => { if (node) node.textContent = value; };

  function fill(select, group, def) {
    select.textContent = "";
    Object.entries(group).forEach(([key, value]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = value.label;
      select.appendChild(option);
    });
    select.value = def || Object.keys(group)[0];
  }

  function decisions() {
    return {
      acceptance: el.acceptanceSelect.value,
      sales: el.salesSelect.value,
      recruitment: el.recruitmentSelect.value,
      teamBuilding: el.teamBuildingSelect.value,
      management: el.managementSelect.value,
      fatigueCare: el.fatigueCareSelect.value,
      financing: el.financingSelect.value
    };
  }

  function delta(node, value, prev, formatter, lowerBetter = false) {
    if (!node) return;
    let badge = node.parentElement.querySelector(".delta-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "delta-badge";
      node.parentElement.appendChild(badge);
    }
    badge.className = "delta-badge";
    if (prev == null) {
      badge.textContent = "(前月差 --)";
      badge.classList.add("delta-flat");
      return;
    }
    const d = value - prev;
    badge.textContent = `(${formatter(d)})`;
    if (d === 0) badge.classList.add("delta-flat");
    else if ((d > 0 && !lowerBetter) || (d < 0 && lowerBetter)) badge.classList.add("delta-up");
    else badge.classList.add("delta-down");
  }

  function gauge(id, value, min, max) {
    const node = $(id);
    if (!node) return;
    node.style.setProperty("--gauge-position", String(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))));
  }

  function renderProgress() {
    const done = state ? Math.max(0, Math.min(maxMonths, state.month - 1)) : 0;
    text(el.monthCaption, `${done} / ${maxMonths}か月経過`);
    text(el.monthProgressLabel, `経過月数 ${done} / ${maxMonths}`);
    el.monthProgressTrack.textContent = "";
    el.monthProgressTrack.style.gridTemplateColumns = `repeat(${maxMonths}, minmax(0, 1fr))`;
    for (let i = 1; i <= maxMonths; i += 1) {
      const span = document.createElement("span");
      span.className = `month-step${i <= done ? " is-complete" : ""}${i % 12 === 0 ? " is-year-end" : ""}`;
      el.monthProgressTrack.appendChild(span);
    }
  }

  function annualBox() {
    el.annualTargetBox.textContent = "";
    const now = ym(Math.min(state.month, maxMonths));
    const rows = state.history.filter((r) => Math.ceil(r.month / 12) === now.y);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const profit = rows.reduce((s, r) => s + r.monthlyProfit, 0);
    const margin = revenue ? Math.round((profit / revenue) * 1000) / 10 : 0;
    const boxes = playMode === "training12"
      ? [["このモードの目的", "経営の基本因果を体験する"], ["今月の見方", "現金・稼働・疲弊・品質を同時に見る"], ["年度累計", `売上 ${money(revenue)} / 利益 ${money(profit)} / 利益率 ${margin}%`], ["判断の軸", "ケアを続けるためのバランスを守る"]]
      : [[`${now.y}年目テーマ`, D.yearThemes[now.y - 1] || "持続可能な経営"], ["5年ロードマップ", "1年目 黒字化 / 2年目 安定化 / 3年目 信頼形成 / 4年目 チーム運営 / 5年目 完成"], ["年度累計", `売上 ${money(revenue)} / 利益 ${money(profit)} / 利益率 ${margin}%`], ["達成率", targetText(now.y, revenue, profit)]];
    boxes.forEach(([a, b]) => {
      const box = document.createElement("div");
      box.innerHTML = `<span>${a}</span><strong></strong>`;
      box.querySelector("strong").textContent = b;
      el.annualTargetBox.appendChild(box);
    });
  }

  function targetText(year, revenue, profit) {
    const t = D.annualTargets[year - 1];
    if (!t) return "-";
    return `売上 ${Math.round(revenue / t.revenue * 100)}% / 利益 ${Math.round(profit / t.profit * 100)}%`;
  }

  function summary() {
    const now = ym(Math.min(state.month, maxMonths));
    const warnings = [];
    if (state.cash < 3000000) warnings.push("現預金が薄く、資金繰りが優先です");
    if (state.utilization >= 0.9) warnings.push(`稼働率が${pct(state.utilization)}まで上がっています`);
    if (state.fatigue >= 70) warnings.push("疲弊度が危険域です");
    if (state.careQuality < 60) warnings.push("ケア品質の回復が必要です");
    const focus = warnings.length ? warnings.join("。") : "大きな危険サインはありません。次に伸ばす指標を選ぶ月です";
    el.monthSummaryBox.innerHTML = `<strong>${now.y}年目 ${now.m}月のテーマ: ${playMode === "training12" ? "基本因果の理解" : D.yearThemes[now.y - 1] || "持続可能な経営"}</strong><p></p>`;
    el.monthSummaryBox.querySelector("p").textContent = `${focus}。売上だけでなく、現金・人・品質を残して来月に進めるかを見ます。`;
  }

  function preview() {
    const d = decisions();
    const items = [];
    if (d.acceptance === "aggressive") items.push("短期売上: 上がりやすい / 疲弊・品質: 負荷がかかりやすい");
    if (d.acceptance === "cautious") items.push("受け入れ余力: 守りやすい / 売上成長: 緩やか");
    if (d.sales === "active") items.push("紹介: 増えやすい / 営業費: 発生する");
    if (d.recruitment !== "none") items.push("将来の訪問余力: 増える可能性 / 採用費・教育負荷: 先行する");
    if (d.teamBuilding !== "normal") items.push("チーム状態: 改善しやすい / 新規受け入れ余力: 少し下がる");
    if (d.management === "addOn") items.push("単価: 上がる可能性 / 品質・請求体制が土台になる");
    if (d.fatigueCare !== "none") items.push("疲弊度: 下がりやすい / 現預金: 投資費用が先に出る");
    if (!items.length) items.push("大きな変化は少なく、現状維持寄りの判断です");
    el.decisionPreviewList.textContent = "";
    items.slice(0, 5).forEach((t) => { const li = document.createElement("li"); li.textContent = t; el.decisionPreviewList.appendChild(li); });
  }

  function render() {
    if (!state) return;
    const prev = state.history.length >= 2 ? state.history[state.history.length - 2] : null;
    const last = state.history.at(-1);
    const now = ym(Math.min(state.month, maxMonths));
    text(el.currentMonth, `${now.y}年目 ${now.m}月`);
    text(el.cashMetric, money(state.cash));
    text(el.fixedCostMetric, money(L.fixedCost(state)));
    text(el.profitMetric, money(state.monthlyProfit));
    text(el.cashInMetric, money(last?.cashIn || 0));
    text(el.utilizationMetric, pct(state.utilization));
    text(el.turnoverMetric, String(state.turnoverRisk));
    text(el.usersKpi, `${state.users}名`);
    text(el.visitsKpi, `${state.visits}件`);
    text(el.staffKpi, `${state.staff}名`);
    text(el.trustKpi, String(state.regionalTrust));
    text(el.teamKpi, String(state.teamCondition));
    text(el.fatigueKpi, String(state.fatigue));
    text(el.careKpi, String(state.careQuality));
    text(el.billingKpi, String(state.billingQuality));
    delta(el.cashMetric, state.cash, prev?.cash, (v) => `${signed(Math.round(v / 10000))}万円`);
    delta(el.profitMetric, state.monthlyProfit, prev?.monthlyProfit, (v) => `${signed(Math.round(v / 10000))}万円`);
    delta(el.utilizationMetric, state.utilization, prev?.utilization, (v) => `${signed(Math.round(v * 100))}pt`, true);
    delta(el.turnoverMetric, state.turnoverRisk, prev?.turnoverRisk, signed, true);
    delta(el.usersKpi, state.users, prev?.usersAfter, signed);
    delta(el.visitsKpi, state.visits, prev?.visits, signed);
    delta(el.staffKpi, state.staff, prev?.staff, signed);
    delta(el.trustKpi, state.regionalTrust, prev?.regionalTrust, signed);
    delta(el.teamKpi, state.teamCondition, prev?.teamCondition, signed);
    delta(el.fatigueKpi, state.fatigue, prev?.fatigue, signed, true);
    delta(el.careKpi, state.careQuality, prev?.careQuality, signed);
    delta(el.billingKpi, state.billingQuality, prev?.billingQuality, signed);
    gauge("cashGauge", state.cash / 100000, 0, 150);
    gauge("profitGauge", state.monthlyProfit / 10000, -100, 200);
    gauge("utilizationGauge", state.utilization * 100, 40, 120);
    gauge("turnoverGauge", state.turnoverRisk, 0, 100);
    const values = { users: state.users, visits: state.visits / 4, staff: state.staff * 6, trust: state.regionalTrust, team: state.teamCondition, fatigue: state.fatigue, care: state.careQuality, billing: state.billingQuality };
    Object.entries(values).forEach(([k, v]) => gauge(`${k}Gauge`, v, 0, 120));
    renderProgress(); annualBox(); summary(); preview(); chart();
  }

  function result(r) {
    el.resultSummary.textContent = "";
    [`売上 ${money(r.revenue)} / 今月入金 ${money(r.cashIn)} / 月間利益 ${money(r.monthlyProfit)} / 現預金 ${money(r.cash)}`, `利用者 ${r.usersAfter}名（新規${r.newUsers}名 / 終了${r.endedUsers}名） / 訪問 ${r.visits}件 / スタッフ ${r.staff}名`, `疲弊度 ${r.fatigue} / チーム継続リスク ${r.turnoverRisk} / ケア品質 ${r.careQuality} / 請求品質 ${r.billingQuality}`].forEach((t) => { const p = document.createElement("p"); p.textContent = t; el.resultSummary.appendChild(p); });
    el.tutorialBox.classList.remove("is-hidden"); text(el.tutorialBox, r.notes[0] || "数字の変化と現場状態をつなげて振り返ります。");
    el.strategyBox.classList.remove("is-hidden"); text(el.strategyBox, `今月の判断傾向: ${strategy(r.decisions)}`);
    el.questionBox.classList.remove("is-hidden"); text(el.questionBox, `今月の問い: ${question(r)}`);
    el.eventCard.classList.remove("is-hidden"); el.eventCard.innerHTML = "<strong>月次イベント</strong><p></p>"; text(el.eventCard.querySelector("p"), r.events[0] || "大きなイベントはありません。");
    el.reasonDetails.classList.remove("is-hidden"); el.reasonList.textContent = "";
    const reasons = [];
    if (r.cashIn === 0) reasons.push("現預金: 売上入金は2か月遅れのため、当月売上はまだ現金化していません。");
    if (r.utilization >= 0.9) reasons.push("稼働率: 訪問件数がスタッフ数に対して高く、疲弊や品質に波及しやすい状態です。");
    if (r.hired) reasons.push("採用: 採用が決まりました。翌月から体制が増えますが、教育負荷も発生します。");
    if (r.addOnAcquired) reasons.push("加算: 品質と請求体制が整い、平均単価が上がりました。");
    reasons.forEach((x) => { const li = document.createElement("li"); li.textContent = x; el.reasonList.appendChild(li); });
    el.eventList.textContent = "";
    r.events.slice(1, 4).forEach((x) => { const li = document.createElement("li"); li.textContent = x; el.eventList.appendChild(li); });
  }

  function strategy(d) {
    if (d.acceptance === "aggressive" || d.sales === "active" || d.management === "utilization") return "短期成長型";
    if (d.teamBuilding !== "normal" || d.fatigueCare !== "none") return "チーム保全型";
    if (d.management === "billing" || d.management === "addOn") return "品質投資型";
    if (d.recruitment !== "none") return "体制拡大型";
    return "バランス調整型";
  }

  function question(r) {
    if (r.cash < 3000000) return "現金を守るために、採用・借入・受け入れのどれを調整しますか？";
    if (r.utilization >= 0.9) return "高稼働を続ける場合、最初に崩れそうな指標はどれですか？";
    if (r.turnoverRisk >= 60) return "スタッフの継続に向け、来月は何を減らし何に投資しますか？";
    if (r.careQuality < 60) return "品質を戻すため、訪問数・教育・請求管理のどこから整えますか？";
    return "今月の判断を一言で表すと、どのような経営スタイルでしたか？";
  }

  function chart() {
    const canvas = el.trendCanvas;
    if (!canvas || !state) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(600, rect.width * dpr);
    canvas.height = 320 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr, h = canvas.height / dpr, p = { l: 58, r: 54, t: 30, b: 42 };
    ctx.clearRect(0, 0, w, h);
    const rows = state.history;
    if (!rows.length) return;
    const moneyVals = rows.flatMap((r) => [r.cash, r.monthlyProfit]);
    const minM = Math.min(-3000000, ...moneyVals), maxM = Math.max(6000000, ...moneyVals);
    const x = (i) => p.l + (rows.length <= 1 ? 0 : i / (rows.length - 1) * (w - p.l - p.r));
    const yM = (v) => p.t + (1 - (v - minM) / (maxM - minM || 1)) * (h - p.t - p.b);
    const yR = (v) => p.t + (1 - v / 120) * (h - p.t - p.b);
    ctx.font = "13px sans-serif"; ctx.lineWidth = 1; ctx.strokeStyle = "#d9e1ea"; ctx.fillStyle = "#64748b";
    [0, 30, 60, 90, 120].forEach((tick) => { const y = yR(tick); ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(w - p.r, y); ctx.stroke(); ctx.fillText(String(tick), w - p.r + 8, y + 4); });
    for (let m = 12; m <= rows.length; m += 12) { const xx = x(m - 1); ctx.strokeStyle = "#e2e8f0"; ctx.beginPath(); ctx.moveTo(xx, p.t); ctx.lineTo(xx, h - p.b); ctx.stroke(); ctx.fillText(`${m / 12}年`, xx - 8, h - 12); }
    const line = (color, getter, mapper) => { ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); rows.forEach((r, i) => { const yy = mapper(getter(r)); if (i) ctx.lineTo(x(i), yy); else ctx.moveTo(x(i), yy); }); ctx.stroke(); };
    line("#0f766e", (r) => r.cash, yM); line("#b45309", (r) => r.monthlyProfit, yM); line("#2563eb", (r) => r.utilization * 100, yR); line("#dc2626", (r) => r.turnoverRisk, yR);
    rows.forEach((r, i) => {
      const marks = [];
      if (r.hired) marks.push(["採用", "#7c3aed"]);
      if (r.addOnAcquired) marks.push(["加算", "#0f766e"]);
      if (r.leaveNoticeIssued) marks.push(["申告", "#f97316"]);
      if (r.turnoverOccurred) marks.push(["離職", "#b91c1c"]);
      marks.forEach(([lab, col], j) => { const xx = x(i), yy = yR(112 - j * 8); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(xx, h - p.b); ctx.lineTo(xx, yy); ctx.stroke(); ctx.beginPath(); ctx.arc(xx, yy, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillText(lab, xx + 5, yy + 4); });
    });
    const last = rows.at(-1); ctx.fillStyle = "#0f766e"; ctx.fillText(`現預金 ${money(last.cash)}`, w - 230, yM(last.cash) - 5); ctx.fillStyle = "#b45309"; ctx.fillText(`利益 ${money(last.monthlyProfit)}`, w - 230, yM(last.monthlyProfit) - 5); ctx.fillStyle = "#2563eb"; ctx.fillText(`稼働 ${pct(last.utilization)}`, w - 230, yR(last.utilization * 100) - 5); ctx.fillStyle = "#dc2626"; ctx.fillText(`継続リスク ${last.turnoverRisk}`, w - 230, yR(last.turnoverRisk) - 5);
  }

  function finalView() {
    const ev = L.evaluateFinal(state);
    el.finalPanel.classList.remove("is-hidden");
    el.advanceButton.disabled = true;
    text(el.finalTitle, playMode === "management60" ? "5年間の経営振り返り" : "年間振り返り");
    el.finalContent.textContent = "";
    const rank = document.createElement("div"); rank.className = "final-rank"; rank.textContent = `${ev.rank}: ${ev.title}`;
    const ul = document.createElement("ul"); ev.comments.forEach((c) => { const li = document.createElement("li"); li.textContent = c; ul.appendChild(li); });
    el.finalContent.append(rank, ul);
  }

  function exportCsv() {
    if (!state?.history.length) return;
    const heads = ["month","cash","revenue","expense","profit","cashIn","users","newUsers","endedUsers","visits","staff","utilization","teamContinuationRisk","teamCondition","fatigue","careQuality","billingQuality","regionalTrust","oncallBurden","referrals","conversionRate","loanCashIn","loanBalance","acceptance","sales","recruitment","teamBuilding","management","fatigueCare","financing","hired","addOn"];
    const rows = state.history.map((r) => [r.month,r.cash,r.revenue,r.totalExpense,r.monthlyProfit,r.cashIn,r.usersAfter,r.newUsers,r.endedUsers,r.visits,r.staff,Math.round(r.utilization*1000)/10,r.turnoverRisk,r.teamCondition,r.fatigue,r.careQuality,r.billingQuality,r.regionalTrust,r.oncallBurden,r.referrals,Math.round(r.conversionRate*1000)/10,r.loanCashIn,r.loanBalance,r.decisionLabels.acceptance,r.decisionLabels.sales,r.decisionLabels.recruitment,r.decisionLabels.teamBuilding,r.decisionLabels.management,r.decisionLabels.fatigueCare,r.decisionLabels.financing,r.hired?"採用":"",r.addOnAcquired?"加算":""]);
    const csv = [heads, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "visit-nursing-management-simulation.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  function start() {
    playMode = el.playModeSelect.value;
    maxMonths = D.playModes[playMode].months;
    state = L.createInitialState(el.scenarioSelect.value, el.difficultySelect.value);
    el.setupPanel.classList.add("is-hidden"); el.gamePanel.classList.remove("is-hidden"); el.finalPanel.classList.add("is-hidden"); el.advanceButton.disabled = false; el.exportCsvButton.disabled = false; render();
  }
  function advance(e) { e.preventDefault(); if (!state || state.month > maxMonths || state.gameOver) return; const out = L.advanceMonth(state, decisions()); state = out.state; render(); result(out.result); if (state.gameOver || state.month > maxMonths) finalView(); }
  function reset() { state = null; el.setupPanel.classList.remove("is-hidden"); el.gamePanel.classList.add("is-hidden"); el.finalPanel.classList.add("is-hidden"); el.exportCsvButton.disabled = true; }

  function init() {
    fill(el.playModeSelect, D.playModes, "training12"); fill(el.scenarioSelect, D.scenarios, "existing"); fill(el.difficultySelect, D.difficulties, "normal");
    fill(el.acceptanceSelect, D.decisions.acceptance, "standard"); fill(el.salesSelect, D.decisions.sales, "moderate"); fill(el.recruitmentSelect, D.decisions.recruitment, "none"); fill(el.teamBuildingSelect, D.decisions.teamBuilding, "normal"); fill(el.managementSelect, D.decisions.management, "billing"); fill(el.fatigueCareSelect, D.decisions.fatigueCare, "none"); fill(el.financingSelect, D.decisions.financing, "none");
    [el.acceptanceSelect, el.salesSelect, el.recruitmentSelect, el.teamBuildingSelect, el.managementSelect, el.fatigueCareSelect, el.financingSelect].forEach((s) => s.addEventListener("change", preview));
    el.startButton.addEventListener("click", start); el.decisionForm.addEventListener("submit", advance); el.resetButton.addEventListener("click", reset); el.exportCsvButton.addEventListener("click", exportCsv);
    el.openGuideButton.addEventListener("click", () => el.guideOverlay.classList.remove("is-hidden")); el.closeGuideButton.addEventListener("click", () => el.guideOverlay.classList.add("is-hidden")); el.guideOverlay.addEventListener("click", (e) => { if (e.target === el.guideOverlay) el.guideOverlay.classList.add("is-hidden"); }); window.addEventListener("resize", chart);
    preview(); reset();
  }
  init();
})();
