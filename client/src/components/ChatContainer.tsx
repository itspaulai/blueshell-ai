import { useEffect, useRef, useState } from "react";
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
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null);
  const [selectedModel, setSelectedModel] = useState("basic"); // Added model selector state

  const {
    sendMessage,
    isModelLoaded,
    loadingProgress,
    isGenerating,
    interruptGeneration,
    messageHistory,
    setMessageHistory,
  } = useWebLLM();

  const contentRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollToBottom = () => {
    if (contentRef.current && shouldAutoScroll) {
      const scrollContainer = contentRef.current;
      const shouldSmoothScroll =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight > 500;
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: shouldSmoothScroll ? "smooth" : "auto",
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    const isFirstMessage = !conversationId;
    let currentId = conversationId;

    const newMessageId = Date.now();
    const userMessage: Message = {
      id: newMessageId,
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (isFirstMessage) {
      setPendingMessage(userMessage);
      currentId = await onFirstMessage(content);
      if (!currentId) return;
      await chatDB.updateConversation(currentId, [userMessage], undefined, true);
      setPendingMessage(null);
      setMessages([userMessage]);
    } else {
      setMessages((prev) => [...prev, userMessage]);
      if (currentId) {
        await chatDB.updateConversation(currentId, [...messages, userMessage], undefined, true);
      }
    }

    setMessageHistory((prev) => [...prev, { role: "user", content }]);

    const botMessageId = newMessageId + 1;
    const initialBotMessage: Message = {
      id: botMessageId,
      content: isModelLoaded ? "" : "Loading AI model...",
      isUser: false,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, initialBotMessage]);

    try {
      const response = await sendMessage(content, selectedModel); // Pass selectedModel
      if (!response) return;

      let fullMessage = "";
      for await (const chunk of response) {
        fullMessage += chunk.choices[0]?.delta?.content || "";
        setMessages((prev) =>
          prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: fullMessage } : msg))
        );
        scrollToBottom();
      }

      setMessageHistory((prev) => [...prev, { role: "assistant", content: fullMessage }]);

    } catch (error) {
      console.error("Error generating response:", error);
      const errorMessage: Message = {
        id: Date.now(),
        content: "I encountered an error. Please try again later.",
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
          const loadedHistory = conversation.messages.map((m) => ({
            role: m.isUser ? ("user" as const) : ("assistant" as const),
            content: m.content,
          }));
          setMessageHistory((prev) => {
            const systemMsg = prev.find((msg) => msg.role === "system");
            return systemMsg ? [systemMsg, ...loadedHistory] : loadedHistory;
          });
        }
      } else {
        if (!pendingMessage) {
          setMessages([]);
          setMessageHistory((prev) => {
            const systemMsg = prev.find((msg) => msg.role === "system");
            return systemMsg ? [systemMsg] : [];
          });
        }
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
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const displayMessages = pendingMessage ? [pendingMessage, ...messages] : messages;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto px-4" ref={contentRef}>
        <div className="max-w-3xl mx-auto py-6">
          <div className="mb-4"> {/* Added Model Selector */}
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              <option value="basic">Basic AI model (faster)</option>
              <option value="smart">Smarter AI model (slower)</option>
            </select>
          </div>
          {displayMessages.length === 0 && (
            <div className="flex justify-center items-center h-[calc(100vh-200px)]">
              <span className="text-4xl font-bold text-blue-500">Hello</span>
            </div>
          )}
          {displayMessages.map((message) => (
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
            <div className="text-sm text-muted-foreground">{loadingProgress}</div>
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