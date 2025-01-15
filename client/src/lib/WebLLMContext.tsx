import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { pdfEmbeddingHandler } from './pdfUtils';

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface WebLLMEngine extends webllm.MLCEngineInterface {
  dispose?: () => Promise<void>;
}

type WebLLMContextType = {
  isModelLoaded: boolean;
  loadingProgress: string;
  sendMessage: (message: string) => Promise<AsyncIterable<webllm.ChatCompletionChunk>>;
  isGenerating: boolean;
  interruptGeneration: () => void;
  messageHistory: Message[];
  setMessageHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  initializePDFContext: (file: File) => Promise<void>;
  isPDFLoaded: boolean;
  isPDFLoading: boolean;
  unloadPDF: () => void;
  initializeEngine: (modelType: "basic" | "smart") => Promise<void>;
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
  const [isPDFLoaded, setIsPDFLoaded] = useState(false);
  const [isPDFLoading, setIsPDFLoading] = useState(false);

  const [messageHistory, setMessageHistory] = useState<Message[]>([
    {
      role: "system",
      content: "You are a helpful, respectful and honest assistant.",
    },
  ]);

  const engineRef = useRef<WebLLMEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const initializeEngine = useCallback(async (modelType: "basic" | "smart" = "smart") => {
    const initProgressCallback = (report: webllm.InitProgressReport) => {
      setLoadingProgress(report.text);
    };
    try {
      setIsModelLoaded(false);

      if (engineRef.current) {
        if (typeof engineRef.current.dispose === 'function') {
          try {
            await engineRef.current.dispose();
          } catch (error) {
            console.warn('Error disposing engine:', error);
          }
        }
        engineRef.current = null;
      }

      const modelName = modelType === "smart" 
        ? "Llama-3.2-3B-Instruct-q4f16_1-MLC" 
        : "Llama-3.2-1B-Instruct-q4f16_1-MLC";

      engineRef.current = await webllm.CreateWebWorkerMLCEngine(
        new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' }),
        modelName,
        { initProgressCallback }
      );
      setIsModelLoaded(true);
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      setIsModelLoaded(false);
      throw error;
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string): Promise<AsyncIterable<webllm.ChatCompletionChunk>> => {
      if (!engineRef.current && !isModelLoaded) {
        await initializeEngine();
      }
      if (!engineRef.current) {
        throw new Error("Engine not initialized");
      }

      abortControllerRef.current = new AbortController();
      setIsGenerating(true);

      let contextPrompt = "";
      if (isPDFLoaded && pdfEmbeddingHandler.hasDocument()) {
        const relevantChunks = await pdfEmbeddingHandler.searchSimilarChunks(message);
        if (relevantChunks.length > 0) {
          contextPrompt = `Here are relevant passages from the PDF document to help answer the question:\n\n${relevantChunks.join(
            "\n\n"
          )}\n\nBased on these passages, please answer the following question: ${message}`;
        }
      }

      try {
        const systemMessage = messageHistory.find((msg) => msg.role === "system");
        const nonSystemMessages = messageHistory.filter((msg) => msg.role !== "system");

        const request: webllm.ChatCompletionRequest = {
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            systemMessage || {
              role: "system",
              content: "You are a helpful, respectful and honest assistant.",
            },
            ...nonSystemMessages,
            { role: "user", content: contextPrompt || message },
          ],
          temperature: 0.8,
          max_tokens: 800,
        };

        const response = await engineRef.current.chat.completions.create(request);

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
    },
    [isModelLoaded, initializeEngine, messageHistory, isPDFLoaded]
  );

  const interruptGeneration = useCallback(() => {
    if (engineRef.current && isGenerating) {
      engineRef.current.interruptGenerate();
      setIsGenerating(false);
    }
  }, [isGenerating]);

  const initializePDFContext = async (file: File) => {
    try {
      setIsPDFLoading(true);
      if (!pdfEmbeddingHandler.isInitialized()) {
        await pdfEmbeddingHandler.initialize((progress) => {
          setLoadingProgress(`Loading PDF embedding model: ${progress.text}`);
        });
      }
      const { extractTextFromPDF } = await import('./pdfUtils');
      const textChunks = await extractTextFromPDF(file);
      await pdfEmbeddingHandler.addDocument(textChunks);

      setIsPDFLoaded(true);
      setMessageHistory((prev) => [
        ...prev,
        {
          role: "system",
          content: `A PDF document has been loaded. You can now answer questions about its content. Always use the provided context to answer questions about the PDF.`,
        },
      ]);
    } catch (error) {
      console.error('Error initializing PDF context:', error);
      throw error;
    } finally {
      setIsPDFLoading(false);
    }
  };

  const unloadPDF = useCallback(() => {
    setIsPDFLoaded(false);
    pdfEmbeddingHandler.clearDocument();
    setMessageHistory((prev) => {
      const systemMsg = prev.find((msg) => msg.role === "system");
      return systemMsg ? [systemMsg] : [];
    });
  }, []);

  return (
    <WebLLMContext.Provider
      value={{
        isModelLoaded,
        loadingProgress,
        sendMessage,
        isGenerating,
        interruptGeneration,
        messageHistory,
        setMessageHistory,
        initializePDFContext,
        isPDFLoaded,
        isPDFLoading,
        unloadPDF,
        initializeEngine,
      }}
    >
      {children}
    </WebLLMContext.Provider>
  );
}