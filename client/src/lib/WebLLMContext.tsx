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
    loadConversationContext: (conversationId: number) => Promise<void>;
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

    const loadConversationContext = async (conversationId: number) => {
        try {
            const conversation = await chatDB.getConversation(conversationId);
            if (conversation) {
                // Convert DB messages to WebLLM message format
                const convertedMessages = conversation.messages.map(msg => ({
                    role: msg.isUser ? "user" : "assistant" as "system" | "user" | "assistant",
                    content: msg.content
                }));

                // Ensure system message is first
                const systemMessage = messageHistory.find(msg => msg.role === "system");
                const messages = systemMessage ? [systemMessage, ...convertedMessages] : convertedMessages;

                setMessageHistory(messages);
                console.log('Loaded conversation context:', messages);
            }
        } catch (error) {
            console.error('Error loading conversation context:', error);
        }
    };

    const sendMessage = useCallback(async (message: string, conversationId?: number): Promise<AsyncIterable<webllm.ChatCompletionChunk>> => {
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
        setMessageHistory(prevHistory => [...prevHistory, userMessage]);

        try {
            // Ensure the message history is properly ordered with system message first
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
                        const newMessage: Message = {
                            role: "assistant",
                            content: assistantMessage
                        };
                        setMessageHistory(prev => [...prev, newMessage]);
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
        // Only reset message history when model is reloaded
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
        setMessageHistory(prev => [prev[0]]); // Keep only the initial system message

        // Reset the embedding handler's internal state
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
            loadConversationContext
        }}>
            {children}
        </WebLLMContext.Provider>
    );
}