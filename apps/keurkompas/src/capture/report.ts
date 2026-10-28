/**
 * Reads the previous report on the phone (PDF, Word or text), so it works offline and the
 * file itself never has to leave the device. Tables become "cell | cell" lines, which keeps the
 * BEPO tables (T2–T20) readable for the assistant.
 */

export async function extractReportText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return extractPdf(file);
  if (name.endsWith('.docx')) return extractDocx(file);
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/'))
    return file.text();
  throw new Error('Kies een PDF-, Word- (.docx) of tekstbestand.');
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Run pdf.js on the main thread (no separate worker file): simpler, and works in every build.
  // @ts-expect-error -- the worker module has no type declarations
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  (globalThis as Record<string, unknown>).pdfjsWorker = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    // Group text pieces into lines by their vertical position, then left to right.
    const lines = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3);
      const line = lines.get(y) ?? [];
      line.push({ x: item.transform[4], str: item.str });
      lines.set(y, line);
    }
    const text = [...lines.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str.trim())
          .join(' | '),
      )
      .join('\n');
    pages.push(`--- pagina ${p} ---\n${text}`);
  }
  return pages.join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return htmlToText(new DOMParser().parseFromString(html, 'text/html').body);
}

/** Paragraphs and headings as lines; every table row as "cell | cell | cell". */
export function htmlToText(root: Element): string {
  const out: string[] = [];
  const clean = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'table') {
        for (const row of Array.from(child.querySelectorAll('tr'))) {
          const cells = Array.from(row.children).map((c) => clean(c.textContent) || '/');
          out.push(cells.join(' | '));
        }
        out.push('');
      } else if (/^(p|h[1-6]|li)$/.test(tag)) {
        const text = clean(child.textContent);
        if (text) out.push(tag.startsWith('h') ? `## ${text}` : text);
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
