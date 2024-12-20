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
  
  const { sendMessage, isModelLoaded, loadingProgress, isGenerating, interruptGeneration } = useWebLLM();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");

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
      const response = await sendMessage(content);
      if (!response) return;

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
    const scrollToBottom = () => {
      if (scrollRef.current) {
        const scrollElement = scrollRef.current;
        const scrollHeight = scrollElement.scrollHeight;
        const height = scrollElement.clientHeight;
        const maxScrollTop = scrollHeight - height;
        
        scrollElement.scrollTo({
          top: maxScrollTop,
          behavior: "smooth",
        });
      }
    };

    // Scroll on new messages or response updates
    scrollToBottom();

    // Set up an observer to watch for content changes
    const observer = new MutationObserver(scrollToBottom);
    if (scrollRef.current) {
      observer.observe(scrollRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => observer.disconnect();
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
          <ChatInput 
            onSend={handleSendMessage} 
            onStop={interruptGeneration}
            disabled={isGenerating} 
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
