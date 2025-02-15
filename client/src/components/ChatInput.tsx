import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperclipIcon, SendIcon, Loader2, FileMinus2 } from "lucide-react";
import { useWebLLM } from "@/lib/WebLLMContext";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
}

export function ChatInput({ onSend, onStop, disabled, isGenerating }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { initializePDFContext, isPDFLoading, unloadPDF } = useWebLLM();

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
        setUploadedFile(file.name);
      } catch (error) {
        console.error("Error processing PDF:", error);
        setUploadedFile(null);
      }
    } else if (file) {
      console.error("Please select a PDF file");
      setUploadedFile(null);
    }
  };

  const handleUnloadPDF = () => {
    unloadPDF();
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {uploadedFile && (
        <div className="text-sm text-muted-foreground px-4 text-center">
          Uploaded: {uploadedFile}
        </div>
      )}
      <div className="flex items-center gap-2">
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
            className={`h-10 w-10 hover:bg-[#e9eef6] transition-colors ${uploadedFile ? 'hover:bg-blue-100' : ''}`}
            onClick={() => uploadedFile ? handleUnloadPDF() : fileInputRef.current?.click()}
            disabled={isPDFLoading}
          >
            {isPDFLoading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : uploadedFile ? (
              <FileMinus2 className="h-7 w-7 text-blue-700" />
            ) : (
              <PaperclipIcon className="h-7 w-7" />
            )}
            <span className="sr-only">
              {uploadedFile ? "Remove PDF file" : "Attach PDF file"}
            </span>
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isPDFLoading ? "Loading PDF..." : "Type your message..."}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent h-12 text-base"
            disabled={isPDFLoading}
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
      </div>
    </form>
  );
}