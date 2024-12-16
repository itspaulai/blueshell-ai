import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { chatModel, type Message, type InitProgress } from "@/lib/chat";

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: "Hello! I'm your AI assistant. Send me a message to start our conversation.",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [modelStatus, setModelStatus] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (content: string) => {
    const newMessage: Message = {
      id: messages.length + 1,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, newMessage]);

    // Initialize model if this is the first message
    if (!modelStatus && messages.length === 1) {
      setModelStatus("Starting up the AI assistant...");
      
      // Set up progress callback
      chatModel.setProgressCallback((progress: InitProgress) => {
        setModelStatus(progress.text);
      });
      
      await chatModel.initialize();
      setModelStatus("");
    }

    // Create a placeholder message for the streaming response
    const responsePlaceholder: Message = {
      id: messages.length + 2,
      content: "",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, responsePlaceholder]);
    setIsGenerating(true);

    try {
      const stream = await chatModel.generateResponse([...messages, newMessage]);
      let streamedContent = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        streamedContent += content;
        setMessages((prev) => prev.map((msg) => 
          msg.id === responsePlaceholder.id
            ? { ...msg, content: streamedContent }
            : msg
        ));
      }
    } catch (error) {
      console.error("Error generating response:", error);
      setMessages((prev) => prev.map((msg) => 
        msg.id === responsePlaceholder.id
          ? { ...msg, content: "I apologize, but I encountered an error while generating a response. Please try again." }
          : msg
      ));
    } finally {
      setIsGenerating(false);
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
            {modelStatus && (
              <div className="text-sm text-blue-500 animate-pulse mb-4">
                {modelStatus}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput 
            onSend={handleSendMessage} 
            isLoading={!!modelStatus || isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
