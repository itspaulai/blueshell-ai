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
  onConversationCreated?: (id: number) => void;
}

export function ChatContainer({ conversationId, onConversationCreated }: ChatContainerProps) {
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

  const handleSendMessage = async (content: string) => {
    try {
      let activeConversationId = conversationId;
      const isNewChat = !activeConversationId;

      // Create new conversation only when sending the first message
      if (isNewChat) {
        activeConversationId = await chatDB.createConversation();
        if (!activeConversationId) {
          throw new Error('Failed to create new conversation');
        }
        onConversationCreated?.(activeConversationId);
      }

      const newMessageId = Date.now();
      const userMessage: Message = {
        id: newMessageId,
        content,
        isUser: true,
        timestamp: new Date().toLocaleTimeString(),
      };

      // Update messages state with user message
      setMessages(prevMessages => [...prevMessages, userMessage]);

      // Update conversation in DB
      if (isNewChat) {
        const title = content.split(' ').slice(0, 5).join(' ');
        await chatDB.updateConversation(activeConversationId, [userMessage], title, true);
      } else if (activeConversationId) {
        await chatDB.updateConversation(activeConversationId, [...messages, userMessage], undefined, true);
      }

      const botMessageId = newMessageId + 1;
      const initialBotMessage: Message = {
        id: botMessageId,
        content: isModelLoaded ? "" : "Loading AI model...",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };

      // Add initial bot message to UI
      setMessages(prevMessages => [...prevMessages, initialBotMessage]);

      const response = await sendMessage(content);
      if (!response) return;

      let fullMessage = "";
      for await (const chunk of response) {
        fullMessage += chunk.choices[0]?.delta?.content || "";

        // Update messages state with new content
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === botMessageId ? { ...msg, content: fullMessage } : msg
          )
        );

        setShouldAutoScroll(true);
        scrollToBottom();
      }

      // Get the final messages state and update DB
      if (activeConversationId) {
        const updatedMessages = [...messages, userMessage, { ...initialBotMessage, content: fullMessage }];
        await chatDB.updateConversation(activeConversationId, updatedMessages, undefined, true);
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      const errorMessage: Message = {
        id: Date.now(),
        content: "I apologize, but I encountered an error. Please try again.",
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);

      // Update conversation with error message if we have an active conversation
      if (conversationId) {
        await chatDB.updateConversation(conversationId, [...messages, errorMessage], undefined, true);
      }
    }
  };

  useEffect(() => {
    const loadConversation = async () => {
      if (conversationId) {
        const conversation = await chatDB.getConversation(conversationId);
        if (conversation) {
          setMessages(conversation.messages);
        } else {
          setMessages([]);
        }
      } else {
        // Clear messages for new chat
        setMessages([]);
      }
    };
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
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