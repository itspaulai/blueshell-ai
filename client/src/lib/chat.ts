import * as webllm from "@mlc-ai/web-llm";

export interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

export class ChatModel {
  private engine: webllm.MLCEngineInterface | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize() {
    if (this.isInitialized || this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      const selectedModel = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
      
      this.engine = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
        selectedModel,
        {
          initProgressCallback: (report) => {
            console.log("Model initialization progress:", report.text);
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
      role: msg.isUser ? "user" : "assistant",
      content: msg.content
    }));

    // Add system message at the beginning
    formattedMessages.unshift({
      role: "system",
      content: "You are a helpful, respectful and honest assistant. Always provide accurate and helpful responses."
    });

    const request: webllm.ChatCompletionRequest = {
      messages: formattedMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 512
    };

    return this.engine.chat.completions.create(request);
  }
}

// Create a singleton instance
export const chatModel = new ChatModel();
