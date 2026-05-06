(() => {
  "use strict";
  window.SIM_DATA = {
    scenarios: {
      existing: { label: "既存引き継ぎ", users: 35, visits: 280, trust: 60, team: 70, fatigue: 30, risk: 10, billing: 70, care: 70 },
      turnaround: { label: "高稼働疲弊ステーション", users: 42, visits: 336, trust: 55, team: 52, fatigue: 62, risk: 45, billing: 58, care: 60 },
      startup: { label: "新規開設", users: 10, visits: 80, trust: 35, team: 70, fatigue: 30, risk: 10, billing: 70, care: 70 }
    },
    difficulties: {
      easy: { label: "イージー", cash: 15000000 },
      normal: { label: "ノーマル", cash: 10000000 },
      hard: { label: "ハード", cash: 5000000 }
    },
    playModes: {
      training12: { label: "12か月研修モード", months: 12 },
      management60: { label: "60か月経営モード", months: 60 }
    },
    yearThemes: [
      "黒字化と資金繰り理解",
      "採用・稼働・品質の安定化",
      "地域信頼と紹介基盤の形成",
      "管理者依存からチーム運営へ",
      "持続可能な成長モデルの完成"
    ],
    constants: {
      staffInitial: 4,
      staffCost: 500000,
      carCost: 50000,
      rentCost: 400000,
      otherFixedCost: 300000,
      visitsPerUser: 8,
      comfortableVisitsPerStaff: 100,
      averageVisitPrice: 9000,
      maxAverageVisitPrice: 10000,
      addOnPriceStep: 250,
      maxAddOnLevel: 4,
      userExitRate: 0.055,
      scaleAdminCost8: 300000,
      scaleAdminCost12: 500000,
      scaleAdminCost16: 800000
    },
    annualTargets: [
      { year: 1, revenue: 31500000, profit: 0 },
      { year: 2, revenue: 58500000, profit: 9000000 },
      { year: 3, revenue: 90000000, profit: 18000000 },
      { year: 4, revenue: 103500000, profit: 22500000 },
      { year: 5, revenue: 117000000, profit: 31500000 }
    ],
    decisions: {
      acceptance: {
        cautious: { label: "慎重", intake: 0.65, team: 1, care: 1, fatigue: -1 },
        standard: { label: "標準", intake: 0.9 },
        aggressive: { label: "積極", intake: 1.15, fatigue: 2, care: -1, billing: -1 }
      },
      sales: {
        active: { label: "積極的に活動", min: 7, max: 13, trust: 1, cost: 150000 },
        moderate: { label: "中程度に活動", min: 4, max: 8, trust: 0, cost: 70000 },
        maintenance: { label: "維持程度の活動", min: 1, max: 4, trust: -1, cost: 20000 },
        none: { label: "活動をしない", min: 0, max: 1, trust: -2, cost: 0 }
      },
      recruitment: {
        none: { label: "採用しない", monthlyCost: 0, successCost: 0, rate: 0 },
        normal: { label: "通常募集", monthlyCost: 100000, successCost: 0, rate: 0.16 },
        active: { label: "積極採用", monthlyCost: 100000, successCost: 400000, rate: 0.32 },
        agency: { label: "紹介会社", monthlyCost: 0, successCost: 1200000, rate: 0.52 }
      },
      teamBuilding: {
        normal: { label: "通常運営" },
        oneOnOne: { label: "1on1・面談重視", team: 3, risk: -2, care: 1, intake: -0.05 },
        training: { label: "同行訪問・教育重視", team: 2, risk: -1, care: 3, billing: 1, intake: -0.08 },
        meeting: { label: "チーム会議・関係性づくり重視", team: 4, fatigue: -3, risk: -2, intake: -0.06 }
      },
      management: {
        utilization: { label: "稼働率重視", visits: 8, fatigue: 3, team: -1 },
        billing: { label: "書類・請求管理重視", visits: -4, billing: 5 },
        addOn: { label: "加算・制度対応重視", visits: -5, addOn: 1 },
        efficiency: { label: "業務効率化に投資", visits: 4, fatigue: -2, cost: 250000 }
      },
      fatigueCare: {
        none: { label: "実施しない" },
        adminSupport: { label: "事務・記録支援を入れる", cost: 200000, fatigue: -5, billing: 2, risk: -1 },
        visitControl: { label: "訪問調整で休息を確保", cost: 300000, fatigue: -8, team: 2, risk: -3, visits: -10 },
        recoveryMonth: { label: "集中リカバリー月", cost: 500000, fatigue: -13, team: 4, risk: -5, visits: -18 }
      },
      financing: {
        none: { label: "借入しない", amount: 0, payment: 0 },
        borrow300: { label: "300万円借入", amount: 3000000, payment: 100000 },
        borrow500: { label: "500万円借入", amount: 5000000, payment: 160000 }
      }
    }
  };
})();
