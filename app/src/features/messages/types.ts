export type Conversation = {
  id: string;
  kind: 'support' | 'service';
  subject: string | null;
  status: 'open' | 'closed';
  lastMessageAt: string | null;
  lastMessage: string | null;
  unreadCount: number;
  createdAt: string | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string | null;
  mine: boolean;
  fromSupport: boolean;
};
