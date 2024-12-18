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
  const { sendMessage, isModelLoaded, loadingProgress, isGenerating, interruptGeneration, messageHistory } = useWebLLM();
  
  // Convert WebLLM message history to UI messages
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    const convertedMessages = messageHistory.slice(1).map((msg, index) => ({
      id: index + 1,
      content: msg.content,
      isUser: msg.role === "user",
      timestamp: new Date().toLocaleTimeString(),
    }));
    
    if (convertedMessages.length === 0) {
      convertedMessages.push({
        id: 1,
        content: "Hello! How can I help you today?",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
    
    setMessages(convertedMessages);
  }, [messageHistory]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: messages.length + 1,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    try {
      const response = await sendMessage(content);
      if (!response) return;

      // The message updates will be handled by the WebLLMContext
      // through the messageHistory state
      let fullMessage = "";
      for await (const chunk of response) {
        fullMessage += chunk.choices[0]?.delta?.content || "";
        // Update UI with streaming response
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (!lastMessage.isUser) {
            return prev.map((msg, idx) => 
              idx === prev.length - 1 ? { ...msg, content: fullMessage } : msg
            );
          } else {
            return [...prev, {
              id: prev.length + 1,
              content: fullMessage,
              isUser: false,
              timestamp: new Date().toLocaleTimeString(),
            }];
          }
        });
      }
      
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [...prev, {
        id: prev.length + 1,
        content: "I apologize, but I encountered an error. Please try again.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      }]);
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
