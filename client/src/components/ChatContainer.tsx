import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { useWebLLM } from "@/lib/WebLLMContext";

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
  
  const { sendMessage, isModelLoaded, loadingProgress, isGenerating } = useWebLLM();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: messages.length + 1,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, userMessage]);

    if (!isModelLoaded) {
      const loadingMessage: Message = {
        id: messages.length + 2,
        content: "Loading AI model...",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, loadingMessage]);
    }

    try {
      const response = await sendMessage(content);
      if (!response) return;

      const botMessageId = messages.length + 2;
      const botMessage: Message = {
        id: botMessageId,
        content: "",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
      let fullMessage = "";

      for await (const chunk of response) {
        fullMessage += chunk.choices[0]?.delta?.content || "";
        setMessages((prev) => prev.map(msg => 
          msg.id === botMessageId ? { ...msg, content: fullMessage } : msg
        ));
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
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, currentResponse]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4" ref={scrollRef}>
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
        </ScrollArea>
      </div>
      <div className="bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSendMessage} disabled={isGenerating} />
        </div>
      </div>
    </div>
  );
}
