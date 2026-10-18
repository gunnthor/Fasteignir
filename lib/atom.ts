// Minimal Atom 1.0 (RFC 4287) writer. Pure; every text value is escaped.
export const escapeXml = (s: string) =>
  s
    // Characters not allowed in XML 1.0 documents.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export type AtomEntry = {
  id: string;
  title: string;
  // RFC 3339 timestamps.
  updated: string;
  published?: string;
  link: string;
  summary: string;
  // HTML fragment; written as escaped text with type="html".
  html: string;
  categories?: string[];
};
export type AtomFeed = {
  id: string;
  title: string;
  subtitle: string;
  updated: string;
  self: string;
  alternate: string;
  author: string;
  rights: string;
  entries: AtomEntry[];
};

export function atom(f: AtomFeed) {
  const e = escapeXml,
    lines = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="is">',
      `<id>${e(f.id)}</id>`,
      `<title>${e(f.title)}</title>`,
      `<subtitle>${e(f.subtitle)}</subtitle>`,
      `<updated>${e(f.updated)}</updated>`,
      `<link rel="self" type="application/atom+xml" href="${e(f.self)}"/>`,
      `<link rel="alternate" type="text/html" href="${e(f.alternate)}"/>`,
      `<author><name>${e(f.author)}</name></author>`,
      `<rights>${e(f.rights)}</rights>`,
      '<generator uri="https://fasteign.gunnthor.is">Fasteign</generator>',
    ];
  for (const x of f.entries)
    lines.push(
      "<entry>",
      `<id>${e(x.id)}</id>`,
      `<title>${e(x.title)}</title>`,
      `<updated>${e(x.updated)}</updated>`,
      ...(x.published ? [`<published>${e(x.published)}</published>`] : []),
      `<link rel="alternate" type="text/html" href="${e(x.link)}"/>`,
      ...(x.categories ?? []).map((c) => `<category term="${e(c)}"/>`),
      `<summary>${e(x.summary)}</summary>`,
      `<content type="html">${e(x.html)}</content>`,
      "</entry>",
    );
  lines.push("</feed>");
  return lines.join("\n") + "\n";
}
