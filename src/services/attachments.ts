import type { Attachment } from '../types/attachments';

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

const ACCEPTED_TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
]);

const ACCEPTED_DOC_EXTENSIONS = new Set([
  '.pdf', '.docx',
]);

const ACCEPTED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.txt', '.md', '.csv',
  '.json', '.html', '.htm', '.xml',
  '.pdf', '.docx',
]);

export const ACCEPTED_FILE_TYPES =
  'image/png,image/jpeg,image/gif,image/webp,text/plain,text/markdown,text/csv,text/html,text/xml,application/json,application/xml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.json,.html,.htm,.xml,.pdf,.docx';

export function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type) || ACCEPTED_TEXT_TYPES.has(file.type)) {
    return true;
  }
  if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return true;
  }
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.has(ext);
}

function isImageFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
}

function getExt(file: File): string {
  return '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
}

function isDocFile(file: File): boolean {
  return ACCEPTED_DOC_EXTENSIONS.has(getExt(file)) ||
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

// Lazy-load PDF parser only when needed
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

// Lazy-load DOCX parser only when needed
async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function readFileAsAttachment(file: File): Promise<Attachment> {
  const id = crypto.randomUUID();

  if (isImageFile(file)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ id, name: file.name, type: 'image', content: reader.result as string });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  if (isDocFile(file)) {
    const ext = getExt(file);
    let text: string;
    if (ext === '.pdf' || file.type === 'application/pdf') {
      text = await extractPdfText(file);
    } else {
      text = await extractDocxText(file);
    }
    return { id, name: file.name, type: 'text', content: text };
  }

  // Text-based files (txt, md, csv, json, html, xml)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({ id, name: file.name, type: 'text', content: reader.result as string });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export function buildUserContent(
  text: string,
  attachments: Attachment[],
): string | ContentPart[] {
  if (attachments.length === 0) return text;

  const parts: ContentPart[] = [{ type: 'text', text }];

  for (const att of attachments) {
    if (att.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: att.content } });
    } else {
      parts.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.content}` });
    }
  }

  return parts;
}
