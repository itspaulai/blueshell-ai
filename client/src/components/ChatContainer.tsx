import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";

interface Message {
  role: string;
  content: string;
}

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onReset: () => void;
}

export function ChatContainer({ messages, isLoading, onSendMessage, onReset }: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const scrollContainer = containerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        <div className="h-full px-4 overflow-auto" ref={containerRef}>
          <div className="max-w-3xl mx-auto py-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500">
                Send a message to start the conversation
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatBubble
                  key={index}
                  message={message.content}
                  isUser={message.role === "user"}
                  timestamp={new Date().toLocaleTimeString()}
                />
              ))
            )}
            {isLoading && (
              <ChatBubble
                message="..."
                isUser={false}
                timestamp={new Date().toLocaleTimeString()}
              />
            )}
          </div>
        </div>
      </div>
      <div className="bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={onSendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
