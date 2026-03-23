export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'text';
  content: string; // base64 data URL for images, raw text for text files
}
