import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import ArrowRightIcon from "./icons/ArrowRightIcon";
import StopIcon from "./icons/StopIcon";

const EXAMPLES = [
  "Give me some tips to improve my time management skills.",
  "What is the difference between AI and ML?",
  "Write python code to compute the nth fibonacci number.",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const worker = useRef<Worker | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Model loading and progress
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progressItems, setProgressItems] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Inputs and outputs
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tps, setTps] = useState<number | null>(null);
  const [numTokens, setNumTokens] = useState<number | null>(null);

  function onEnter(message: string) {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setTps(null);
    setIsRunning(true);
    setInput("");
  }

  function onInterrupt() {
    worker.current?.postMessage({ type: "interrupt" });
  }

  useEffect(() => {
    resizeInput();
  }, [input]);

  function resizeInput() {
    if (!textareaRef.current) return;
    const target = textareaRef.current;
    target.style.height = "auto";
    const newHeight = Math.min(Math.max(target.scrollHeight, 24), 200);
    target.style.height = `${newHeight}px`;
  }

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("../lib/worker.js", import.meta.url), {
        type: "module",
      });
      worker.current.postMessage({ type: "load" });
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
            if (last && last.role === "assistant") {
              last.content += output;
            }
            return cloned;
          });
          break;

        case "complete":
          setIsRunning(false);
          break;

        case "error":
          setError(e.data.data);
          toast({
            variant: "destructive",
            title: "Error",
            description: e.data.data,
          });
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, []);

  useEffect(() => {
    if (messages.filter((x) => x.role === "user").length === 0) {
      return;
    }
    if (messages.at(-1)?.role === "assistant") {
      return;
    }
    setTps(null);
    worker.current?.postMessage({ type: "generate", data: messages });
  }, [messages, isRunning]);

  const STICKY_SCROLL_THRESHOLD = 120;

  useEffect(() => {
    if (!chatContainerRef.current || !isRunning) return;
    const element = chatContainerRef.current;
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICKY_SCROLL_THRESHOLD
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isRunning]);

  return (
    <div className="flex flex-col h-screen mx-auto items justify-end text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900">
      {status === null && messages.length === 0 && (
        <div className="h-full overflow-auto scrollbar-thin flex justify-center items-center flex-col relative">
          <div className="flex flex-col items-center mb-1 max-w-[300px] text-center">
            <h1 className="text-4xl font-bold mb-1">Llama Chat</h1>
            <h2 className="font-semibold">
              A private and powerful AI chatbot
              <br />
              that runs locally in your browser.
            </h2>
          </div>

          <div className="flex flex-col items-center px-4">
            <p className="max-w-[514px] mb-4">
              <br />
              You are about to load{" "}
              <a
                href="https://huggingface.co/onnx-community/Llama-3.2-3B-Instruct"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Llama-3.2-3B-Instruct
              </a>
              , a powerful language model optimized for inference on the web.
              Once downloaded, the model will be cached and reused when you revisit the page.
              <br />
              <br />
              Everything runs directly in your browser using{" "}
              <a
                href="https://huggingface.co/docs/transformers.js"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                🤗&nbsp;Transformers.js
              </a>{" "}
              and ONNX Runtime Web, meaning your conversations aren&#39;t sent
              to a server.
            </p>

            {error && (
              <div className="text-red-500 text-center mb-2">
                <p className="mb-1">
                  Unable to load model due to the following error:
                </p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              className="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none"
              onClick={() => {
                worker.current?.postMessage({ type: "load" });
                setStatus("loading");
              }}
              disabled={status !== null || error !== null}
            >
              Load model
            </button>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="w-full max-w-[500px] text-left mx-auto p-4 bottom-0 mt-auto">
          <p className="text-center mb-1">{loadingMessage}</p>
          {progressItems.map(({ file, progress, total }, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{file}</span>
                <span>{Math.round((progress / total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${(progress / total) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "ready" && (
        <div
          ref={chatContainerRef}
          className="overflow-y-auto scrollbar-thin w-full flex flex-col items-center h-full"
        >
          <div className="w-full max-w-3xl p-4 space-y-4">
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
          
          {messages.length === 0 && (
            <div>
              {EXAMPLES.map((msg, i) => (
                <div
                  key={i}
                  className="m-1 border dark:border-gray-600 rounded-md p-2 bg-gray-100 dark:bg-gray-700 cursor-pointer"
                  onClick={() => onEnter(msg)}
                >
                  {msg}
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-sm min-h-6 text-gray-500 dark:text-gray-300">
            {tps && messages.length > 0 && (
              <>
                {!isRunning && (
                  <span>
                    Generated {numTokens} tokens in{" "}
                    {(numTokens! / tps).toFixed(2)} seconds&nbsp;&#40;
                  </span>
                )}
                {
                  <>
                    <span className="font-medium text-center mr-1 text-black dark:text-white">
                      {tps.toFixed(2)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-300">
                      tokens/second
                    </span>
                  </>
                }
                {!isRunning && (
                  <>
                    <span className="mr-1">&#41;.</span>
                    <span
                      className="underline cursor-pointer"
                      onClick={() => {
                        worker.current?.postMessage({ type: "reset" });
                        setMessages([]);
                      }}
                    >
                      Reset
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-2 border dark:bg-gray-700 rounded-lg w-[600px] max-w-[80%] max-h-[200px] mx-auto relative mb-3 flex">
        <textarea
          ref={textareaRef}
          className="scrollbar-thin w-[550px] dark:bg-gray-700 px-3 py-4 rounded-lg bg-transparent border-none outline-none text-gray-800 disabled:text-gray-400 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 disabled:placeholder-gray-200 resize-none disabled:cursor-not-allowed"
          placeholder="Type your message..."
          value={input}
          disabled={status !== "ready"}
          title={status === "ready" ? "Model is ready" : "Model not loaded yet"}
          onKeyDown={(e) => {
            if (
              input.length > 0 &&
              !isRunning &&
              e.key === "Enter" &&
              !e.shiftKey
            ) {
              e.preventDefault();
              onEnter(input);
            }
          }}
          onChange={(e) => setInput(e.target.value)}
        />
        {isRunning ? (
          <div className="cursor-pointer" onClick={onInterrupt}>
            <StopIcon className="h-8 w-8 p-1 rounded-md text-gray-800 dark:text-gray-100 absolute right-3 bottom-3" />
          </div>
        ) : input.length > 0 ? (
          <div className="cursor-pointer" onClick={() => onEnter(input)}>
            <ArrowRightIcon
              className="h-8 w-8 p-1 bg-gray-800 dark:bg-gray-100 text-white dark:text-black rounded-md absolute right-3 bottom-3"
            />
          </div>
        ) : (
          <div>
            <ArrowRightIcon
              className="h-8 w-8 p-1 bg-gray-200 dark:bg-gray-600 text-gray-50 dark:text-gray-800 rounded-md absolute right-3 bottom-3"
            />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center mb-3">
        Disclaimer: Generated content may be inaccurate or false.
      </p>
    </div>
  );
}
