import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import Toast from "../components/Toast";
import {
  SOURCE_LABELS,
  formatTime,
  getDateKey,
  formatDateLabel,
} from "../format";
import { renderMarkdown } from "../markdown";
import "../styles/session.css";

interface Session {
  id: number;
  source: string;
  workspace?: string;
  last_at?: number;
  message_count?: number;
}

interface Message {
  id: number;
  role: string;
  content: string;
  timestamp?: number;
}

export default function SessionPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const highlightMessageId = searchParams.get("message_id");

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    api<{
      session?: Session;
      messages?: Message[];
    }>(
      "/api/session?session_id=" + encodeURIComponent(sessionId) + "&order=asc&limit=5000",
    )
      .then((data) => {
        setSession(data.session || null);
        setMessages(data.messages || []);
      })
      .catch(() => {
        setSession(null);
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Scroll to highlighted message
  useEffect(() => {
    if (!highlightMessageId || loading) return;
    setTimeout(() => {
      const target = document.querySelector(
        `.message[data-message-id="${highlightMessageId}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [highlightMessageId, loading]);

  // Handle tool block toggle via delegation
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const header = target.closest(".tool-block-header") as HTMLElement | null;
      if (header) {
        header.classList.toggle("open");
        return;
      }
    },
    [],
  );

  if (!sessionId) {
    return (
      <div className="session-page">
        <div className="container">
          <div className="empty-state">Missing session_id.</div>
        </div>
      </div>
    );
  }

  const label = session ? (SOURCE_LABELS[session.source] || session.source || "?") : "";

  // Group consecutive assistant messages
  const groups: { role: string; items: Message[] }[] = [];
  for (const m of messages) {
    const role = (m.role || "assistant").toLowerCase();
    if (role === "assistant" && groups.length > 0 && groups[groups.length - 1].role === "assistant") {
      groups[groups.length - 1].items.push(m);
    } else {
      groups.push({ role, items: [m] });
    }
  }

  const renderMessages = () => {
    if (loading) {
      return (
        <>
          <div className="skeleton" style={{ height: 48, width: "60%", marginBottom: "0.5rem", borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 48, width: "75%", marginBottom: "0.5rem", borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 48, width: "55%", marginBottom: "0.5rem", borderRadius: 8 }} />
        </>
      );
    }
    if (messages.length === 0) {
      return <div className="empty-state">No messages found.</div>;
    }

    const elements: React.ReactNode[] = [];
    let lastDateKey = "";

    groups.forEach((group, gi) => {
      const firstMsg = group.items[0];
      const dk = getDateKey(firstMsg.timestamp);
      if (dk !== lastDateKey) {
        elements.push(
          <div key={"date-" + dk + gi} className="date-separator">
            {formatDateLabel(firstMsg.timestamp)}
          </div>,
        );
        lastDateKey = dk;
      }

      if (group.role !== "assistant" || group.items.length === 1) {
        const m = firstMsg;
        const role = group.role;
        const roleClass = role === "user" ? "role-user" : role === "assistant" ? "role-assistant" : "role-system";
        const isHighlight = highlightMessageId && String(m.id) === String(highlightMessageId);
        const content = renderMarkdown(m.content || "(empty)");
        elements.push(
          <div
            key={"m-" + m.id}
            className={`message ${roleClass}${isHighlight ? " highlight" : ""}`}
            data-message-id={m.id}
          >
            <div className="message-meta">
              <span className="role">{m.role || "assistant"}</span>
              <span>{formatTime(m.timestamp)}</span>
            </div>
            <div className="msg-section">
              <div className="message-content" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </div>,
        );
      } else {
        // Grouped assistant messages
        const ids = group.items.map((m) => m.id);
        const isHighlight = group.items.some(
          (m) => highlightMessageId && String(m.id) === String(highlightMessageId),
        );
        const firstTs = formatTime(firstMsg.timestamp);
        const lastMsg = group.items[group.items.length - 1];
        const lastTs = formatTime(lastMsg.timestamp);
        const timeLabel = firstTs === lastTs ? firstTs : firstTs + " \u2013 " + lastTs;

        elements.push(
          <div
            key={"ag-" + ids[0]}
            className={`message role-assistant${isHighlight ? " highlight" : ""}`}
            data-message-id={ids.join(",")}
          >
            <div className="message-meta">
              <span className="role">ASSISTANT</span>
              <span>{timeLabel}</span>
              <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                ({group.items.length} parts)
              </span>
            </div>
            {group.items.map((m, idx) => (
              <div key={m.id}>
                {idx > 0 && <hr className="msg-section-divider" />}
                <div className="msg-section">
                  <div
                    className="message-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || "(empty)") }}
                  />
                </div>
              </div>
            ))}
          </div>,
        );
      }
    });
    return elements;
  };

  return (
    <div className="session-page" onClick={handleClick}>
      <div className="container">
        <div className="header">
          <div>
            <div><Link to="/">&larr; Back to sessions</Link></div>
            <div className="title">
              {session ? label + " \u2014 " + (session.workspace || "(default)") : "Session"}
            </div>
            <div className="meta">
              {session &&
                `Session ${session.id} \u00b7 ${formatTime(session.last_at)} \u00b7 ${session.message_count || 0} messages`}
            </div>
          </div>
        </div>
        <div id="messages">{renderMessages()}</div>
      </div>
      <Toast />
    </div>
  );
}
