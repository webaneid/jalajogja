// Render body surat: Tiptap JSON → HTML, atau plain text → escaped HTML
// Dipakai di halaman detail surat dan template PDF (server-side)
//
// PENTING: implementasi ini pure string manipulation — tidak pakai @tiptap/core
// atau prosemirror-model agar tidak ada dependency pada window/document (server-safe).

type TiptapNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
};

type TiptapMark = {
  type: string;
  attrs?: Record<string, string | null>;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyMark(text: string, mark: TiptapMark): string {
  switch (mark.type) {
    case "bold":      return `<strong>${text}</strong>`;
    case "italic":    return `<em>${text}</em>`;
    case "underline": return `<u>${text}</u>`;
    case "strike":    return `<s>${text}</s>`;
    case "code":      return `<code>${text}</code>`;
    case "link": {
      const href = escapeHtml(mark.attrs?.href ?? "");
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    case "textStyle": {
      const color = mark.attrs?.color;
      return color ? `<span style="color:${color}">${text}</span>` : text;
    }
    case "highlight": {
      const color = mark.attrs?.color;
      return color
        ? `<mark style="background-color:${color}">${text}</mark>`
        : `<mark>${text}</mark>`;
    }
    default: return text;
  }
}

function renderChildren(node: TiptapNode): string {
  if (!node.content?.length) return "";
  return node.content.map(renderNode).join("");
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case "doc":
      return renderChildren(node);

    case "paragraph": {
      const align = node.attrs?.textAlign as string | null;
      const style = align ? ` style="text-align:${align}"` : "";
      const inner = renderChildren(node);
      return `<p${style}>${inner || "<br>"}</p>`;
    }

    case "heading": {
      const level = node.attrs?.level ?? 2;
      const align = node.attrs?.textAlign as string | null;
      const style = align ? ` style="text-align:${align}"` : "";
      return `<h${level}${style}>${renderChildren(node)}</h${level}>`;
    }

    case "text": {
      let text = escapeHtml(node.text ?? "");
      for (const mark of node.marks ?? []) {
        text = applyMark(text, mark);
      }
      return text;
    }

    case "bulletList":
      return `<ul style="padding-left:1.5em;margin:0.5em 0">${renderChildren(node)}</ul>`;

    case "orderedList":
      return `<ol style="padding-left:1.5em;margin:0.5em 0">${renderChildren(node)}</ol>`;

    case "listItem":
      return `<li>${renderChildren(node)}</li>`;

    case "blockquote":
      return `<blockquote style="border-left:3px solid #ddd;padding-left:1em;margin:0.5em 0;color:#666">${renderChildren(node)}</blockquote>`;

    case "codeBlock":
      return `<pre style="background:#f5f5f5;padding:1em;border-radius:4px;overflow-x:auto"><code>${renderChildren(node)}</code></pre>`;

    case "horizontalRule":
      return `<hr style="border:none;border-top:1px solid #ddd;margin:1em 0">`;

    case "hardBreak":
      return `<br>`;

    case "image": {
      const src = escapeHtml(node.attrs?.src as string ?? "");
      const alt = escapeHtml(node.attrs?.alt as string ?? "");
      return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto">`;
    }

    case "table":
      return `<table style="width:100%;border-collapse:collapse;margin:0.5em 0">${renderChildren(node)}</table>`;

    case "tableRow":
      return `<tr>${renderChildren(node)}</tr>`;

    case "tableHeader":
      return `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left">${renderChildren(node)}</th>`;

    case "tableCell":
      return `<td style="border:1px solid #ddd;padding:8px">${renderChildren(node)}</td>`;

    case "embedBlock": {
      const html = node.attrs?.html as string | null;
      if (html) return `<div style="margin:1em 0">${html}</div>`;
      const url = escapeHtml(node.attrs?.url as string ?? "");
      return `<a href="${url}" target="_blank">${url}</a>`;
    }

    default:
      return renderChildren(node);
  }
}

export function renderBody(body: string | null | undefined): string {
  if (!body) return "";
  try {
    const json = JSON.parse(body) as TiptapNode;
    if (json?.type !== "doc") {
      return escapeHtml(body).replace(/\n/g, "<br>");
    }
    return renderNode(json);
  } catch {
    return escapeHtml(body ?? "").replace(/\n/g, "<br>");
  }
}
