import * as webllm from "@mlc-ai/web-llm";

export interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

// Initialize WebLLM engine
let engine: webllm.MLCEngineInterface | null = null;

export async function initializeEngine(
  progressCallback?: (progress: webllm.InitProgressReport) => void
) {
  if (engine) return engine;

  try {
    engine = await webllm.CreateWebWorkerMLCEngine(
      new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" }),
      "Llama-3.2-3B-Instruct-q4f16_1-MLC",
      {
        initProgressCallback: progressCallback,
      }
    );

    return engine;
  } catch (error) {
    console.error("Failed to initialize WebLLM engine:", error);
    throw error;
  }
}

export interface ChatOptions {
  onProgress?: (content: string) => void;
}

export async function getBotResponse(
  userMessage: string,
  conversationHistory: Message[],
  options?: ChatOptions
): Promise<string> {
  if (!engine) {
    throw new Error("WebLLM engine not initialized");
  }

  const messages: webllm.ChatCompletionRequest["messages"] = [
    {
      role: "system",
      content:
        "You are a helpful, respectful and honest assistant. " +
        "Be direct and clear in your responses.",
    },
    ...conversationHistory.map((msg) => ({
      role: msg.isUser ? "user" : "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  const request: webllm.ChatCompletionRequest = {
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 512,
  };

  try {
    const stream = await engine.chat.completions.create(request);
    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      options?.onProgress?.(fullResponse);
    }

    return fullResponse;
  } catch (error) {
    console.error("Error in getBotResponse:", error);
    throw error;
  }
}
