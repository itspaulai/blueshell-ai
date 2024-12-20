
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';

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
          <p className="text-base whitespace-pre-wrap">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-base text-foreground pr-8 prose prose-sm prose-p:my-1 dark:prose-invert max-w-none">
        <ReactMarkdown>
          {message}
        </ReactMarkdown>
      </div>
    </div>
  );
}
