import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { useWebLLM } from "@/lib/WebLLMContext";
import { extractTextFromPdf, processPdfContent, generateQueryContext } from "@/lib/pdfUtils";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: "Hello! How can I help you today?",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  
  const { sendMessage, isModelLoaded, loadingProgress, isGenerating, interruptGeneration, engine } = useWebLLM();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [pdfVectorStore, setPdfVectorStore] = useState<MemoryVectorStore | null>(null);
  const [isPdfUploaded, setIsPdfUploaded] = useState(false);

  const scrollToBottom = () => {
    if (contentRef.current && shouldAutoScroll) {
      const scrollContainer = contentRef.current;
      const shouldSmoothScroll = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight > 500;
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: shouldSmoothScroll ? "smooth" : "auto"
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const textContent = await extractTextFromPdf(file);
      const vectorStore = await processPdfContent(engine, textContent);
      setPdfVectorStore(vectorStore);
      setIsPdfUploaded(true);
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: `PDF "${file.name}" uploaded successfully. You can now ask questions about its content.`,
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: "Sorry, there was an error processing the PDF. Please try again.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }]);
    }
  };

  const handleSendMessage = async (content: string) => {
    const newMessageId = Date.now();
    const userMessage: Message = {
      id: newMessageId,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, userMessage]);

    const botMessageId = newMessageId + 1;
    const initialBotMessage: Message = {
      id: botMessageId,
      content: isModelLoaded ? "" : "Loading AI model...",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, initialBotMessage]);

    try {
      let messageToSend = content;
      if (isPdfUploaded && pdfVectorStore) {
        const context = await generateQueryContext(pdfVectorStore, content);
        messageToSend = `Context from PDF:\n${context}\n\nUser question: ${content}\n\nPlease answer the question based on the provided context.`;
      }
      const response = await sendMessage(messageToSend);
      if (!response) return;

      let fullMessage = "";
      for await (const chunk of response) {
        fullMessage += chunk.choices[0]?.delta?.content || "";
        setMessages((prev) => prev.map(msg => 
          msg.id === botMessageId ? { ...msg, content: fullMessage } : msg
        ));
        // Reset auto-scroll when new message starts generating
        setShouldAutoScroll(true);
        // Ensure smooth scrolling during generation
        scrollToBottom();
      }
      
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage: Message = {
        id: messages.length + 2,
        content: "I apologize, but I encountered an error. Please try again.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // If user scrolls up more than 100px from bottom, disable auto-scroll
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div 
        className="flex-1 overflow-y-auto px-4"
        ref={contentRef}
      >
        <div className="max-w-3xl mx-auto py-6">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message.content}
                isUser={message.isUser}
                timestamp={message.timestamp}
              />
            ))}
            {currentResponse && (
              <ChatBubble
                message={currentResponse}
                isUser={false}
                timestamp={new Date().toLocaleTimeString()}
              />
            )}
            {!isModelLoaded && loadingProgress && (
              <div className="text-sm text-muted-foreground">
                {loadingProgress}
              </div>
            )}
          </div>
      </div>
      <div className="bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput 
            onSend={handleSendMessage} 
            onStop={interruptGeneration}
            onFileUpload={handleFileUpload}
            disabled={isGenerating} 
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
