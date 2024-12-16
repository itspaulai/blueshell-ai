import * as webllm from "@mlc-ai/web-llm";

export interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

export interface InitProgress {
  text: string;
}

export class ChatModel {
  private engine: webllm.MLCEngineInterface | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private progressCallback: ((progress: InitProgress) => void) | null = null;

  setProgressCallback(callback: (progress: InitProgress) => void) {
    this.progressCallback = callback;
  }

  async initialize() {
    if (this.isInitialized || this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      const selectedModel = "Llama-2-7b-chat-q4f32_1";
      
      this.engine = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
        selectedModel,
        {
          initProgressCallback: (report) => {
            this.progressCallback?.({ text: report.text });
          },
        }
      );
      
      this.isInitialized = true;
    })();

    return this.initializationPromise;
  }

  async generateResponse(messages: Message[]) {
    if (!this.engine) {
      throw new Error("Chat model not initialized");
    }

    const formattedMessages = messages.map(msg => ({
      role: msg.isUser ? "user" as const : "assistant" as const,
      content: msg.content
    }));

    formattedMessages.unshift({
      role: "system" as const,
      content: "You are a helpful, respectful and honest assistant. Always provide accurate and helpful responses."
    });

    const request: webllm.ChatCompletionRequest = {
      messages: formattedMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512
    };

    const response = await this.engine.chat.completions.create(request);
    if (!response[Symbol.asyncIterator]) {
      throw new Error("Expected streaming response");
    }
    
    return response;
  }
}

// Create a singleton instance
export const chatModel = new ChatModel();
