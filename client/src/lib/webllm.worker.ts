import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// Initialize the worker handler for WebLLM
const handler = new WebWorkerMLCEngineHandler();

// Handle messages from the main thread
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
