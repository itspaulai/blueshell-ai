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

import { ModelType, MODEL_CONFIGS } from "../types/model";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export function ChatContainer({ conversationId, onFirstMessage }: ChatContainerProps) {
  const handleModelChange = async (type: ModelType) => {
    const config = MODEL_CONFIGS[type];
    localStorage.setItem('selectedModel', config.modelName);
    await reinitializeEngine(config.modelName);
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null);

  const {
    sendMessage,
    isModelLoaded,
    loadingProgress,
    isGenerating,
    interruptGeneration,
    messageHistory,
    setMessageHistory,
    reinitializeEngine,
    isModelLoading,
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
      // If no conversation yet, handle the first message
      setPendingMessage(userMessage);
      currentId = await onFirstMessage(content);
      if (!currentId) return;

      // Now that we have the conversation ID, store in DB
      await chatDB.updateConversation(currentId, [userMessage], undefined, true);
      setPendingMessage(null);
      setMessages([userMessage]);
    } else {
      // Otherwise, just add to existing conversation
      setMessages((prev) => [...prev, userMessage]);
      if (currentId) {
        await chatDB.updateConversation(currentId, [...messages, userMessage], undefined, true);
      }
    }

    // Also push to LLM's messageHistory
    setMessageHistory((prev) => [
      ...prev,
      { role: "user", content } // Enough info for the LLM
    ]);

    // Prepare a placeholder bot message
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
        setMessages((prev) =>
          prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: fullMessage } : msg))
        );
        scrollToBottom();
      }

      // Once final text is ready, append to messageHistory
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

  // -- LOAD conversation from DB & sync with LLM context
  useEffect(() => {
    const loadConversation = async () => {
      if (conversationId) {
        const conversation = await chatDB.getConversation(conversationId);
        if (conversation) {
          setMessages(conversation.messages);

          // Map DB messages to { role, content } for LLM
          const loadedHistory: Array<{ role: "system" | "user" | "assistant"; content: string }> =
            conversation.messages.map((m) => ({
              role: m.isUser ? ("user" as const) : ("assistant" as const),
              content: m.content,
            }));

          // Keep system message if already present
          setMessageHistory((prev) => {
            const systemMsg = prev.find((msg) => msg.role === "system");
            return systemMsg ? [systemMsg, ...loadedHistory] : loadedHistory;
          });
        }
      } else {
        // If it's a new chat or no conversation
        if (!pendingMessage) {
          setMessages([]);
          // Reset LLM context to just system (if you want a default system prompt)
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

  // Auto-scroll logic
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
      <div className="px-4 py-2 border-b">
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-2 rounded-lg text-left hover:bg-gray-50 flex flex-col"
                disabled={isModelLoading}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium">
                    {MODEL_CONFIGS[Object.entries(MODEL_CONFIGS).find(
                      ([_, config]) => config.modelName === localStorage.getItem('selectedModel')
                    )?.[0] as ModelType]?.displayName || MODEL_CONFIGS.basic.displayName}
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {Object.entries(MODEL_CONFIGS).map(([type, config]) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => handleModelChange(type as ModelType)}
                  disabled={isModelLoading}
                  className="flex flex-col items-start py-1.5"
                >
                  <div className="font-medium leading-tight">{config.displayName}</div>
                  <div className="text-sm text-gray-500 leading-tight">{config.description}</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4" ref={contentRef}>
        <div className="max-w-3xl mx-auto py-6">
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
