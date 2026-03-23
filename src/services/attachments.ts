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
]);

const ACCEPTED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.txt', '.md', '.csv',
]);

export const ACCEPTED_FILE_TYPES =
  'image/png,image/jpeg,image/gif,image/webp,text/plain,text/markdown,text/csv,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv';

export function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type) || ACCEPTED_TEXT_TYPES.has(file.type)) {
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

export function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const reader = new FileReader();

    if (isImageFile(file)) {
      reader.onload = () => {
        resolve({
          id,
          name: file.name,
          type: 'image',
          content: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        resolve({
          id,
          name: file.name,
          type: 'text',
          content: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    }
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
