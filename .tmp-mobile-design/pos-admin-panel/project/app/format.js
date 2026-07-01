/* ============================================================
   ALPHA POS — number, currency & date formatting
   Uzbekistan locale: UZS, space thousands separators,
   abbreviate large values (1 240 000 -> 1.24M). Consistent everywhere.
   ============================================================ */
(function () {
  var NB = "\u202F"; // narrow no-break space for thousands grouping

  function group(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  }

  // Full grouped integer: 10979000 -> "10 979 000"
  function fmtNum(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var neg = n < 0;
    var s = group(Math.round(Math.abs(n)).toString());
    return (neg ? "-" : "") + s;
  }

  // Abbreviated: 1240000 -> "1.24M", 320000 -> "320K", 9800 -> "9.8K"
  function fmtAbbr(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var neg = n < 0; var a = Math.abs(n); var out;
    function trim(x) { return x.toFixed(2).replace(/\.?0+$/, ""); }
    function trim1(x) { return x.toFixed(1).replace(/\.0$/, ""); }
    if (a >= 1e9) out = trim(a / 1e9) + "B";
    else if (a >= 1e6) out = trim(a / 1e6) + "M";
    else if (a >= 1e3) out = trim1(a / 1e3) + "K";
    else out = String(Math.round(a));
    return (neg ? "-" : "") + out;
  }

  // Money — full, with optional UZS unit
  function fmtMoney(n, opts) {
    opts = opts || {};
    var v = fmtNum(n);
    if (v === "—") return v;
    return opts.unit ? v + NB + "UZS" : v;
  }

  // Money — abbreviated KPI display
  function fmtMoneyAbbr(n, opts) {
    opts = opts || {};
    var v = fmtAbbr(n);
    if (v === "—") return v;
    return opts.unit ? v + NB + "UZS" : v;
  }

  // Percent: 12.4 -> "12.4%"
  function fmtPct(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var d = digits === undefined ? 1 : digits;
    return n.toFixed(d).replace(/\.0$/, "") + "%";
  }

  // Signed delta for KPI: 12.4 -> "+12.4%"
  function fmtDelta(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    var s = fmtPct(Math.abs(n), digits);
    return (n > 0 ? "+" : n < 0 ? "−" : "") + s;
  }

  function fmtDate(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    var p = function (v) { return v < 10 ? "0" + v : "" + v; };
    return p(x.getDate()) + "." + p(x.getMonth() + 1) + "." + x.getFullYear();
  }
  function fmtDateTime(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    var p = function (v) { return v < 10 ? "0" + v : "" + v; };
    return fmtDate(x) + ", " + p(x.getHours()) + ":" + p(x.getMinutes());
  }
  function fmtTime(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    var p = function (v) { return v < 10 ? "0" + v : "" + v; };
    return p(x.getHours()) + ":" + p(x.getMinutes());
  }

  window.Fmt = {
    NB: NB,
    num: fmtNum,
    abbr: fmtAbbr,
    money: fmtMoney,
    moneyAbbr: fmtMoneyAbbr,
    pct: fmtPct,
    delta: fmtDelta,
    date: fmtDate,
    dateTime: fmtDateTime,
    time: fmtTime,
  };
})();
