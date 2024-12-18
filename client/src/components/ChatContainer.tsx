import { useState, useEffect, useRef } from "react";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync messages with messageHistory
  useEffect(() => {
    const uiMessages = messageHistory
      .slice(1) // Skip the system message
      .map((msg, index) => ({
        id: index,
        content: msg.content,
        isUser: msg.role === "user",
        timestamp: new Date().toLocaleTimeString(),
      }));
    setMessages(uiMessages);
  }, [messageHistory]);

  // Auto-scroll effect
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, currentResponse]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    try {
      const response = await sendMessage(content);
      if (!response) return;

      let fullMessage = "";
      for await (const chunk of response) {
        fullMessage += chunk.choices[0]?.delta?.content || "";
        setCurrentResponse(fullMessage);
      }
      setCurrentResponse("");
    } catch (error) {
      console.error('Error generating response:', error);
    }
  };

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
            disabled={!isModelLoaded} 
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
