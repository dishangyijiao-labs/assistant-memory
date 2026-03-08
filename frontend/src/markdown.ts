import { escapeHtml } from "./format";

export function renderMarkdown(raw: string): string {
  if (!raw) return "<p>(empty)</p>";
  let s = raw;
  const blocks: string[] = [];

  // Extract tool_call / tool_result blocks
  s = s.replace(
    /\[tool_(call|result)\]\s*([^\n]*(?:\n(?!\[tool_)(?!\n\n)[^\n]*)*)/g,
    (_match, type: string, rest: string) => {
      const fullType = "tool_" + type;
      rest = (rest || "").trim();
      let firstLine = rest;
      let bodyText = "";
      const nlIdx = rest.indexOf("\n");
      if (nlIdx !== -1) {
        firstLine = rest.slice(0, nlIdx).trim();
        bodyText = rest.slice(nlIdx + 1).trim();
      }
      if (fullType === "tool_call") {
        const spaceIdx = firstLine.indexOf(" ");
        const toolName = spaceIdx > 0 ? firstLine.slice(0, spaceIdx) : firstLine;
        const toolArgs = spaceIdx > 0 ? firstLine.slice(spaceIdx + 1) : "";
        const combinedBody = toolArgs
          ? toolArgs + (bodyText ? "\n" + bodyText : "")
          : bodyText;
        const idx = blocks.length;
        blocks.push(renderToolBlock(fullType, toolName, combinedBody));
        return "%%BLOCK" + idx + "%%";
      } else {
        const preview = firstLine || "(empty)";
        const fullBody = rest;
        const idx = blocks.length;
        blocks.push(
          renderToolBlock(
            fullType,
            preview,
            fullBody.length > 80 ? fullBody : "",
          ),
        );
        return "%%BLOCK" + idx + "%%";
      }
    },
  );

  // Extract code blocks
  s = s.replace(/```(\w*?)\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
    const idx = blocks.length;
    const langLabel = lang || "code";
    blocks.push(
      '<div class="code-wrap"><div class="code-head"><span class="code-lang">' +
        escapeHtml(langLabel) +
        '</span><button type="button" class="code-copy" title="Copy code"><svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 10.5H3a1.5 1.5 0 01-1.5-1.5V3A1.5 1.5 0 013 1.5h6A1.5 1.5 0 0110.5 3v.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></button></div><pre><code>' +
        escapeHtml(code.replace(/\n$/, "")) +
        "</code></pre></div>",
    );
    return "%%BLOCK" + idx + "%%";
  });

  s = escapeHtml(s);
  for (let i = 0; i < blocks.length; i++) {
    s = s.replace("%%BLOCK" + i + "%%", blocks[i]);
  }
  s = s.replace(/`([^`]+?)`/g, "<code>$1</code>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?:^|\n)#{3}\s+(.+)/g, "<h3>$1</h3>");
  s = s.replace(/(?:^|\n)#{2}\s+(.+)/g, "<h2>$1</h2>");
  s = s.replace(/(?:^|\n)#{1}\s+(.+)/g, "<h1>$1</h1>");
  s = s.replace(/(?:^|\n)&gt;\s?(.+)/g, "<blockquote>$1</blockquote>");
  s = s.replace(/(?:^|\n)[-*]\s+(.+)/g, "<li>$1</li>");
  s = s.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
  s = s.replace(/<\/ul>\s*<ul>/g, "");
  s = s.replace(/(?:^|\n)(\d+)\.\s+(.+)/g, "<li>$2</li>");
  s = s.replace(/\n{2,}/g, "</p><p>");
  s = s.replace(/\n/g, "<br/>");
  if (!s.startsWith("<")) s = "<p>" + s + "</p>";
  return s;
}

function renderToolBlock(type: string, header: string, body: string): string {
  const label = type === "tool_call" ? "Tool Call" : "Tool Result";
  const summary = escapeHtml(
    header.length > 80 ? header.slice(0, 80) + "\u2026" : header,
  );
  const bodyHtml = escapeHtml(body || "");
  const hasBody = body && body.trim().length > 0;
  return (
    '<div class="tool-block">' +
    '<div class="tool-block-header open">' +
    '<span class="tool-label">' +
    label +
    "</span> " +
    summary +
    "</div>" +
    (hasBody ? '<div class="tool-block-body">' + bodyHtml + "</div>" : "") +
    "</div>"
  );
}

export function highlightSearchTerms(html: string, query: string): string {
  if (!query || !query.trim()) return html;
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (!terms.length) return html;
  const regex = new RegExp(
    "(" +
      terms
        .map((t) => t.replace(/[.*+?${}()|[\]\\]/g, "\\$&"))
        .join("|") +
      ")",
    "gi",
  );
  return html.replace(/>([^<]+)</g, (_match, text: string) => {
    return ">" + text.replace(regex, "<mark>$1</mark>") + "<";
  });
}
