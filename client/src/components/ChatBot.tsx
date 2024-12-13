import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const worker = useRef<Worker | null>(null);
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("../lib/worker.js", import.meta.url), {
        type: "module",
      });
      worker.current.postMessage({ type: "check" });
    }

    const onMessageReceived = (e: MessageEvent) => {
      const { status, data } = e.data;

      switch (status) {
        case "loading":
          toast({
            title: "Loading Model",
            description: data
          });
          break;
        case "ready":
          setIsLoading(false);
          toast({
            title: "Model Ready",
            description: "You can now start chatting!"
          });
          break;
        case "error":
          toast({
            title: "Error",
            description: data,
            variant: "destructive"
          });
          break;
        case "start":
          setMessages(prev => [...prev, { role: "assistant", content: "" }]);
          break;
        case "update":
          setMessages(prev => {
            const newMessages = [...prev];
            const last = newMessages[newMessages.length - 1];
            if (last.role === "assistant") {
              last.content += e.data.output;
            }
            return newMessages;
          });
          break;
        case "complete":
          setIsGenerating(false);
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);
    worker.current.postMessage({ type: "load" });

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, []);

  const handleSubmit = async (content: string) => {
    if (!content.trim() || isGenerating) return;

    setMessages(prev => [...prev, { role: "user", content }]);
    setInput("");
    setIsGenerating(true);
    worker.current?.postMessage({ 
      type: "generate", 
      data: [...messages, { role: "user", content }]
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>
      
      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(input);
              }
            }}
            placeholder={isLoading ? "Loading model..." : "Type a message..."}
            disabled={isLoading || isGenerating}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={isLoading || isGenerating || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 hover:bg-blue-600"
          >
            {isGenerating ? "Generating..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
