import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import * as webllm from "@mlc-ai/web-llm";

import { processPDF, findRelevantChunks, DocumentChunk } from './pdfProcessor';

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
    uploadPDF: (file: File) => Promise<void>;
    hasPDFContext: boolean;
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
    const [messageHistory, setMessageHistory] = useState<Message[]>([{
        role: "system",
        content: "You are a helpful, respectful and honest assistant. Always be direct and concise in your responses.",
    }]);
    const [documentChunks, setDocumentChunks] = useState<DocumentChunk[]>([]);
    const [hasPDFContext, setHasPDFContext] = useState(false);
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

        // Add user message to history before making the request
        const userMessage: Message = { role: "user", content: message };
        setMessageHistory(prevHistory => [...prevHistory, userMessage]); // Update to use functional update

        try {
            // Include message history in the request
            const request: webllm.ChatCompletionRequest = {
                stream: true,
                stream_options: { include_usage: true },
                messages: [...messageHistory, userMessage], // Use updated history directly
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

    const uploadPDF = useCallback(async (file: File) => {
        if (!engineRef.current) {
            await initializeEngine();
        }
        if (!engineRef.current) throw new Error("Engine not initialized");

        setLoadingProgress("Processing PDF...");
        try {
            const chunks = await processPDF(file, engineRef.current);
            setDocumentChunks(chunks);
            setHasPDFContext(true);
            setMessageHistory(prev => [
                ...prev,
                {
                    role: "system",
                    content: "A PDF document has been uploaded. I will use its content to inform my responses."
                }
            ]);
        } catch (error) {
            console.error('Error processing PDF:', error);
            let errorMessage = 'An error occurred while processing the PDF';
            if (error instanceof Error) {
                if (error.message.includes('SpecifiedModelNotFoundError')) {
                    errorMessage = 'Failed to initialize the AI model. Please try again.';
                } else if (error.message.includes('PDF')) {
                    errorMessage = 'Failed to process the PDF file. Please make sure it\'s a valid PDF.';
                }
            }
            throw new Error(errorMessage);
        } finally {
            setLoadingProgress("");
        }
    }, [initializeEngine]);

    const sendMessageWithContext = useCallback(async (message: string): Promise<AsyncIterable<webllm.ChatCompletionChunk>> => {
        if (!engineRef.current && !isModelLoaded) {
            await initializeEngine();
        }
        if (!engineRef.current) throw new Error("Engine not initialized");

        abortControllerRef.current = new AbortController();
        setIsGenerating(true);

        const userMessage: Message = { role: "user", content: message };
        setMessageHistory(prev => [...prev, userMessage]);

        try {
            let context = "";
            if (hasPDFContext && documentChunks.length > 0) {
                const relevantChunks = await findRelevantChunks(message, documentChunks, engineRef.current);
                context = "Here is the relevant context from the PDF:\n\n" + relevantChunks.join("\n\n") + "\n\nPlease use this context to answer the following question:\n\n";
            }

            const request: webllm.ChatCompletionRequest = {
                stream: true,
                stream_options: { include_usage: true },
                messages: [
                    ...messageHistory,
                    context ? { role: "system", content: context } : null,
                    userMessage
                ].filter(Boolean) as Message[],
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
    }, [isModelLoaded, initializeEngine, messageHistory, hasPDFContext, documentChunks]);

    return (
        <WebLLMContext.Provider value={{
            isModelLoaded,
            loadingProgress,
            sendMessage: sendMessageWithContext,
            isGenerating,
            interruptGeneration,
            messageHistory,
            setMessageHistory,
            uploadPDF,
            hasPDFContext
        }}>
            {children}
        </WebLLMContext.Provider>
    );
}