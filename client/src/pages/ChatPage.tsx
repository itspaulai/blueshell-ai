import { useState, useRef, useEffect } from "react";
import { ChatContainer } from "@/components/ChatContainer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlusIcon, ChevronDownIcon, HelpCircleIcon, MessageCircleIcon } from "lucide-react";

declare global {
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<any>;
    };
  }
}

const IS_WEBGPU_AVAILABLE = !!(typeof navigator !== 'undefined' && navigator.gpu);

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const worker = useRef<Worker | null>(null);
  
  // Model loading and progress
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progressItems, setProgressItems] = useState<Array<{file: string; progress: number; total: number}>>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [tps, setTps] = useState<number | null>(null);
  const [numTokens, setNumTokens] = useState<number | null>(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("../worker.js", import.meta.url), {
        type: "module",
      });
      worker.current.postMessage({ type: "check" }); // Check WebGPU support
    }

    const onMessageReceived = (e: MessageEvent) => {
      switch (e.data.status) {
        case "loading":
          setStatus("loading");
          setLoadingMessage(e.data.data);
          break;

        case "initiate":
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data };
              }
              return item;
            }),
          );
          break;

        case "done":
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file),
          );
          break;

        case "ready":
          setStatus("ready");
          break;

        case "start":
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "" },
          ]);
          break;

        case "update":
          const { output, tps, numTokens } = e.data;
          setTps(tps);
          setNumTokens(numTokens);
          setMessages((prev) => {
            const cloned = [...prev];
            const last = cloned.at(-1);
            cloned[cloned.length - 1] = {
              ...last,
              content: last.content + output,
            };
            return cloned;
          });
          break;

        case "complete":
          setIsRunning(false);
          break;

        case "error":
          setError(e.data.data);
          break;
      }
    };

    const onErrorReceived = (e: ErrorEvent) => {
      console.error("Worker error:", e);
    };

    worker.current.addEventListener("message", onMessageReceived);
    worker.current.addEventListener("error", onErrorReceived);

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
      worker.current?.removeEventListener("error", onErrorReceived);
    };
  }, []);

  // Load model when first message is sent
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "user" && status === null) {
      worker.current?.postMessage({ type: "load" });
      setStatus("loading");
    }
  }, [messages, status]);

  // Generate response when messages change
  useEffect(() => {
    if (messages.filter((x) => x.role === "user").length === 0) {
      return;
    }
    if (messages.at(-1)?.role === "assistant") {
      return;
    }
    if (status !== "ready") {
      return;
    }
    setTps(null);
    worker.current?.postMessage({ type: "generate", data: messages });
    setIsRunning(true);
  }, [messages, status]);

  if (!IS_WEBGPU_AVAILABLE) {
    return (
      <div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">
        WebGPU is not supported<br/>by this browser :&#40;
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className={`${
        isSidebarOpen ? "w-[260px]" : "w-[60px]"
      } bg-[#f1f4f9] p-4 flex flex-col transition-all duration-300 ease-in-out`}>
        <div className="flex items-center justify-between mb-4">
          <h1 className={`text-xl font-semibold pl-3 ${!isSidebarOpen && "hidden"}`}>Blueshell</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${isSidebarOpen ? "rotate-90" : "-rotate-90"}`} />
          </Button>
        </div>
        <Button 
          className={`flex gap-2 mb-4 ${!isSidebarOpen && "px-0 justify-center"}`}
          onClick={() => {
            setMessages([]);
            worker.current?.postMessage({ type: "reset" });
          }}
        >
          <PlusIcon className="h-4 w-4" />
          {isSidebarOpen && "New chat"}
        </Button>
        <div className="flex-1">
          {isSidebarOpen && <h2 className="text-sm font-medium text-muted-foreground mb-2 pl-3">Recent</h2>}
          <div className="space-y-1">
            {isSidebarOpen ? (
              <>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 relative top-0" />
                  Newsletter
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 relative top-0" />
                  Build Modern Chatbot
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 relative top-0" />
                  Create Modern Tortoise App
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" className={`${!isSidebarOpen && "px-0 justify-center"} gap-2`}>
          <HelpCircleIcon className="h-4 w-4" />
          {isSidebarOpen && "Help"}
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {status === "loading" && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 z-50 flex items-center justify-center">
            <div className="w-full max-w-[500px] p-4">
              <p className="text-center mb-4 text-lg font-medium">{loadingMessage}</p>
              {progressItems.map(({ file, progress, total }, i) => (
                <div key={i} className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">{file}</span>
                    <span className="text-sm">{Math.round((progress / total) * 100)}%</span>
                  </div>
                  <Progress value={(progress / total) * 100} />
                </div>
              ))}
            </div>
          </div>
        )}
        <ChatContainer 
          messages={messages}
          isLoading={isRunning}
          onSendMessage={(message) => {
            setMessages((prev) => [...prev, { role: "user", content: message }]);
          }}
          onReset={() => {
            setMessages([]);
            worker.current?.postMessage({ type: "reset" });
          }}
        />
      </div>
    </div>
  );
}