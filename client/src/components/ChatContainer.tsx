import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { useWebLLM } from "@/lib/WebLLMContext";
import { chatDB } from "@/lib/db";

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatContainerProps {
  conversationId?: number;
  onFirstMessage: (content: string) => Promise<number | undefined>;
}

export function ChatContainer({ conversationId, onFirstMessage }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);

  const { sendMessage, isModelLoaded, loadingProgress, isGenerating, interruptGeneration } = useWebLLM();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

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

  /**
   * Modified handleSendMessage to prevent adding the first message again
   */
  const handleSendMessage = async (content: string) => {
    const isFirstMessage = !conversationId;
    let currentId = conversationId;

    if (isFirstMessage) {
      currentId = await onFirstMessage(content);
      if (!currentId) return;
    }

    const newMessageId = Date.now();
    const userMessage: Message = {
      id: newMessageId,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (!isFirstMessage) {
      setMessages((prev) => [...prev, userMessage]);
    }

    if (currentId) {
      if (isFirstMessage) {
        // The first message is already added in handleFirstMessage
      } else {
        await chatDB.updateConversation(currentId, [...messages, userMessage], undefined, true);
      }
    }

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
    const loadConversation = async () => {
      if (conversationId) {
        const conversation = await chatDB.getConversation(conversationId);
        if (conversation) {
          setMessages(conversation.messages);
        }
      } else {
        setMessages([]);
      }
    };
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      const updateTimestamp = messages[messages.length - 1].timestamp === new Date().toLocaleTimeString();
      chatDB.updateConversation(conversationId, messages, undefined, updateTimestamp);
    }
    scrollToBottom();
  }, [messages, currentResponse, conversationId]);

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
          {messages.length === 0 && (
            <div className="flex justify-center items-center h-[calc(100vh-200px)]">
              <span className="text-4xl font-bold text-blue-500">Hello</span>
            </div>
          )}
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
            disabled={isGenerating} 
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}