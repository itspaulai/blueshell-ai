
interface ChatMessage {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface Conversation {
  id: number;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

class ChatDB {
  private readonly storageKey = 'chatDB';

  async init(): Promise<void> {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify([]));
    }
  }

  private getConversations(): Conversation[] {
    return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
  }

  private saveConversations(conversations: Conversation[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(conversations));
  }

  async createConversation(title: string = 'New Chat'): Promise<number> {
    const conversation: Conversation = {
      id: Date.now(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const conversations = this.getConversations();
    conversations.push(conversation);
    this.saveConversations(conversations);
    return conversation.id;
  }

  async getConversations(): Promise<Conversation[]> {
    return this.getConversations().sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getConversation(id: number): Promise<Conversation | null> {
    return this.getConversations().find(conv => conv.id === id) || null;
  }

  async updateConversation(id: number, messages: ChatMessage[], title?: string): Promise<void> {
    const conversations = this.getConversations();
    const index = conversations.findIndex(conv => conv.id === id);
    if (index !== -1) {
      conversations[index].messages = messages;
      if (title) {
        conversations[index].title = title;
      }
      conversations[index].updatedAt = new Date().toISOString();
      this.saveConversations(conversations);
    }
  }

  async deleteConversation(id: number): Promise<void> {
    const conversations = this.getConversations();
    this.saveConversations(conversations.filter(conv => conv.id !== id));
  }

  async renameConversation(id: number, newTitle: string): Promise<void> {
    const conversations = this.getConversations();
    const conversation = conversations.find(conv => conv.id === id);
    if (conversation) {
      conversation.title = newTitle;
      conversation.updatedAt = new Date().toISOString();
      this.saveConversations(conversations);
    }
  }
}

export const chatDB = new ChatDB();
