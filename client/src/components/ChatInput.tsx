
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperclipIcon, SendIcon } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdfUtils";
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
  const { setPdfContent } = useWebLLM();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      try {
        const text = await extractTextFromPDF(file);
        setPdfContent(text);
        onSend(`I just uploaded a PDF file named "${file.name}". Please analyze its content.`);
      } catch (error) {
        console.error("Error processing PDF:", error);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#f1f4f9] px-2 h-12">
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileUpload}
          ref={fileInputRef}
        />
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10"
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon className="h-7 w-7" />
          <span className="sr-only">Attach PDF</span>
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent h-12 text-base"
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
