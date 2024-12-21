import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import * as webllm from "@mlc-ai/web-llm";
import { pdfEmbeddingHandler } from './pdfUtils';

interface Message {
    role: "system" | "user" | "assistant";
    content: string;
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
    const [messageHistory, setMessageHistory] = useState<Message[]>([{
        role: "system",
        content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses.",
    }]);
    const engineRef = useRef<webllm.MLCEngineInterface | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const initializeEngine = useCallback(async () => {
        const initProgressCallback = (report: webllm.InitProgressReport) => {
            setLoadingProgress(report.text);
        };

        try {
            console.log('Starting WebLLM initialization...');
            const workerUrl = new URL('./webllm.worker.ts', import.meta.url);
            console.log('Worker URL:', workerUrl.href);
            
            const worker = new Worker(workerUrl, { type: 'module' });
            worker.onerror = (e) => {
                console.error('Worker error:', e);
            };
            
            engineRef.current = await webllm.CreateWebWorkerMLCEngine(
                worker,
                "Llama-2-7b-chat-hf-q4f32_1",
                { 
                    initProgressCallback,
                    required_features: ["webgpu"]
                }
            );
            console.log('WebLLM engine created successfully');
            setIsModelLoaded(true);
        } catch (error) {
            console.error('Failed to initialize WebLLM:', error);
            setLoadingProgress(`Error loading model: ${error.message}`);
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

        let contextPrompt = "";
        if (isPDFLoaded && pdfEmbeddingHandler.hasDocument()) {
            const relevantChunks = await pdfEmbeddingHandler.searchSimilarChunks(message);
            if (relevantChunks.length > 0) {
                contextPrompt = `Here are relevant passages from the PDF document to help answer the question:\n\n${relevantChunks.join('\n\n')}\n\nBased on these passages, please answer the following question: ${message}`;
            }
        }

        // Add user message to history before making the request
        const userMessage: Message = { role: "user", content: message };
        setMessageHistory(prevHistory => [...prevHistory, userMessage]); // Update to use functional update

        try {
            // Include message history in the request
            // Ensure system message is first, followed by context and user message
            const systemMessage = messageHistory.find(msg => msg.role === "system");
            const nonSystemMessages = messageHistory.filter(msg => msg.role !== "system");
            
            const request: webllm.ChatCompletionRequest = {
                stream: true,
                stream_options: { include_usage: true },
                messages: [
                    // System message must be first
                    systemMessage || {
                        role: "system",
                        content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses."
                    },
                    // Include previous conversation context
                    ...nonSystemMessages,
                    // Add the current message with context if available
                    {
                        role: "user",
                        content: contextPrompt || message
                    }
                ],
                temperature: 0.8,
                max_tokens: 800,
            };

            const response = await engineRef.current.chat.completions.create(request);

            // Create a wrapper generator that handles the isGenerating state and message history
            const wrappedResponse = async function* () {
                let assistantMessage = "";
                try {
                    for await (const chunk of response) {
                        assistantMessage += chunk.choices[0]?.delta?.content || "";
                        yield chunk;
                    }
                } finally {
                    // Add assistant's complete message to history
                    if (assistantMessage) {
                        setMessageHistory(prev => [...prev, {
                            role: "assistant",
                            content: assistantMessage
                        }]);
                    }
                    setIsGenerating(false);
                }
            };

            return wrappedResponse();
        } catch (error) {
            setIsGenerating(false);
            throw error;
        }
    }, [isModelLoaded, initializeEngine, messageHistory]); // Add messageHistory to the dependency array

    const interruptGeneration = useCallback(() => {
        if (engineRef.current && isGenerating) {
            engineRef.current.interruptGenerate();
            setIsGenerating(false);
        }
    }, [isGenerating]);

    useEffect(() => {
        // Clear message history when the model is reloaded
        if (isModelLoaded) {
          setMessageHistory([{
            role: "system",
            content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses.",
          }]);
        }
      }, [isModelLoaded]);

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
            setMessageHistory(prev => [
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

    return (
        <WebLLMContext.Provider value={{
            isModelLoaded,
            loadingProgress,
            sendMessage,
            isGenerating,
            interruptGeneration,
            messageHistory,
            setMessageHistory,
            initializePDFContext,
            isPDFLoaded,
            isPDFLoading
        }}>
            {children}
        </WebLLMContext.Provider>
    );
}