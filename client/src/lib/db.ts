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
  private db: IDBDatabase | null = null;
  private readonly dbName = 'chatDB';
  private readonly storeName = 'conversations';
  private readonly version = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  async createConversation(title: string = 'New Chat'): Promise<number> {
    const conversation: Conversation = {
      id: Date.now(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.storeName, 'readwrite');
      if (!transaction) reject(new Error('Database not initialized'));

      const store = transaction!.objectStore(this.storeName);
      const request = store.add(conversation);

      request.onsuccess = () => resolve(conversation.id);
      request.onerror = () => reject(request.error);
    });
  }

  async getConversations(): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.storeName, 'readonly');
      if (!transaction) reject(new Error('Database not initialized'));

      const store = transaction!.objectStore(this.storeName);
      const index = store.index('updatedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const conversations = request.result;
        // Ensure proper date comparison by parsing strings to timestamps
        conversations.sort((a, b) => {
          const dateA = new Date(b.updatedAt).getTime();
          const dateB = new Date(a.updatedAt).getTime();
          return dateA - dateB;
        });
        resolve(conversations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getConversation(id: number): Promise<Conversation | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.storeName, 'readonly');
      if (!transaction) reject(new Error('Database not initialized'));

      const store = transaction!.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async updateConversation(id: number, messages: ChatMessage[], title?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.storeName, 'readwrite');
      if (!transaction) reject(new Error('Database not initialized'));

      const store = transaction!.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const conversation = request.result;
        if (conversation) {
          // Only update timestamp when adding new messages
          const lastMessage = messages[messages.length - 1];
          const hasNewMessage = lastMessage && (!conversation.messages.length || 
            lastMessage.id !== conversation.messages[conversation.messages.length - 1].id);
          const hasNewTitle = title && title !== conversation.title;
          
          conversation.messages = messages;
          if (title) {
            conversation.title = title;
          }
          
          // Only update timestamp for new messages or title changes
          if (hasNewMessage || hasNewTitle) {
            conversation.updatedAt = new Date().toISOString();
          }
          
          const updateRequest = store.put(conversation);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Conversation not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const chatDB = new ChatDB();
