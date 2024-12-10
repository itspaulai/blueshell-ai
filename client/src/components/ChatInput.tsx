import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperclipIcon, SendIcon } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#f1f4f9] px-2 h-12">
        <Button type="button" variant="ghost" size="icon" className="h-12 w-12">
          <PaperclipIcon className="h-8 w-8" />
          <span className="sr-only">Attach file</span>
        </Button>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent h-12 text-base"
        />
      </div>
      <Button type="submit" size="icon" disabled={!message.trim()} className="h-12 w-12">
        <SendIcon className="h-6 w-6" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}
