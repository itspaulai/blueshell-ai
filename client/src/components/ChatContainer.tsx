import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { getBotResponse, initializeEngine, type Message } from "@/lib/chat";
import type { InitProgressReport } from "@mlc-ai/web-llm";

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initStatus, setInitStatus] = useState("Initializing WebLLM...");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeEngine((progress: InitProgressReport) => {
          setInitStatus(progress.text);
        });
        setIsLoading(false);
        setError(null);
        setMessages([
          {
            id: 1,
            content: "Hello! I'm your AI assistant powered by WebLLM. How can I help you today?",
            isUser: false,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } catch (error) {
        console.error("Failed to initialize WebLLM:", error);
        setError("Failed to initialize WebLLM. Please refresh the page and ensure you have enough memory available.");
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const handleSendMessage = async (content: string) => {
    if (isLoading) return;

    const newMessage: Message = {
      id: messages.length + 1,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, newMessage]);

    // Create a placeholder message for the bot's response
    const botMessageId = messages.length + 2;
    setMessages((prev) => [
      ...prev,
      {
        id: botMessageId,
        content: "",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    
    try {
      setError(null);
      await getBotResponse(content, messages, {
        onProgress: (content) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, content } : msg
            )
          );
        },
      });
    } catch (error) {
      console.error("Error getting bot response:", error);
      setError("Failed to generate response. Please try again.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: "Sorry, I encountered an error. Please try again." }
            : msg
        )
      );
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <p className="text-lg font-medium">{initStatus}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {error && (
        <div className="bg-red-50 p-4">
          <p className="text-red-600 text-center">{error}</p>
        </div>
      )}
      <div className="flex-1 overflow-hidden" ref={scrollRef}>
        <ScrollArea className="h-full px-4">
          <div className="max-w-3xl mx-auto py-6">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message.content}
                isUser={message.isUser}
                timestamp={message.timestamp}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}
