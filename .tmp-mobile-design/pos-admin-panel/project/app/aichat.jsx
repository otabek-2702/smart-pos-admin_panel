/* ============================================================
   ALPHA POS — AI Assistant store (lives ABOVE the router)
   Generation keeps running when you navigate to other pages,
   and fires a browser notification on completion (toggleable).
   ============================================================ */
const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

const AICtx = createContext(null);
function useAI() { return useContext(AICtx); }

const AI_STORE_KEY = "alphapos-ai-chats-v1";
const AI_NOTIFY_KEY = "alphapos-ai-notify-v1";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function nowTs() { return Date.now(); }

/* ---- Canned analyst responses (reference the real mock data) ---- */
function generateReply(text) {
  const t = (text || "").toLowerCase();
  const D = window.DB || {};
  const money = (n) => (window.Fmt ? Fmt.money(n) : String(n));
  if (/\b(hi|hello|hey|salom|assalom)\b/.test(t))
    return "Hello! I'm your Alpha POS assistant. I can summarise today's trading, break down payments, flag low stock, or dig into any shift. What would you like to look at?";
  if (/(revenue|sales|today|turnover|how much)/.test(t))
    return "**Today's trading (13.06.2026)**\n\n- Revenue: **" + money(14230000) + " UZS**, up **12.4%** vs last week\n- Orders: **142** · avg order **" + money(100211) + " UZS**\n- Peak hour: **19:00** with 23 orders\n\nRevenue is tracking above your daily target of " + money(13500000) + " UZS. Want the hour-by-hour breakdown?";
  if (/(top|best|popular).*(product|item|dish|seller)|what.*sell/.test(t))
    return "**Top products today by revenue**\n\n1. Pitsa tovuqli katta — " + money(1955000) + " (23 units)\n2. Non kabob big — " + money(1512000) + " (27 units)\n3. Lavash halapino — " + money(1224000) + " (34 units)\n4. Toster — " + money(896000) + " (32 units)\n\nPitsa tovuqli katta is your clear revenue leader. Lavash halapino moves the most units.";
  if (/(payment|cash|card|uzcard|humo|payme|mix)/.test(t))
    return "**Payment mix today**\n\n- Cash — " + money(5536000) + " (35%)\n- Uzcard — " + money(4120000) + " (26%)\n- Humo — " + money(2980000) + " (19%)\n- Payme — " + money(1740000) + " (11%)\n- Mixed — " + money(610000) + " (4%)\n\nCash and Uzcard together cover **61%** of collected revenue.";
  if (/(shift|handover|cashier|reconcil|drawer)/.test(t))
    return "**Active shift #51 — Test TEst**\n\n- Running 11h 58m · 142 receipts\n- Revenue " + money(14990000) + " · cash " + money(5536000) + " · card " + money(8844000) + "\n- Expected in drawer: **" + money(5296000) + " UZS**\n\nWhen the shift ends, you'll receive this cash on the Shifts page and record any over/short variance.";
  if (/(stock|inventory|reorder|low|out of)/.test(t))
    return "**Low stock — needs reorder**\n\n- Mozzarella — 2 kg (reorder at 10)\n- Chicken fillet — 5 kg (reorder at 20)\n- Lavash bread — 8 pcs (reorder at 50)\n- Coca-Cola 0.5 — 11 pcs (reorder at 60)\n\nMozzarella is critical — at current pace it runs out before the dinner peak. Want me to draft a purchase order?";
  if (/(order|cancel|refund|unpaid|preparing)/.test(t))
    return "**Orders right now**\n\n- 5 open · 2 ready · 5 preparing\n- 3 cancelled today (" + money(307000) + " value)\n- 86% of orders are paid (122 of 142)\n\nTwo hall orders (#58, #59) are still unpaid and preparing. Want to see the full list?";
  return "Here's what I can help with around your POS data:\n\n- **Sales & revenue** — today's numbers, trends, targets\n- **Products** — top sellers by revenue or units\n- **Payments** — cash vs card breakdown\n- **Shifts** — reconciliation and cash handover\n- **Stock** — low-stock and reorder alerts\n\nAsk me anything, e.g. *\"how were sales today?\"* or *\"which shift had the highest variance?\"*";
}

const STARTER_CHATS = [
  {
    id: "seed1", title: "Daily revenue summary",
    messages: [
      { id: "m1", role: "user", content: "How were sales today?", ts: nowTs() - 1000 * 60 * 60 * 3 },
      { id: "m2", role: "assistant", content: generateReply("revenue today"), ts: nowTs() - 1000 * 60 * 60 * 3 + 4000 },
    ],
    updatedAt: nowTs() - 1000 * 60 * 60 * 3,
  },
  {
    id: "seed2", title: "Low stock check",
    messages: [
      { id: "m3", role: "user", content: "What's running low on stock?", ts: nowTs() - 1000 * 60 * 60 * 26 },
      { id: "m4", role: "assistant", content: generateReply("low stock"), ts: nowTs() - 1000 * 60 * 60 * 26 + 3500 },
    ],
    updatedAt: nowTs() - 1000 * 60 * 60 * 26,
  },
];

function loadChats() {
  try {
    const raw = localStorage.getItem(AI_STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.length) {
        // sanitize: no generation survives a reload, so clear stale streaming flags
        // and drop any empty assistant placeholders left mid-flight.
        return p.map((c) => Object.assign({}, c, {
          messages: (c.messages || [])
            .filter((m) => !(m.role === "assistant" && m.streaming && !m.content))
            .map((m) => m.streaming ? Object.assign({}, m, { streaming: false }) : m),
        }));
      }
    }
  } catch (e) {}
  return STARTER_CHATS;
}

function AIProvider(props) {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => { const c = loadChats(); return c[0] ? c[0].id : null; });
  const [notify, setNotify] = useState(() => { try { return localStorage.getItem(AI_NOTIFY_KEY) === "1"; } catch (e) { return false; } });
  const [permission, setPermission] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const [generating, setGenerating] = useState(null); // convoId currently generating, or null
  const chatVisibleRef = useRef(false);   // is the AI page mounted & this app focused
  const stopRef = useRef(false);
  const toast = (window.__aiToast || (() => {}));

  // persist
  useEffect(() => { try { localStorage.setItem(AI_STORE_KEY, JSON.stringify(chats.slice(0, 40))); } catch (e) {} }, [chats]);
  useEffect(() => { try { localStorage.setItem(AI_NOTIFY_KEY, notify ? "1" : "0"); } catch (e) {} }, [notify]);

  const setChatVisible = useCallback((v) => { chatVisibleRef.current = v; }, []);

  const fireNotification = useCallback((chatId, title, body) => {
    const onPage = chatVisibleRef.current && (typeof document === "undefined" || !document.hidden);
    if (onPage) return; // user is looking at the chat — no need
    if (notify && permission === "granted" && typeof Notification !== "undefined") {
      try {
        const n = new Notification("Alpha POS · " + title, { body: body, tag: "ai-" + chatId });
        n.onclick = () => { try { window.focus(); } catch (e) {} window.dispatchEvent(new CustomEvent("ai-open-chat", { detail: chatId })); n.close(); };
        return;
      } catch (e) {}
    }
    // fallback: in-app toast so the signal isn't lost
    if (window.__aiToast) window.__aiToast({ tone: "info", title: "AI reply ready", msg: title });
  }, [notify, permission]);

  const requestPermission = useCallback(() => {
    if (typeof Notification === "undefined") { setPermission("unsupported"); return Promise.resolve("unsupported"); }
    if (Notification.permission === "granted") { setPermission("granted"); return Promise.resolve("granted"); }
    return Notification.requestPermission().then((p) => { setPermission(p); return p; });
  }, []);

  const toggleNotify = useCallback(() => {
    setNotify((on) => {
      const next = !on;
      if (next) requestPermission();
      return next;
    });
  }, [requestPermission]);

  const newChat = useCallback(() => {
    const c = { id: uid(), title: "New chat", messages: [], updatedAt: nowTs() };
    setChats((cs) => [c].concat(cs));
    setActiveId(c.id);
    return c.id;
  }, []);

  const selectChat = useCallback((id) => setActiveId(id), []);
  const deleteChat = useCallback((id) => {
    setChats((cs) => {
      const next = cs.filter((c) => c.id !== id);
      setActiveId((cur) => (cur === id ? (next[0] ? next[0].id : null) : cur));
      return next;
    });
  }, []);
  const renameChat = useCallback((id, title) => setChats((cs) => cs.map((c) => c.id === id ? Object.assign({}, c, { title }) : c)), []);

  const stop = useCallback(() => { stopRef.current = true; }, []);

  const send = useCallback((rawText) => {
    const text = (rawText || "").trim();
    if (!text || generating) return;
    let convoId = activeId;

    setChats((cs) => {
      let list = cs.slice();
      let idx = list.findIndex((c) => c.id === convoId);
      if (idx === -1) {
        const c = { id: uid(), title: "New chat", messages: [], updatedAt: nowTs() };
        convoId = c.id; list = [c].concat(list); idx = 0;
      }
      const convo = Object.assign({}, list[idx]);
      const userMsg = { id: uid(), role: "user", content: text, ts: nowTs() };
      const aMsg = { id: uid(), role: "assistant", content: "", ts: nowTs(), streaming: true };
      convo.messages = convo.messages.concat([userMsg, aMsg]);
      if (convo.title === "New chat" || !convo.messages.some((m) => m.role === "user" && m.id !== userMsg.id))
        convo.title = text.length > 42 ? text.slice(0, 42) + "…" : text;
      convo.updatedAt = nowTs();
      convo._streamMsgId = aMsg.id;
      list[idx] = convo;
      // begin streaming after state commit
      setTimeout(() => streamReply(convoId, aMsg.id, text), 420);
      return list;
    });
    setActiveId(convoId);
    setGenerating(convoId);
  }, [activeId, generating]);

  // word-by-word streaming via setTimeout (keeps running across route changes)
  const streamReply = useCallback((convoId, msgId, userText) => {
    const full = generateReply(userText);
    const words = full.split(/(\s+)/); // keep whitespace tokens
    let i = 0;
    stopRef.current = false;
    const step = () => {
      if (stopRef.current) {
        finalize(convoId, msgId, false);
        return;
      }
      i += 1;
      const partial = words.slice(0, i).join("");
      setChats((cs) => cs.map((c) => c.id !== convoId ? c : Object.assign({}, c, {
        messages: c.messages.map((m) => m.id === msgId ? Object.assign({}, m, { content: partial }) : m),
      })));
      if (i < words.length) {
        const tok = words[i] || "";
        const delay = /\n/.test(tok) ? 90 : 16 + Math.random() * 34;
        setTimeout(step, delay);
      } else {
        finalize(convoId, msgId, true);
      }
    };
    step();
  }, []);

  const finalize = useCallback((convoId, msgId, complete) => {
    setChats((cs) => cs.map((c) => c.id !== convoId ? c : Object.assign({}, c, {
      updatedAt: nowTs(),
      messages: c.messages.map((m) => m.id === msgId ? Object.assign({}, m, { streaming: false }) : m),
    })));
    setGenerating(null);
    if (complete) {
      // notify if user isn't watching this chat
      let title = "AI reply ready", body = "";
      setChats((cs) => {
        const c = cs.find((x) => x.id === convoId);
        if (c) { title = c.title; const a = c.messages.find((m) => m.id === msgId); body = a ? a.content.replace(/[*#]/g, "").slice(0, 90) : ""; }
        return cs;
      });
      setTimeout(() => fireNotification(convoId, title, body), 0);
    }
  }, [fireNotification]);

  // external "open chat" (from notification click)
  useEffect(() => {
    const h = (e) => { if (e.detail) { setActiveId(e.detail); window.dispatchEvent(new CustomEvent("ai-goto-page")); } };
    window.addEventListener("ai-open-chat", h);
    return () => window.removeEventListener("ai-open-chat", h);
  }, []);

  const value = {
    chats, activeId, generating, notify, permission,
    newChat, selectChat, deleteChat, renameChat, send, stop,
    toggleNotify, requestPermission, setChatVisible,
  };
  return <AICtx.Provider value={value}>{props.children}</AICtx.Provider>;
}

Object.assign(window, { AIProvider, useAI, aiGenerateReply: generateReply });
