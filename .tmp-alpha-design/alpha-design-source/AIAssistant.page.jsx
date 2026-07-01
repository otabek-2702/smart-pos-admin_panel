/* ============================================================
   ALPHA POS — AI Assistant page
   Conversation history (left) · message thread + composer (right)
   Generation runs in the AIProvider, so it continues across nav.
   ============================================================ */
const { useState, useEffect, useRef } = React;

/* ---- tiny, safe markdown-lite (bold, bullets, numbered, paragraphs) ---- */
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function mdInline(s) { return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>"); }
function Markdown(props) {
  const lines = (props.text || "").split("\n");
  const blocks = [];
  let list = null, listType = null;
  const flush = () => { if (list) { blocks.push({ t: listType, items: list }); list = null; listType = null; } };
  lines.forEach((ln) => {
    const bullet = ln.match(/^\s*-\s+(.*)$/);
    const num = ln.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet) { if (listType !== "ul") { flush(); list = []; listType = "ul"; } list.push(bullet[1]); }
    else if (num) { if (listType !== "ol") { flush(); list = []; listType = "ol"; } list.push(num[1]); }
    else { flush(); if (ln.trim()) blocks.push({ t: "p", text: ln }); }
  });
  flush();
  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.t === "p") return <p key={i} dangerouslySetInnerHTML={{ __html: mdInline(b.text) }} />;
        const Tag = b.t === "ul" ? "ul" : "ol";
        return <Tag key={i}>{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: mdInline(it) }} />)}</Tag>;
      })}
    </div>
  );
}

function relTime(ts) {
  const d = Date.now() - ts, m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 24) return h + "h ago";
  const days = Math.round(h / 24); if (days < 7) return days + "d ago";
  return Fmt.date(ts);
}

const SUGGESTIONS = [
  { icon: "wallet", text: "How were sales today?" },
  { icon: "star", text: "What are my top products?" },
  { icon: "coins", text: "Break down today's payments" },
  { icon: "box", text: "What's running low on stock?" },
];

function TypingDots() {
  return <span className="typing"><span></span><span></span><span></span></span>;
}

function ChatMessage(props) {
  const m = props.message;
  const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return (
      <div className="msg msg--user">
        <div className="msg__bubble">{m.content}</div>
      </div>
    );
  }
  const empty = m.streaming && !m.content;
  return (
    <div className="msg msg--ai">
      <div className="msg__avatar"><Icon name="sparkle" size={17} /></div>
      <div className="msg__col">
        <div className="msg__bubble">
          {empty ? <TypingDots /> : <Markdown text={m.content} />}
          {m.streaming && m.content ? <span className="caret" /> : null}
        </div>
        {!m.streaming && (
          <div className="msg__tools">
            <button className="msg__tool" onClick={() => { try { navigator.clipboard.writeText(m.content); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
              <Icon name={copied ? "check" : "copy"} size={14} />{copied ? "Copied" : "Copy"}
            </button>
            {props.onRetry && <button className="msg__tool" onClick={props.onRetry}><Icon name="retry" size={14} />Regenerate</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function NotifyToggle() {
  const ai = useAI();
  const blocked = ai.permission === "denied";
  const on = ai.notify && ai.permission === "granted";
  return (
    <button className={cx("notifbtn", on && "is-on", blocked && "is-blocked")} onClick={ai.toggleNotify}
      title={blocked ? "Notifications blocked in browser settings" : on ? "Background notifications on" : "Notify me when replies finish off-page"}>
      <Icon name={on ? "bell" : "belloff"} size={16} />
      <span>{blocked ? "Blocked" : on ? "Notifications on" : "Notify me"}</span>
    </button>
  );
}

function ChatHistoryItem(props) {
  const c = props.chat;
  const last = c.messages[c.messages.length - 1];
  const preview = last ? (last.role === "assistant" ? last.content.replace(/[*#\-]/g, "") : last.content) : "Empty conversation";
  const [menu, setMenu] = useState(false);
  return (
    <div className={cx("histitem", props.active && "is-active")} onClick={props.onClick}>
      <div className="histitem__icon"><Icon name="inbox" size={15} /></div>
      <div className="histitem__main">
        <div className="histitem__title">{c.title}</div>
        <div className="histitem__preview">{preview.slice(0, 48)}</div>
      </div>
      <div className="histitem__meta">
        <span className="histitem__time">{relTime(c.updatedAt)}</span>
        {props.generating && <span className="histitem__live"><TypingDots /></span>}
      </div>
      <button className="histitem__del" onClick={(e) => { e.stopPropagation(); props.onDelete(); }} title="Delete chat"><Icon name="trash" size={15} /></button>
    </div>
  );
}

function AIChatPage(props) {
  const ai = useAI();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const active = ai.chats.find((c) => c.id === ai.activeId) || null;
  const messages = active ? active.messages : [];
  const isGenerating = ai.generating === ai.activeId;

  // tell the store the chat is on-screen (so it won't notify while watching)
  useEffect(() => { ai.setChatVisible(true); return () => ai.setChatVisible(false); }, []);
  useEffect(() => {
    const h = () => ai.setChatVisible(!document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  // autoscroll on new content
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, active && messages.length ? messages[messages.length - 1].content : "", ai.activeId]);

  // autosize textarea
  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [draft]);

  const submit = () => {
    const t = draft.trim(); if (!t || isGenerating) return;
    ai.send(t); setDraft("");
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };

  const filtered = ai.chats.slice().sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) => !query || c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="aiwrap">
      {/* history sidebar */}
      <aside className="aihist">
        <div className="aihist__top">
          <Button variant="primary" icon="plus" onClick={ai.newChat} style={{ width: "100%" }}>New chat</Button>
        </div>
        <div className="aihist__search">
          <Input icon="search" placeholder="Search chats…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="aihist__list">
          <div className="aihist__label">Recent</div>
          {filtered.length === 0 ? <div className="aihist__empty">No chats found</div> : filtered.map((c) => (
            <ChatHistoryItem key={c.id} chat={c} active={c.id === ai.activeId} generating={ai.generating === c.id}
              onClick={() => ai.selectChat(c.id)} onDelete={() => ai.deleteChat(c.id)} />
          ))}
        </div>
      </aside>

      {/* thread */}
      <section className="aithread">
        <div className="aithread__head">
          <div className="row" style={{ gap: 10, minWidth: 0 }}>
            <div className="msg__avatar" style={{ flex: "0 0 34px", width: 34, height: 34 }}><Icon name="sparkle" size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active ? active.title : "AI Assistant"}</div>
              <div className="tertiary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                {isGenerating ? "Thinking…" : "POS analyst · always-on"}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <NotifyToggle />
          </div>
        </div>

        <div className="aithread__scroll" ref={scrollRef}>
          <div className="aithread__inner">
            {(!active || messages.length === 0) ? (
              <div className="aiempty">
                <div className="aiempty__badge"><Icon name="sparkle" size={26} /></div>
                <h2 className="aiempty__title">How can I help with your POS today?</h2>
                <p className="aiempty__sub">Ask about sales, products, payments, shifts or stock. I read from your live data.</p>
                <div className="aiempty__chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.text} className="promptchip" onClick={() => ai.send(s.text)}>
                      <Icon name={s.icon} size={16} /><span>{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((m, i) => (
              <ChatMessage key={m.id} message={m}
                onRetry={m.role === "assistant" && i === messages.length - 1 && !isGenerating
                  ? () => { const prevUser = messages[i - 1]; if (prevUser) ai.send(prevUser.content); } : null} />
            ))}
          </div>
        </div>

        {/* composer */}
        <div className="composer">
          <div className="composer__inner">
            <div className="composer__box">
              <textarea ref={taRef} className="composer__ta" rows={1} placeholder="Message the assistant…  (Enter to send, Shift+Enter for a new line)"
                value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
              {isGenerating
                ? <button className="composer__send is-stop" onClick={ai.stop} title="Stop generating"><Icon name="stop" size={16} /></button>
                : <button className={cx("composer__send", draft.trim() && "is-ready")} onClick={submit} disabled={!draft.trim()} title="Send"><Icon name="send" size={17} /></button>}
            </div>
            <div className="composer__hint">
              {isGenerating
                ? <span className="row" style={{ gap: 6, color: "var(--primary)" }}><TypingDots /> Generating — you can leave this page, I'll keep working.</span>
                : <span>Alpha POS assistant · responses are illustrative in this prototype</span>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { AIChatPage });
