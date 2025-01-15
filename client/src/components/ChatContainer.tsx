import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { useWebLLM } from "@/lib/WebLLMContext";
import { chatDB } from "@/lib/db";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";

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

type ModelType = "basic" | "smart";

export function ChatContainer({ conversationId, onFirstMessage }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelType>("smart");
  const [isModelSwitching, setIsModelSwitching] = useState(false);

  const {
    sendMessage,
    isModelLoaded,
    loadingProgress,
    isGenerating,
    interruptGeneration,
    messageHistory,
    setMessageHistory,
    initializeEngine,
  } = useWebLLM();

  const contentRef = useRef<HTMLDivElement>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    // Initialize the default model (smart) on component mount
    initializeEngine("smart");
  }, [initializeEngine]);

  const handleModelChange = async (value: ModelType) => {
    if (value !== selectedModel && !isModelSwitching) {
      try {
        setIsModelSwitching(true);
        setSelectedModel(value);
        await initializeEngine(value);
      } catch (error) {
        console.error('Error switching model:', error);
        // Revert to previous model on error
        setSelectedModel(selectedModel);
      } finally {
        setIsModelSwitching(false);
      }
    }
  };

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

    setMessageHistory((prev) => [
      ...prev,
      { role: "user", content }
    ]);

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

          const loadedHistory: Array<{ role: "system" | "user" | "assistant"; content: string }> =
            conversation.messages.map((m) => ({
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

  const displayMessages = messages;

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-3xl mx-auto">
          <RadioGroup
            value={selectedModel}
            onValueChange={(value) => handleModelChange(value as ModelType)}
            className="flex gap-4"
            defaultValue="smart"
            disabled={isModelSwitching || isGenerating}
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="basic" id="basic" />
              <Label htmlFor="basic" className="flex flex-col cursor-pointer">
                <span className="font-medium">Basic AI model</span>
                <span className="text-sm text-muted-foreground">Faster responses</span>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="smart" id="smart" />
              <Label htmlFor="smart" className="flex flex-col cursor-pointer">
                <span className="font-medium">Smarter AI model</span>
                <span className="text-sm text-muted-foreground">Thoughtful responses</span>
              </Label>
            </div>
          </RadioGroup>
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
          {(!isModelLoaded || isModelSwitching) && loadingProgress && (
            <div className="text-sm text-muted-foreground">{loadingProgress}</div>
          )}
        </div>
      </div>
      <div className="bg-white p-6">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={handleSendMessage}
            onStop={interruptGeneration}
            disabled={isGenerating || isModelSwitching || !isModelLoaded}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}