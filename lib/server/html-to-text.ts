import "server-only";

const SKIP_TAGS = new Set(["script", "style", "noscript", "svg", "template", "iframe", "nav", "footer", "header", "aside", "form", "head"]);
const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "section", "article", "blockquote", "br"]);

function mainContent(html: string): string {
  const lower = html.toLowerCase();
  for (const tag of ["article", "main"]) {
    const start = lower.indexOf(`<${tag}`);
    const end = lower.lastIndexOf(`</${tag}>`);
    if (start !== -1 && end > start) return html.slice(start, end);
  }
  return html;
}

function tagName(lower: string, pos: number): string {
  let end = pos;
  while (end < lower.length && end - pos < 12 && /[a-z0-9]/.test(lower[end])) end++;
  return lower.slice(pos, end);
}

function stripHtml(html: string): string {
  const lower = html.toLowerCase();
  const out: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out.push(html.slice(i));
      break;
    }
    out.push(html.slice(i, lt));

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }

    const closing = html[lt + 1] === "/";
    const name = tagName(lower, lt + (closing ? 2 : 1));
    const gt = html.indexOf(">", lt);
    if (gt === -1) break;

    if (!closing && SKIP_TAGS.has(name)) {
      const close = lower.indexOf(`</${name}`, gt);
      if (close === -1) break;
      const closeGt = html.indexOf(">", close);
      i = closeGt === -1 ? html.length : closeGt + 1;
      out.push(" ");
      continue;
    }

    out.push(BLOCK_TAGS.has(name) ? "\n" : " ");
    i = gt + 1;
  }
  return out.join("");
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(stripHtml(mainContent(html)))
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
