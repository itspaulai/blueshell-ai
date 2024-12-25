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
      messages: [], // Initialize with empty messages
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(conversation);

      request.onsuccess = () => resolve(conversation.id);
      request.onerror = () => {
        console.error('Error adding conversation:', request.error);
        reject(request.error);
      };
    });
  }

  async getConversations(): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('updatedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const conversations = request.result;
        // Sort by updatedAt in descending order (newest first)
        conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(conversations);
      };
      request.onerror = () => {
        console.error('Error fetching conversations:', request.error);
        reject(request.error);
      };
    });
  }

  async getConversation(id: number): Promise<Conversation | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error('Error fetching conversation:', request.error);
        reject(request.error);
      };
    });
  }

  async updateConversation(id: number, messages: ChatMessage[], title?: string, updateTimestamp: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const conversation = request.result;
        if (conversation) {
          // Only update messages if they are provided and not empty
          if (messages && messages.length > 0) {
            conversation.messages = messages;
          }
          if (title) {
            conversation.title = title;
          }
          if (updateTimestamp) {
            conversation.updatedAt = new Date().toISOString();
          }
          const updateRequest = store.put(conversation);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => {
            console.error('Error updating conversation:', updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          reject(new Error('Conversation not found'));
        }
      };
      request.onerror = () => {
        console.error('Error fetching conversation for update:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteConversation(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Error deleting conversation:', request.error);
        reject(request.error);
      };
    });
  }

  async renameConversation(id: number, newTitle: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        const conversation = request.result;
        if (conversation) {
          conversation.title = newTitle;
          conversation.updatedAt = new Date().toISOString();
          const updateRequest = store.put(conversation);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => {
            console.error('Error renaming conversation:', updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          reject(new Error('Conversation not found'));
        }
      };
      request.onerror = () => {
        console.error('Error fetching conversation for rename:', request.error);
        reject(request.error);
      };
    });
  }
}

export const chatDB = new ChatDB();