
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp: string;
}

export function ChatBubble({ message, isUser }: ChatBubbleProps) {
  if (isUser) {
    return (
      <div className="mb-8 flex justify-end animate-in fade-in slide-in-from-bottom-4">
        <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-primary text-primary-foreground">
          <p className="text-base">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
      <p className="text-base text-foreground pr-8">{message}</p>
    </div>
  );
}
