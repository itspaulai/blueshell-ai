import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import * as webllm from "@mlc-ai/web-llm";
import { pdfEmbeddingHandler } from './pdfUtils';
import { chatDB } from './db';

interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

type WebLLMContextType = {
    isModelLoaded: boolean;
    loadingProgress: string;
    sendMessage: (message: string, conversationId?: number) => Promise<AsyncIterable<webllm.ChatCompletionChunk>>;
    isGenerating: boolean;
    interruptGeneration: () => void;
    messageHistory: Message[];
    setMessageHistory: React.Dispatch<React.SetStateAction<Message[]>>;
    initializePDFContext: (file: File) => Promise<void>;
    isPDFLoaded: boolean;
    isPDFLoading: boolean;
    unloadPDF: () => void;
    initializeContext: (conversationId: number) => Promise<void>;
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

    // New function to initialize context from a conversation
    const initializeContext = async (conversationId: number) => {
        try {
            const conversation = await chatDB.getConversation(conversationId);
            if (conversation) {
                // Convert IndexedDB messages to WebLLM message format
                const webLLMMessages: Message[] = conversation.messages.map(msg => ({
                    role: msg.isUser ? "user" : "assistant",
                    content: msg.content
                }));

                // Always include the system message at the start
                setMessageHistory([
                    {
                        role: "system",
                        content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses."
                    },
                    ...webLLMMessages
                ]);
            }
        } catch (error) {
            console.error('Error initializing context:', error);
        }
    };

    const sendMessage = useCallback(async (message: string): Promise<AsyncIterable<webllm.ChatCompletionChunk>> => {
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
                contextPrompt = `Here are relevant passages from the PDF document to help answer the question:\n\n${relevantChunks.join('\n\n')}\n\nBased on these passages, please answer the following question: ${message}`;
            }
        }

        const userMessage: Message = { role: "user", content: message };
        setMessageHistory(prevHistory => [...prevHistory, userMessage]);

        try {
            const systemMessage = messageHistory.find(msg => msg.role === "system");
            const nonSystemMessages = messageHistory.filter(msg => msg.role !== "system");

            const request: webllm.ChatCompletionRequest = {
                stream: true,
                stream_options: { include_usage: true },
                messages: [
                    systemMessage || {
                        role: "system",
                        content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses."
                    },
                    ...nonSystemMessages,
                    {
                        role: "user",
                        content: contextPrompt || message
                    }
                ],
                temperature: 0.8,
                max_tokens: 800,
            };

            const response = await engineRef.current.chat.completions.create(request);

            const wrappedResponse = async function* () {
                let assistantMessage = "";
                try {
                    for await (const chunk of response) {
                        assistantMessage += chunk.choices[0]?.delta?.content || "";
                        yield chunk;
                    }
                } finally {
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
    }, [isModelLoaded, initializeEngine, messageHistory, isPDFLoaded]);

    const interruptGeneration = useCallback(() => {
        if (engineRef.current && isGenerating) {
            engineRef.current.interruptGenerate();
            setIsGenerating(false);
        }
    }, [isGenerating]);

    useEffect(() => {
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

    const unloadPDF = useCallback(() => {
        setIsPDFLoaded(false);
        setMessageHistory(prev => [prev[0]]);

        if (pdfEmbeddingHandler.hasDocument()) {
            pdfEmbeddingHandler.clearDocument();
        }
    }, []);

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
            isPDFLoading,
            unloadPDF,
            initializeContext
        }}>
            {children}
        </WebLLMContext.Provider>
    );
}