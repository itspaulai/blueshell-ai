
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { initializeWorker, generateResponse, type Message, type ModelStatus } from "@/lib/chat";

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 1,
    content: "Hello! How can I help you today?",
    isUser: false,
    timestamp: new Date().toLocaleTimeString()
  }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, currentResponse]);

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: messages.length + 1,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setMessages(prev => [...prev, userMessage]);

    if (!modelStatus) {
      initializeWorker(
        setModelStatus,
        (text) => setCurrentResponse(text),
        () => {
          setMessages(prev => [...prev, {
            id: prev.length + 1,
            content: currentResponse,
            isUser: false,
            timestamp: new Date().toLocaleTimeString()
          }]);
          setCurrentResponse("");
          setIsGenerating(false);
        }
      );
      setModelStatus({ status: 'loading' });
    } else if (modelStatus.status === 'ready') {
      setIsGenerating(true);
      generateResponse([...messages, userMessage]);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4" ref={scrollRef}>
          <div className="max-w-3xl mx-auto py-6 space-y-4">
            {messages.map((message) => (
              <ChatBubble 
                key={message.id} 
                message={message.content} 
                isUser={message.isUser}
                timestamp={message.timestamp}
              />
            ))}
            {modelStatus && (
              <div className="text-center text-gray-500 text-sm">
                {modelStatus.status === 'loading' && (
                  <p>{modelStatus.data || 'Loading model...'}</p>
                )}
                {modelStatus.status === 'progress' && modelStatus.file && (
                  <p>Downloading {modelStatus.file}... {modelStatus.progress}%</p>
                )}
                {modelStatus.status === 'error' && (
                  <p className="text-red-500">{modelStatus.data}</p>
                )}
              </div>
            )}
            {currentResponse && (
              <ChatBubble 
                message={currentResponse} 
                isUser={false}
                timestamp={new Date().toLocaleTimeString()}
              />
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
