import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperclipIcon, SendIcon, Loader2 } from "lucide-react";
import { useWebLLM } from "@/lib/WebLLMContext";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export function ChatInput({ onSend, onStop, disabled, isGenerating }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { initializePDFContext, isPDFLoading, isModelLoaded, loadingProgress } = useWebLLM();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isGenerating) {
      onSend(message);
      setMessage("");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      try {
        await initializePDFContext(file);
      } catch (error) {
        console.error("Error processing PDF:", error);
      }
    } else if (file) {
      console.error("Please select a PDF file");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#f1f4f9] px-2 h-12">
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPDFLoading}
        >
          {isPDFLoading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <PaperclipIcon className="h-7 w-7" />
          )}
          <span className="sr-only">Attach PDF file</span>
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isPDFLoading ? "Loading PDF..." : !isModelLoaded ? "Loading model..." : "Type your message..."}
          className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent h-12 text-base"
          disabled={isPDFLoading || !isModelLoaded}
          autoFocus
        />
      </div>
      {isGenerating ? (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          onClick={onStop}
          className="h-12 w-12 bg-red-500 hover:bg-red-600"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="sr-only">Stop generating</span>
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!message.trim() || disabled} className="h-12 w-12">
          <SendIcon className="h-6 w-6" />
          <span className="sr-only">Send message</span>
        </Button>
      )}
    </form>
  );
}
