/* ============================================================
   ALPHA POS — dashboard mock data (rich, for 5 dashboards)
   Representative values consistent with the rest of the product.
   ============================================================ */
(function () {
  function genTrend(days, base, vol, growth) {
    const out = []; let v = base;
    for (let i = 0; i < days; i++) {
      v = v * (1 + (Math.sin(i / 3) * vol + (Math.random() - 0.5) * vol)) + growth;
      out.push(Math.max(0, Math.round(v)));
    }
    return out;
  }
  const dayLabels = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(2026, 5, 24 - i); dayLabels.push(d.getDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun"][d.getMonth()]); }

  const revenue30 = genTrend(30, 11000000, 0.06, 180000);
  const orders30 = revenue30.map((r) => Math.round(r / (95000 + Math.random() * 18000)));
  const aov30 = revenue30.map((r, i) => Math.round(r / orders30[i]));
  const expense30 = revenue30.map((r) => Math.round(r * (0.38 + Math.random() * 0.05)));
  const lastMonthRev = genTrend(30, 9800000, 0.06, 120000);

  // hour × weekday heatmap (rows=days, cols=hours 10..23)
  const HM_HOURS = []; for (let h = 10; h <= 23; h++) HM_HOURS.push((h < 10 ? "0" + h : h));
  const HM_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatMatrix = HM_DAYS.map((d, di) => HM_HOURS.map((h, hi) => {
    const peakLunch = Math.exp(-Math.pow(hi - 3, 2) / 4);
    const peakDinner = Math.exp(-Math.pow(hi - 9, 2) / 5) * 1.3;
    const weekend = di >= 4 ? 1.4 : 1;
    return Math.round((peakLunch + peakDinner) * 22 * weekend + Math.random() * 4);
  }));

  // channel split per day (stacked)
  const channelDays = dayLabels.slice(-7).map((lab, i) => ({
    label: lab.split(" ")[0],
    values: { hall: 6500000 + Math.random() * 2500000, delivery: 2800000 + Math.random() * 1500000, pickup: 1400000 + Math.random() * 900000 },
  }));

  const categories = [
    { label: "Pizza", value: 24800000, color: "var(--c1)" },
    { label: "Lavash", value: 18200000, color: "var(--c2)" },
    { label: "Kebab", value: 15600000, color: "var(--c3)" },
    { label: "Hot Dogs", value: 8900000, color: "var(--c4)" },
    { label: "Drinks", value: 6400000, color: "var(--c5)" },
    { label: "Sides", value: 4200000, color: "var(--primary-hover)" },
    { label: "Desserts", value: 2600000, color: "var(--success)" },
  ];

  const productPareto = [
    { label: "Pitsa tovuqli katta", value: 19550000 },
    { label: "Non kabob big", value: 15120000 },
    { label: "Lavash halapino", value: 12240000 },
    { label: "Toster", value: 8960000 },
    { label: "Lester", value: 6400000 },
    { label: "Hot Dog Halapeno", value: 4200000 },
    { label: "Lavash katta", value: 3100000 },
    { label: "Tandir Lavash", value: 1800000 },
  ];

  const productTrends = [
    { name: "Pitsa tovuqli katta", units: 312, revenue: 19550000, delta: 14.2, spark: genTrend(14, 60, 0.1, 1) },
    { name: "Non kabob big", units: 286, revenue: 15120000, delta: 8.4, spark: genTrend(14, 52, 0.12, 0.5) },
    { name: "Lavash halapino", units: 401, revenue: 12240000, delta: -3.1, spark: genTrend(14, 70, 0.1, -0.4) },
    { name: "Toster", units: 332, revenue: 8960000, delta: 5.6, spark: genTrend(14, 55, 0.12, 0.3) },
    { name: "Lester", units: 298, revenue: 6400000, delta: 22.5, spark: genTrend(14, 30, 0.14, 1.6) },
    { name: "Hot Dog Halapeno", units: 190, revenue: 4200000, delta: -8.2, spark: genTrend(14, 40, 0.12, -0.8) },
  ];

  // staff / cashiers
  const staff = [
    { name: "Ruxsora Smart", initials: "R", revenue: 28400000, orders: 268, aov: 105970, speed: 88, accuracy: 96, upsell: 72, attendance: 98, hours: 168 },
    { name: "Umida Smart", initials: "U", revenue: 24100000, orders: 231, aov: 104329, speed: 82, accuracy: 94, upsell: 65, attendance: 95, hours: 160 },
    { name: "Aziz Karimov", initials: "A", revenue: 19800000, orders: 204, aov: 97058, speed: 91, accuracy: 89, upsell: 58, attendance: 92, hours: 152 },
    { name: "Dilnoza Saidova", initials: "D", revenue: 17600000, orders: 188, aov: 93617, speed: 79, accuracy: 97, upsell: 80, attendance: 99, hours: 165 },
    { name: "Bek Toshev", initials: "B", revenue: 12300000, orders: 142, aov: 86620, speed: 74, accuracy: 85, upsell: 49, attendance: 88, hours: 138 },
  ];

  const funnelData = [
    { label: "Orders placed", value: 2555, color: "var(--c1)" },
    { label: "Accepted by kitchen", value: 2488, color: "var(--c4)" },
    { label: "Prepared", value: 2471, color: "var(--primary)" },
    { label: "Served / delivered", value: 2455, color: "var(--c2)" },
    { label: "Paid & closed", value: 2412, color: "var(--success)" },
  ];

  // table occupancy grid (hall) — status: free/seated/reserved/cleaning
  const tableGrid = [];
  const statuses = ["seated", "seated", "free", "seated", "reserved", "free", "seated", "cleaning", "seated", "free", "seated", "seated", "reserved", "free", "seated", "seated"];
  for (let i = 0; i < 16; i++) tableGrid.push({ n: i + 1, status: statuses[i], guests: statuses[i] === "seated" ? 2 + (i % 4) : 0, mins: statuses[i] === "seated" ? 12 + (i * 7) % 70 : 0 });

  // live order feed seed
  const liveFeed = [
    { id: 2562, type: "HALL", info: "Table 4", total: 84000, ts: Date.now() - 8000, status: "PREPARING" },
    { id: 2561, type: "DELIVERY", info: "Yunusobod", total: 132000, ts: Date.now() - 42000, status: "PREPARING" },
    { id: 2560, type: "PICKUP", info: "—", total: 56000, ts: Date.now() - 95000, status: "READY" },
    { id: 2559, type: "HALL", info: "Table 9", total: 218000, ts: Date.now() - 140000, status: "COMPLETED" },
    { id: 2558, type: "HALL", info: "Table 2", total: 47000, ts: Date.now() - 190000, status: "COMPLETED" },
  ];

  window.DASH = {
    dayLabels: dayLabels,
    affinity: (function () {
      var prods = [
        { name: "Pitsa tovuqli katta", color: "var(--c1)", orders: 142, price: 85000 },
        { name: "Non kabob big", color: "var(--c2)", orders: 121, price: 56000 },
        { name: "Lavash halapino", color: "var(--c3)", orders: 168, price: 36000 },
        { name: "Coca-Cola 0.5", color: "#E0394B", orders: 204, price: 8000 },
        { name: "Ayran", color: "#7FB539", orders: 96, price: 6000 },
        { name: "Toster", color: "var(--c4)", orders: 88, price: 28000 },
        { name: "Mercimek Çorbası", color: "#C49A2E", orders: 74, price: 18000 },
        { name: "Fırın Sütlaç", color: "#8E5BC7", orders: 61, price: 15000 },
        { name: "Izgara Kanat", color: "#3FB6A8", orders: 83, price: 42000 },
        { name: "Adana Dürüm", color: "#E07A3C", orders: 70, price: 38000 },
      ];
      // co-occurrence pairs (index a < index b), count = times bought together
      var pairs = [
        [0, 3, 38], [0, 4, 22], [0, 5, 14], [2, 3, 44], [2, 4, 19], [2, 9, 16],
        [1, 3, 27], [1, 8, 21], [3, 4, 31], [3, 6, 12], [3, 7, 18], [3, 9, 24],
        [2, 6, 15], [0, 7, 11], [8, 3, 20], [5, 3, 17], [6, 7, 9], [2, 5, 13],
        [4, 9, 8], [1, 6, 10],
      ].map(function (p) { return { a: p[0], b: p[1], count: p[2] }; });
      return { products: prods, pairs: pairs, totalOrders: 1240 };
    })(),
    prepByCategory: [
      { label: "Hot Dogs", mins: 5.2, target: 8, orders: 190 },
      { label: "Drinks", mins: 1.4, target: 4, orders: 612 },
      { label: "Lavash", mins: 7.8, target: 9, orders: 401 },
      { label: "Kebab", mins: 9.1, target: 9, orders: 286 },
      { label: "Sides", mins: 6.3, target: 7, orders: 224 },
      { label: "Pizza", mins: 13.6, target: 12, orders: 312 },
      { label: "Desserts", mins: 4.1, target: 6, orders: 98 },
    ],
    revenue30: revenue30, orders30: orders30, aov30: aov30, expense30: expense30, lastMonthRev: lastMonthRev,
    HM_HOURS: HM_HOURS, HM_DAYS: HM_DAYS, heatMatrix: heatMatrix,
    channelDays: channelDays,
    categories: categories,
    productPareto: productPareto, productTrends: productTrends,
    staff: staff,
    funnelData: funnelData,
    tableGrid: tableGrid,
    liveFeed: liveFeed,
    // headline figures
    monthRevenue: revenue30.reduce((a, b) => a + b, 0),
    monthTarget: Math.round(revenue30.reduce((a, b) => a + b, 0) * 1.16),
    monthOrders: orders30.reduce((a, b) => a + b, 0),
    avgAov: Math.round(aov30.reduce((a, b) => a + b, 0) / aov30.length),
    grossMargin: 61.5,
    repeatRate: 38.4,
  };
})();
