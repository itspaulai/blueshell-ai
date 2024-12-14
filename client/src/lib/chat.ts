
import { Worker } from 'web-workers';

export interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

export interface ModelStatus {
  status: 'loading' | 'progress' | 'ready' | 'error';
  data?: string;
  file?: string;
  progress?: number;
  total?: number;
}

let worker: Worker | null = null;

export function initializeWorker(
  onStatus: (status: ModelStatus) => void,
  onUpdate: (text: string) => void,
  onComplete: () => void
) {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url));
    
    worker.onmessage = (e) => {
      const { status, data, output, file, progress, total } = e.data;
      
      if (status === 'update' && output) {
        onUpdate(output);
      } else if (status === 'complete') {
        onComplete();
      } else {
        onStatus({ status, data, file, progress, total });
      }
    };
  }
  return worker;
}

export function generateResponse(messages: Message[]) {
  if (!worker) return;
  
  worker.postMessage({
    type: 'generate',
    data: messages.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content
    }))
  });
}

export function resetWorker() {
  if (!worker) return;
  worker.postMessage({ type: 'reset' });
}
