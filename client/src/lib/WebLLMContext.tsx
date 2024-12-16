import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import * as webllm from "@mlc-ai/web-llm";

type WebLLMContextType = {
  isModelLoaded: boolean;
  loadingProgress: string;
  sendMessage: (message: string) => Promise<AsyncIterable<webllm.ChatCompletionChunk>>;
  isGenerating: boolean;
  interruptGeneration: () => void;
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
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const sendMessage = useCallback(async (message: string): Promise<AsyncIterable<webllm.ChatCompletionChunk>> => {
    if (!engineRef.current && !isModelLoaded) {
      await initializeEngine();
    }

    if (!engineRef.current) {
      throw new Error("Engine not initialized");
    }

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
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

      const response = await engineRef.current.chat.completions.create(request);
      
      // Create a wrapper generator that handles the isGenerating state
      const wrappedResponse = async function* () {
        try {
          for await (const chunk of response) {
            yield chunk;
          }
        } finally {
          setIsGenerating(false);
        }
      };
      
      return wrappedResponse();
    } catch (error) {
      setIsGenerating(false);
      throw error;
    }
  }, [isModelLoaded, initializeEngine]);

  const interruptGeneration = useCallback(() => {
    if (engineRef.current && isGenerating) {
      engineRef.current.interruptGenerate();
      setIsGenerating(false);
    }
  }, [isGenerating]);

  return (
    <WebLLMContext.Provider value={{ 
      isModelLoaded, 
      loadingProgress, 
      sendMessage,
      isGenerating,
      interruptGeneration
    }}>
      {children}
    </WebLLMContext.Provider>
  );
}
