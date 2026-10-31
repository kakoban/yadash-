export interface Entry {
  id: string;
  type: 'note' | 'thought' | 'idea' | 'quote' | 'list' | 'link' | 'code';
  title?: string;
  body: string;
  tags: string[];
  createdAt: number; // timestamp in milliseconds
  pinned?: boolean;
}

export interface TypeInfo {
  key: Entry['type'];
  label: string;
  color: string;
  icon: string;
}
