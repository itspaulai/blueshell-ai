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
  const { messageHistory } = useWebLLM();
  const [messages, setMessages] = useState<Message[]>([]);

  // Convert context messages to UI messages on mount and when messageHistory changes
  useEffect(() => {
    const uiMessages = messageHistory
      .filter(msg => msg.role !== "system") // Don't show system messages
      .map((msg, index) => ({
        id: index + 1,
        content: msg.content,
        isUser: msg.role === "user",
        timestamp: new Date().toLocaleTimeString(),
      }));
    setMessages(uiMessages);
  }, [messageHistory]);
  
  const { sendMessage, isModelLoaded, loadingProgress, isGenerating, interruptGeneration } = useWebLLM();
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

    const botMessageId = messages.length + 2;
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

      setCurrentResponse(""); // Reset current response
      for await (const chunk of response) {
        const newContent = chunk.choices[0]?.delta?.content || "";
        setCurrentResponse(prev => prev + newContent);
        // Update the current message in the messages array
        setMessages((prev) => prev.map(msg => 
          msg.id === botMessageId ? { ...msg, content: msg.content + newContent } : msg
        ));
      }
      setCurrentResponse(""); // Clear streaming state after completion
      
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
            {/* Current response is now handled through the messages array */}
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
