(() => {
  "use strict";
  const D = window.SIM_DATA;
  const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(v)));
  const pick = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
  const label = (group, key) => D.decisions[group][key]?.label || key;

  function createInitialState(scenarioKey, difficultyKey) {
    const s = D.scenarios[scenarioKey];
    const d = D.difficulties[difficultyKey];
    const c = D.constants;
    return {
      month: 1,
      scenarioKey,
      difficultyKey,
      cash: d.cash,
      users: s.users,
      visits: s.visits,
      staff: c.staffInitial,
      activeStaff: c.staffInitial,
      averageVisitPrice: c.averageVisitPrice,
      addOnLevel: 0,
      teamCondition: s.team,
      fatigue: s.fatigue,
      turnoverRisk: s.risk,
      regionalTrust: s.trust,
      billingQuality: s.billing,
      careQuality: s.care,
      monthlyRevenue: 0,
      monthlyProfit: 0,
      cumulativeProfit: 0,
      utilization: s.visits / (c.staffInitial * c.comfortableVisitsPerStaff),
      oncallBurden: 20 + s.users * 0.8,
      receivablesQueue: [0, 0],
      pendingHires: 0,
      pendingLeaves: [],
      highUtilizationStreak: 0,
      highOncallStreak: 0,
      loanBalance: 0,
      monthlyDebtPayment: 0,
      gameOver: false,
      gameOverReason: "",
      history: []
    };
  }

  function fixedCost(state) {
    const c = D.constants;
    let scale = 0;
    if (state.staff >= 16) scale = c.scaleAdminCost16;
    else if (state.staff >= 12) scale = c.scaleAdminCost12;
    else if (state.staff >= 8) scale = c.scaleAdminCost8;
    return state.staff * c.staffCost + state.staff * c.carCost + c.rentCost + c.otherFixedCost + scale;
  }

  function buildResult(state, decisions) {
    return {
      month: state.month,
      decisions,
      decisionLabels: Object.fromEntries(Object.keys(decisions).map((k) => [k, label(k, decisions[k])])),
      events: [],
      notes: [],
      reasons: [],
      cashIn: 0,
      loanCashIn: 0,
      debtPayment: 0,
      loanBalance: state.loanBalance,
      recruitmentCost: 0,
      fatigueCareCost: 0,
      managementCost: 0,
      salesCost: 0,
      newUsers: 0,
      endedUsers: 0,
      referrals: 0,
      conversionRate: 0,
      hired: false,
      hireQueued: false,
      addOnAcquired: false,
      leaveNoticeIssued: false,
      turnoverOccurred: false
    };
  }

  function applyPendingStaff(state, result) {
    if (state.pendingHires > 0) {
      state.staff += state.pendingHires;
      result.events.push(`${state.pendingHires}名の採用者が今月から稼働に加わりました。`);
      state.pendingHires = 0;
    }
    state.pendingLeaves = state.pendingLeaves.map((x) => ({ ...x, monthsLeft: x.monthsLeft - 1 }));
    const due = state.pendingLeaves.filter((x) => x.monthsLeft <= 0).length;
    if (due > 0) {
      state.staff -= due;
      result.turnoverOccurred = true;
      result.events.push(`${due}名が退職・休職に入り、提供体制が縮小しました。`);
      state.teamCondition -= 8 * due;
      state.fatigue += 8 * due;
      state.regionalTrust -= 4 * due;
    }
    state.pendingLeaves = state.pendingLeaves.filter((x) => x.monthsLeft > 0);
  }

  function advanceMonth(inputState, decisions) {
    const state = structuredClone(inputState);
    const c = D.constants;
    const result = buildResult(state, decisions);
    applyPendingStaff(state, result);

    const a = D.decisions.acceptance[decisions.acceptance];
    const sales = D.decisions.sales[decisions.sales];
    const rec = D.decisions.recruitment[decisions.recruitment];
    const team = D.decisions.teamBuilding[decisions.teamBuilding];
    const mgmt = D.decisions.management[decisions.management];
    const carePlan = D.decisions.fatigueCare[decisions.fatigueCare];
    const finance = D.decisions.financing[decisions.financing];

    result.salesCost = sales.cost || 0;
    result.recruitmentCost = rec.monthlyCost || 0;
    result.managementCost = mgmt.cost || 0;
    result.fatigueCareCost = carePlan.cost || 0;

    if (finance.amount > 0) {
      state.cash += finance.amount;
      state.loanBalance += finance.amount;
      state.monthlyDebtPayment += finance.payment;
      result.loanCashIn = finance.amount;
      result.events.push(`${Math.round(finance.amount / 10000)}万円を借入し、当面の資金余力を確保しました。`);
    }

    state.teamCondition += team.team || 0;
    state.fatigue += team.fatigue || 0;
    state.turnoverRisk += team.risk || 0;
    state.careQuality += team.care || 0;
    state.billingQuality += team.billing || 0;
    state.fatigue += mgmt.fatigue || 0;
    state.teamCondition += mgmt.team || 0;
    state.billingQuality += mgmt.billing || 0;
    state.fatigue += carePlan.fatigue || 0;
    state.teamCondition += carePlan.team || 0;
    state.turnoverRisk += carePlan.risk || 0;
    state.billingQuality += carePlan.billing || 0;
    state.regionalTrust += sales.trust || 0;
    if (decisions.acceptance === "cautious") state.regionalTrust -= 1;

    if (mgmt.addOn && state.addOnLevel < c.maxAddOnLevel) {
      const canAcquire = state.careQuality >= 65 && state.billingQuality >= 65;
      if (canAcquire && Math.random() < 0.72) {
        state.addOnLevel += 1;
        state.averageVisitPrice = Math.min(c.maxAverageVisitPrice, c.averageVisitPrice + state.addOnLevel * c.addOnPriceStep);
        result.addOnAcquired = true;
        result.events.push("加算・制度対応が進み、平均訪問単価が上がりました。");
      } else {
        result.events.push("加算対応に取り組みましたが、品質・請求体制の整備がまだ必要です。");
      }
    }

    const capacity = state.staff * c.comfortableVisitsPerStaff;
    const currentUtil = capacity ? state.visits / capacity : 9;
    const hardCapacityUsers = Math.floor((capacity * 1.2) / c.visitsPerUser);
    const referrals = pick(sales.min, sales.max) + Math.floor(Math.max(0, state.regionalTrust - 50) / 18);
    const conversionBase = (a.intake || 1) + (team.intake || 0);
    const conversionNoise = 0.82 + Math.random() * 0.32;
    const conversion = Math.max(0.15, Math.min(1.05, conversionBase * conversionNoise));
    const ended = Math.max(0, Math.round(state.users * (c.userExitRate + (Math.random() - 0.5) * 0.025)));
    let newUsers = Math.round(referrals * conversion);
    if (currentUtil >= 1.2) newUsers = 0;
    if (state.users - ended + newUsers > hardCapacityUsers) newUsers = Math.max(0, hardCapacityUsers - (state.users - ended));
    state.users = Math.max(0, state.users - ended + newUsers);
    result.referrals = referrals;
    result.conversionRate = conversion;
    result.newUsers = newUsers;
    result.endedUsers = ended;

    let visits = state.users * c.visitsPerUser + (mgmt.visits || 0) + (carePlan.visits || 0);
    visits = Math.max(0, Math.min(visits, Math.floor(capacity * 1.2)));
    state.visits = Math.round(visits);
    state.utilization = capacity ? state.visits / capacity : 9;
    state.oncallBurden = Math.min(110, 20 + state.users * 0.8);

    const revenue = Math.round(state.visits * state.averageVisitPrice);
    const cashIn = state.receivablesQueue.shift() || 0;
    state.receivablesQueue.push(revenue);
    result.cashIn = cashIn;
    result.revenue = revenue;

    if (rec.rate > 0) {
      let rate = rec.rate + (state.regionalTrust >= 80 ? 0.04 : 0) + (state.teamCondition >= 80 ? 0.04 : 0);
      if (state.regionalTrust < 45) rate -= 0.05;
      if (state.teamCondition < 45) rate -= 0.05;
      rate += (Math.random() - 0.5) * 0.12;
      if (Math.random() < Math.max(0.02, Math.min(0.75, rate))) {
        state.pendingHires += 1;
        result.hired = true;
        result.hireQueued = true;
        result.recruitmentCost += rec.successCost || 0;
        state.teamCondition -= 2;
        state.fatigue += 3;
        result.events.push("採用が決まりました。翌月からスタッフが増えますが、教育負荷も発生します。");
      }
    }

    if (state.utilization >= 0.9) state.highUtilizationStreak += 1;
    else state.highUtilizationStreak = 0;
    if (state.oncallBurden >= 90) state.highOncallStreak += 1;
    else state.highOncallStreak = 0;

    if (state.utilization < 0.7) { state.fatigue -= 2; state.turnoverRisk -= 1; state.teamCondition += 1; }
    else if (state.utilization < 0.85) {}
    else if (state.utilization < 0.9) { state.fatigue += 2; state.turnoverRisk += 2; }
    else if (state.utilization < 1.0) { state.fatigue += 5; state.turnoverRisk += 5; state.teamCondition -= 2; state.careQuality -= 2; state.billingQuality -= 1; }
    else { state.fatigue += 10; state.turnoverRisk += 9; state.teamCondition -= 5; state.careQuality -= 6; state.billingQuality -= 4; }
    if (state.highUtilizationStreak >= 3) { state.fatigue += 3; state.turnoverRisk += 3; state.careQuality -= 2; }
    if (state.oncallBurden >= 90) { state.fatigue += 4; state.turnoverRisk += 4; state.teamCondition -= 1; }
    if (state.highOncallStreak >= 3) { state.fatigue += 2; state.turnoverRisk += 2; result.events.push("オンコール負担が慢性化しています。"); }

    if (state.teamCondition >= 70) state.careQuality += 1;
    if (state.fatigue >= 70) { state.careQuality -= 4; state.billingQuality -= 3; state.turnoverRisk += 4; }
    if (state.billingQuality < 60) state.careQuality -= 2;
    if (state.staff >= 8) { state.teamCondition -= 1; state.billingQuality -= 1; }
    if (state.staff >= 12) { state.teamCondition -= 1; state.careQuality -= 1; }
    if (state.regionalTrust >= 90 && (state.careQuality < 80 || state.billingQuality < 80)) state.regionalTrust -= 1;
    if (state.careQuality >= 80 && state.billingQuality >= 75 && decisions.sales !== "none") state.regionalTrust += 1;
    if (state.careQuality < 55) state.regionalTrust -= 4;

    if (Math.random() < Math.max(0.01, state.turnoverRisk / 420)) {
      state.pendingLeaves.push({ monthsLeft: 2 });
      result.leaveNoticeIssued = true;
      state.turnoverRisk += 4;
      result.events.push("スタッフから退職・休職予定の相談がありました。2か月後に体制が変わる見込みです。");
    }

    const debtPayment = Math.min(state.loanBalance, state.monthlyDebtPayment || 0);
    state.loanBalance -= debtPayment;
    if (state.loanBalance <= 0) state.monthlyDebtPayment = 0;
    result.debtPayment = debtPayment;
    result.loanBalance = state.loanBalance;

    const expense = fixedCost(state) + result.salesCost + result.recruitmentCost + result.managementCost + result.fatigueCareCost + debtPayment;
    const profit = revenue - expense;
    state.cash = state.cash + cashIn - expense;
    state.monthlyRevenue = revenue;
    state.monthlyProfit = profit;
    state.cumulativeProfit += profit;

    state.teamCondition = clamp(state.teamCondition);
    state.fatigue = clamp(state.fatigue);
    state.turnoverRisk = clamp(state.turnoverRisk);
    state.regionalTrust = clamp(state.regionalTrust);
    state.billingQuality = clamp(state.billingQuality);
    state.careQuality = clamp(state.careQuality);

    if (state.cash < 0) { state.gameOver = true; state.gameOverReason = "現預金が0円を下回りました。"; }
    if (state.staff < 3) { state.gameOver = true; state.gameOverReason = "看護師が3名未満となり、指定基準を満たせません。"; }

    if (state.utilization >= 0.9) result.events.push("稼働率が高く、疲弊・品質低下に注意が必要です。");
    if (state.cash < 3000000) result.events.push("資金繰り警告。入金と支出のタイミングを確認してください。");
    if (state.careQuality < 55) result.events.push("ケア品質の低下が地域信頼に影響し始めています。");
    if (state.gameOver) result.events.push(state.gameOverReason);
    result.notes.push(`今月入金は${Math.round(cashIn / 10000).toLocaleString("ja-JP")}万円。売上は2か月後に現金化されます。`);

    Object.assign(result, {
      cash: state.cash,
      revenue,
      totalExpense: expense,
      monthlyProfit: profit,
      cumulativeProfit: state.cumulativeProfit,
      usersAfter: state.users,
      visits: state.visits,
      staff: state.staff,
      utilization: state.utilization,
      fatigue: state.fatigue,
      turnoverRisk: state.turnoverRisk,
      teamCondition: state.teamCondition,
      regionalTrust: state.regionalTrust,
      careQuality: state.careQuality,
      billingQuality: state.billingQuality,
      oncallBurden: state.oncallBurden,
      averageVisitPrice: state.averageVisitPrice,
      fixedCost: fixedCost(state),
      addOnLevel: state.addOnLevel,
      gameOver: state.gameOver
    });
    state.history.push(result);
    state.month += 1;
    return { state, result };
  }

  function evaluateFinal(state) {
    const last = state.history.at(-1) || state;
    let score = 0;
    if (last.cash > 5000000) score += 20;
    if (last.monthlyProfit > 0) score += 20;
    if (last.utilization >= 0.75 && last.utilization <= 0.92) score += 15;
    if (last.turnoverRisk < 45) score += 15;
    if (last.careQuality >= 70) score += 10;
    if (last.billingQuality >= 70) score += 10;
    if (last.regionalTrust >= 70) score += 10;
    if (state.gameOver) score = 0;
    const rank = score >= 90 ? "S" : score >= 75 ? "A" : score >= 60 ? "B" : score >= 45 ? "C" : score >= 30 ? "D" : "E";
    const titles = { S: "安定成長ステーション", A: "黒字化達成", B: "改善余地あり", C: "資金繰り注意", D: "経営危機", E: "継続条件の再設計が必要" };
    return {
      rank,
      title: titles[rank],
      comments: [
        state.gameOver ? state.gameOverReason : "1年間または5年間の経営判断を完走しました。",
        `最終現預金 ${Math.round(last.cash / 10000).toLocaleString("ja-JP")}万円、月間利益 ${Math.round(last.monthlyProfit / 10000).toLocaleString("ja-JP")}万円。`,
        `稼働率 ${Math.round(last.utilization * 100)}%、チーム継続リスク ${last.turnoverRisk}、ケア品質 ${last.careQuality}。`
      ]
    };
  }

  window.SimLogic = { createInitialState, advanceMonth, evaluateFinal, fixedCost };
})();
