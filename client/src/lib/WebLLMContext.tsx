import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import * as webllm from "@mlc-ai/web-llm";

type WebLLMContextType = {
  isModelLoaded: boolean;
  loadingProgress: string;
  sendMessage: (message: string) => Promise<void>;
  isGenerating: boolean;
};

const WebLLMContext = createContext<WebLLMContextType | null>(null);

export function useWebLLM() {
  const context = useContext(WebLLMContext);
  if (!context) {
    throw new Error('useWebLLM must be used within a WebLLMProvider');
  }
  return context;
}

export function WebLLMProvider({ children }: { children: ReactNode }) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<webllm.MLCEngineInterface | null>(null);

  const initializeEngine = useCallback(async () => {
    const initProgressCallback = (report: webllm.InitProgressReport) => {
      setLoadingProgress(report.text);
    };

    try {
      engineRef.current = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' }),
        "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        { initProgressCallback }
      );
      setIsModelLoaded(true);
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!engineRef.current && !isModelLoaded) {
      await initializeEngine();
    }

    if (!engineRef.current) return;

    setIsGenerating(true);
    try {
      const request: webllm.ChatCompletionRequest = {
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          {
            role: "system",
            content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 800,
      };

      return engineRef.current.chat.completions.create(request);
    } finally {
      setIsGenerating(false);
    }
  }, [isModelLoaded, initializeEngine]);

  return (
    <WebLLMContext.Provider value={{ 
      isModelLoaded, 
      loadingProgress, 
      sendMessage,
      isGenerating
    }}>
      {children}
    </WebLLMContext.Provider>
  );
}
