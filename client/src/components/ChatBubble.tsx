
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      <div className="prose prose-sm dark:prose-invert max-w-none text-base text-foreground pr-8">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
            pre: ({node, ...props}) => (
              <pre className="bg-muted p-2 rounded-md overflow-x-auto" {...props} />
            ),
            code: ({ className, children, node, ...props }: Components['code']) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              return isInline ? (
                <code className="bg-muted px-1 py-0.5 rounded-sm" {...props}>{children}</code>
              ) : (
                <code className={className} {...props}>{children}</code>
              );
            },
            ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            blockquote: ({node, ...props}) => (
              <blockquote className="border-l-2 border-muted pl-4 italic" {...props} />
            ),
          }}
        >
          {message}
        </ReactMarkdown>
      </div>
    </div>
  );
}
