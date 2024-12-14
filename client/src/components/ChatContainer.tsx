
import { useState, useRef, useEffect } from "react";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import type { Message } from "@/lib/chat";

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<{file?: string; progress?: number; total?: number}>({});
  const worker = useRef<Worker | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    worker.current = new Worker(new URL('../lib/worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.current.onmessage = (e) => {
      const { status, data, output, file, progress, total } = e.data;

      switch (status) {
        case "loading":
          setModelStatus(data);
          break;
        case "initiate":
        case "progress":
          setProgress({ file, progress, total });
          break;
        case "ready":
          setModelStatus(null);
          setIsLoading(false);
          break;
        case "update":
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length && !newMessages[newMessages.length - 1].isUser) {
              newMessages[newMessages.length - 1].content = output;
            } else {
              newMessages.push({
                id: Date.now(),
                content: output,
                isUser: false,
                timestamp: new Date().toISOString()
              });
            }
            return newMessages;
          });
          break;
        case "error":
          setModelStatus(`Error: ${data}`);
          setIsLoading(false);
          break;
      }
    };

    return () => worker.current?.terminate();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      content,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    setIsLoading(true);

    if (messages.length === 0) {
      worker.current?.postMessage({ type: "load" });
    }

    const chatHistory = messages.map(msg => ({
      role: msg.isUser ? "user" : "assistant",
      content: msg.content
    }));

    chatHistory.push({ role: "user", content });

    worker.current?.postMessage({
      type: "generate",
      data: chatHistory
    });
  };

  return (
    <div className="flex-1 flex flex-col max-h-screen overflow-hidden bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {modelStatus && (
          <div className="text-center text-gray-500 text-sm">
            {modelStatus}
            {progress.file && (
              <div>
                Downloading {progress.file}... 
                {progress.progress && progress.total && (
                  <span>{Math.round((progress.progress / progress.total) * 100)}%</span>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-gray-200 p-4">
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
