/* ============================================================
   ALPHA POS — mock data (drawn from the live panel screenshots).
   Where the real screen was mid-shift/empty, representative values
   are used so the data-viz can be evaluated. Labels/metrics/actions
   are unchanged from the original product.
   ============================================================ */
(function () {
  // ---- Revenue trend: last 14 days (revenue vs expenses, with target) ----
  var trendDays = [
    ["May 31", 9.8, 5.1], ["Jun 1", 11.2, 5.4], ["Jun 2", 10.1, 4.9],
    ["Jun 3", 12.6, 6.0], ["Jun 4", 13.1, 5.8], ["Jun 5", 11.9, 5.5],
    ["Jun 6", 15.2, 6.7], ["Jun 7", 16.4, 7.1], ["Jun 8", 12.8, 5.9],
    ["Jun 9", 13.6, 6.2], ["Jun 10", 14.1, 6.0], ["Jun 11", 13.2, 5.7],
    ["Jun 12", 15.8, 6.9], ["Jun 13", 14.23, 6.1]
  ];
  var revenueTrend = trendDays.map(function (d) {
    return { label: d[0], revenue: Math.round(d[1] * 1e6), expense: Math.round(d[2] * 1e6) };
  });

  // ---- Orders by hour (peak 19:00) ----
  var hours = [11,12,13,14,15,16,17,18,19,20,21,22];
  var hourCounts = [4, 9, 14, 11, 7, 6, 12, 18, 23, 16, 9, 5];
  var ordersByHour = hours.map(function (h, i) {
    return { hour: h, label: (h < 10 ? "0" + h : h) + ":00", orders: hourCounts[i], peak: h === 19 };
  });

  // ---- Payment mix (<=5 segments, consistent categorical colors) ----
  var paymentMix = [
    { label: "Cash",   value: 5536000, color: "var(--c2)" },
    { label: "Uzcard", value: 4120000, color: "var(--c1)" },
    { label: "Humo",   value: 2980000, color: "var(--c4)" },
    { label: "Payme",  value: 1740000, color: "var(--c3)" },
    { label: "Mixed",  value:  610000, color: "var(--c5)" }
  ];

  // ---- Top products today (horizontal bars) ----
  var topProductsToday = [
    { name: "Pitsa tovuqli katta", value: 1955000, units: 23 },
    { name: "Non kabob big",       value: 1512000, units: 27 },
    { name: "Lavash halapino",     value: 1224000, units: 34 },
    { name: "Toster",              value:  896000, units: 32 },
    { name: "Lester",              value:  640000, units: 32 }
  ];

  // ---- Dashboard recent orders ----
  var recentOrders = [
    { id: 59, type: "HALL", status: "PREPARING", payment: "UNPAID", total: 18000,  items: 1, at: "2026-06-13T19:37:00" },
    { id: 58, type: "HALL", status: "PREPARING", payment: "UNPAID", total: 113000, items: 2, at: "2026-06-13T19:35:00" },
    { id: 57, type: "HALL", status: "READY",     payment: "PAID",   total: 36000,  items: 1, at: "2026-06-13T19:35:00" },
    { id: 56, type: "DELIVERY", status: "COMPLETED", payment: "PAID", total: 76000, items: 2, at: "2026-06-13T19:34:00" },
    { id: 55, type: "HALL", status: "COMPLETED", payment: "PAID",   total: 56000,  items: 1, at: "2026-06-13T17:25:00" }
  ];

  var clockedIn = [
    { name: "Aziz Karimov", initials: "A", since: "2026-06-12T17:19:00" },
    { name: "Test TEst",    initials: "T", since: "2026-06-12T19:34:00" }
  ];

  var lowStock = [
    { name: "Lavash bread", level: 8,  unit: "pcs", reorder: 50 },
    { name: "Mozzarella",   level: 2,  unit: "kg",  reorder: 10 },
    { name: "Chicken fillet", level: 5, unit: "kg", reorder: 20 },
    { name: "Coca-Cola 0.5", level: 11, unit: "pcs", reorder: 60 }
  ];

  // ---- Dashboard KPI cards (labels unchanged from product) ----
  var dashboardKpis = [
    { key: "revenue",  label: "Today's Revenue", value: 14230000, money: true, delta: 12.4, icon: "wallet" },
    { key: "orders",   label: "Orders Today",    value: 142, delta: 8.1, icon: "receipt" },
    { key: "aov",      label: "Avg Order Value", value: 100211, money: true, delta: 3.9, icon: "trend" },
    { key: "lowstock", label: "Low Stock Items", value: 200, delta: null, tone: "warning", icon: "box" }
  ];
  var dashboardSubKpis = [
    { key: "open",     label: "Open Orders", value: 5,  tone: "info" },
    { key: "cancel",   label: "Cancelled",   value: 3,  tone: "error" },
    { key: "paid",     label: "Paid",        value: "86%", sub: "122 / 142", tone: "success" },
    { key: "clocked",  label: "Clocked In",  value: 2,  tone: "primary" }
  ];

  // ============================================================
  //  ANALYTICS — Shift Handover Report (shift #51)
  // ============================================================
  var shift = {
    id: 51,
    cashier: "Test TEst",
    initials: "T",
    status: "ACTIVE",
    start: "2026-06-13T11:02:00",
    durationLabel: "11h 58m",
    receipts: 142,
    kpis: {
      revenue: 14990000, revenuePerHour: 1252000,
      cash: 5536000, card: 8844000, aov: 105563
    },
    paymentMix: paymentMix,
    ordersByHour: ordersByHour,
    breakdown: {
      completed: 131, cancelled: 4, cancelledPct: 2.8, paid: 122,
      hall: 96, delivery: 31, pickup: 15,
      itemsLines: 318, itemsUnits: 486, discounts: 240000, discountOrders: 11
    },
    speed: {
      avgPrep: "8m 20s", ordersPerHour: 11.9, scheduledStart: "11:00",
      actualStart: "2026-06-13T11:02:00", late: "2m late",
      checkIn: "2026-06-13T11:02:00", checkOut: null,
      work: "11.96h", overtime: "0.00h"
    },
    topProducts: topProductsToday,
    productDetail: [
      { name: "Pitsa tovuqli katta", units: 23, orders: 21, revenue: 1955000 },
      { name: "Non kabob big",       units: 27, orders: 24, revenue: 1512000 },
      { name: "Lavash halapino",     units: 34, orders: 31, revenue: 1224000 },
      { name: "Toster",              units: 32, orders: 30, revenue:  896000 },
      { name: "Lester",              units: 32, orders: 28, revenue:  640000 },
      { name: "Hot Dog Halapeno",    units: 19, orders: 18, revenue:  342000 }
    ],
    receiptsList: [
      { id: 156, status: "COMPLETED", type: "HALL",     payment: "PAID",   lines: 2, units: 2, discount: 0 },
      { id: 155, status: "COMPLETED", type: "DELIVERY", payment: "PAID",   lines: 1, units: 1, discount: 5000 },
      { id: 154, status: "PREPARING", type: "HALL",     payment: "UNPAID", lines: 2, units: 3, discount: 0 },
      { id: 153, status: "COMPLETED", type: "PICKUP",   payment: "PAID",   lines: 1, units: 1, discount: 0 },
      { id: 152, status: "CANCELLED", type: "HALL",     payment: "UNPAID", lines: 3, units: 4, discount: 0 }
    ],
    topProduct: "Pitsa tovuqli katta"
  };

  // ============================================================
  //  ORDERS — table page
  // ============================================================
  var orders = [
    { id: 59, type: "HALL", info: "Hall 4", status: "PREPARING", payment: "UNPAID", total: 18000,  items: 1, at: "2026-06-13T19:37:44",
      lines: [ { name: "Hot Dog Halapeno", qty: 1, price: 18000 } ] },
    { id: 58, type: "HALL", info: "Hall 2", status: "PREPARING", payment: "UNPAID", total: 113000, items: 2, at: "2026-06-13T19:35:47",
      lines: [ { name: "Pitsa tovuqli katta", qty: 1, price: 85000 }, { name: "Toster", qty: 1, price: 28000 } ] },
    { id: 57, type: "HALL", info: "Hall 7", status: "READY", payment: "UNPAID", total: 36000,  items: 1, at: "2026-06-13T19:35:43",
      lines: [ { name: "Lavash halapino", qty: 1, price: 36000 } ] },
    { id: 56, type: "DELIVERY", info: "—", status: "READY", payment: "PAID", total: 76000,  items: 2, at: "2026-06-13T19:35:39",
      lines: [ { name: "Non kabob big", qty: 1, price: 56000 }, { name: "Lester", qty: 1, price: 20000 } ] },
    { id: 55, type: "HALL", info: "Hall 1", status: "COMPLETED", payment: "PAID", total: 56000,  items: 1, at: "2026-06-13T17:25:51",
      lines: [ { name: "Non kabob big", qty: 1, price: 56000 } ] },
    { id: 54, type: "HALL", info: "Hall 9", status: "CANCELLED", payment: "UNPAID", total: 307000, items: 4, at: "2026-06-13T17:03:38",
      lines: [ { name: "Pitsa tovuqli katta", qty: 2, price: 85000 }, { name: "Lavash sirli", qty: 2, price: 68500 } ] },
    { id: 53, type: "PICKUP", info: "—", status: "CANCELLED", payment: "PAID", total: 290000, items: 5, at: "2026-06-13T17:03:38",
      lines: [ { name: "Non kabob big", qty: 3, price: 56000 }, { name: "Toster", qty: 2, price: 61000 } ] },
    { id: 52, type: "HALL", info: "Hall 3", status: "COMPLETED", payment: "PAID", total: 788000, items: 7, at: "2026-06-13T17:03:38",
      lines: [ { name: "Pitsa tovuqli katta", qty: 5, price: 85000 }, { name: "Lavash halapino", qty: 2, price: 181500 } ] },
    { id: 51, type: "DELIVERY", info: "—", status: "COMPLETED", payment: "PAID", total: 145000, items: 3, at: "2026-06-13T16:48:12",
      lines: [ { name: "Lavash katta", qty: 2, price: 72000 }, { name: "Lester", qty: 1, price: 1000 } ] },
    { id: 50, type: "HALL", info: "Hall 5", status: "COMPLETED", payment: "PAID", total: 62000, items: 2, at: "2026-06-13T16:31:09",
      lines: [ { name: "Toster", qty: 1, price: 28000 }, { name: "Hot Dog karalevskiy", qty: 1, price: 34000 } ] },
    { id: 49, type: "HALL", info: "Hall 8", status: "COMPLETED", payment: "PAID", total: 240000, items: 4, at: "2026-06-13T16:12:55",
      lines: [ { name: "Non kabob standart", qty: 4, price: 60000 } ] },
    { id: 48, type: "PICKUP", info: "—", status: "COMPLETED", payment: "PAID", total: 38000, items: 1, at: "2026-06-13T15:58:20",
      lines: [ { name: "Tandir Lavash", qty: 1, price: 38000 } ] }
  ];
  var ordersKpis = [
    { key: "total",     label: "Total",     value: 31, icon: "receipt", tone: "neutral" },
    { key: "preparing", label: "Preparing", value: 5,  icon: "clock",   tone: "warning" },
    { key: "ready",     label: "Ready",     value: 2,  icon: "check",   tone: "success" },
    { key: "revenue",   label: "Revenue",   value: 10979000, money: true, icon: "wallet", tone: "primary" }
  ];

  // ============================================================
  //  USERS — table + form
  // ============================================================
  var users = [
    { id: 356, first: "Dilnoza", last: "Saidova", email: "cashier3@pos.local", role: "CASHIER", status: "ACTIVE" },
    { id: 355, first: "Bek", last: "Toshev", email: "cashier2@pos.local", role: "CASHIER", status: "ACTIVE" },
    { id: 354, first: "Aziz", last: "Karimov", email: "cashier1@pos.local", role: "CASHIER", status: "ACTIVE" },
    { id: 340, first: "Sage", last: "Jackson", email: "sage.jackson338@fake.local", role: "USER", status: "ACTIVE" },
    { id: 331, first: "Harper", last: "King", email: "harper.king329@fake.local", role: "USER", status: "ACTIVE" },
    { id: 320, first: "Avery", last: "Wilson", email: "avery.wilson318@fake.local", role: "USER", status: "ACTIVE" },
    { id: 319, first: "Nico", last: "Clark", email: "nico.clark317@fake.local", role: "USER", status: "INACTIVE" },
    { id: 318, first: "Nico", last: "Johnson", email: "nico.johnson316@fake.local", role: "MANAGER", status: "ACTIVE" },
    { id: 317, first: "Morgan", last: "Lee", email: "morgan.lee315@fake.local", role: "USER", status: "ACTIVE" },
    { id: 316, first: "Lane", last: "Scott", email: "lane.scott314@fake.local", role: "USER", status: "INACTIVE" },
    { id: 315, first: "Reese", last: "Lewis", email: "reese.lewis313@fake.local", role: "MANAGER", status: "ACTIVE" },
    { id: 314, first: "Jordan", last: "Diaz", email: "jordan.diaz312@fake.local", role: "USER", status: "ACTIVE" }
  ];
  var usersKpis = [
    { key: "total",  label: "Total",        value: 224, icon: "users",  tone: "primary" },
    { key: "active", label: "Active",       value: 10,  icon: "userok", tone: "success" },
    { key: "depts",  label: "Departments",  value: 8,   icon: "dept",   tone: "info" },
    { key: "salary", label: "Total Salary", value: 248400000, money: true, icon: "wallet", tone: "neutral" }
  ];

  // ============================================================
  //  SHIFTS — daily cash handover / reconciliation
  //  status: ACTIVE (running) · COMPLETED (ended, awaiting cash) · reconciled flag
  // ============================================================
  var cashiers = ["Test TEst", "Aziz Karimov", "Dilnoza Saidova", "Bek Toshev", "Sage Jackson"];
  var shiftsList = [
    { id: 51, cashier: "Test TEst", initials: "T", template: "No template",
      status: "ACTIVE", live: true, start: "2026-06-13T11:02:00", end: null, durationLabel: "11h 58m",
      orders: 142, gross: 14990000, net: 14750000, cash: 5536000, card: 8844000,
      expenses: 240000, cancelled: 4, cancelledAmount: 307000, expectedCash: 5296000,
      reported: null, variance: null, reconciled: false, reportedBy: null,
      avgTicket: 105563, items: 486, avgPrep: "8m 20s", peak: "19:00" },
    { id: 50, cashier: "Bek Toshev", initials: "B", template: "No template",
      status: "COMPLETED", live: false, start: "2026-06-13T09:00:00", end: "2026-06-13T17:03:00", durationLabel: "8h 03m",
      orders: 38, gross: 2420000, net: 2380000, cash: 1341000, card: 1079000,
      expenses: 40000, cancelled: 1, cancelledAmount: 56000, expectedCash: 1301000,
      reported: null, variance: null, reconciled: false, reportedBy: null,
      avgTicket: 63684, items: 92, avgPrep: "7m 10s", peak: "13:00" },
    { id: 49, cashier: "Aziz Karimov", initials: "A", template: "No template",
      status: "COMPLETED", live: false, start: "2026-06-13T08:45:00", end: "2026-06-13T17:03:00", durationLabel: "8h 18m",
      orders: 51, gross: 3615000, net: 3580000, cash: 2128000, card: 1487000,
      expenses: 35000, cancelled: 0, cancelledAmount: 0, expectedCash: 2093000,
      reported: null, variance: null, reconciled: false, reportedBy: null,
      avgTicket: 70882, items: 121, avgPrep: "6m 40s", peak: "12:00" },
    { id: 48, cashier: "Dilnoza Saidova", initials: "D", template: "No template",
      status: "COMPLETED", live: false, start: "2026-06-12T09:10:00", end: "2026-06-12T17:03:00", durationLabel: "7h 53m",
      orders: 64, gross: 4888000, net: 4760000, cash: 2711000, card: 2177000,
      expenses: 128000, cancelled: 2, cancelledAmount: 90000, expectedCash: 2583000,
      reported: 2575000, variance: -8000, reconciled: true, reportedBy: "Reese Lewis",
      avgTicket: 76375, items: 158, avgPrep: "8m 02s", peak: "19:00" },
    { id: 47, cashier: "Sage Jackson", initials: "S", template: "No template",
      status: "COMPLETED", live: false, start: "2026-06-12T08:50:00", end: "2026-06-12T16:40:00", durationLabel: "7h 50m",
      orders: 47, gross: 2980000, net: 2945000, cash: 1620000, card: 1360000,
      expenses: 35000, cancelled: 1, cancelledAmount: 42000, expectedCash: 1585000,
      reported: 1597000, variance: 12000, reconciled: true, reportedBy: "Reese Lewis",
      avgTicket: 63404, items: 110, avgPrep: "7m 30s", peak: "18:00" }
  ];

  window.DB = {
    brand: "Alpha POS",
    revenueTrend: revenueTrend,
    revenueTarget: 13500000,
    ordersByHour: ordersByHour,
    paymentMix: paymentMix,
    topProductsToday: topProductsToday,
    recentOrders: recentOrders,
    clockedIn: clockedIn,
    lowStock: lowStock,
    dashboardKpis: dashboardKpis,
    dashboardSubKpis: dashboardSubKpis,
    shift: shift,
    orders: orders,
    ordersKpis: ordersKpis,
    users: users,
    usersKpis: usersKpis,
    cashiers: cashiers,
    shiftsList: shiftsList,
    roles: ["CASHIER", "USER", "MANAGER", "ADMIN"],
    statuses: ["ACTIVE", "INACTIVE"]
  };
})();
