export interface Message {
  id: number;
  content: string;
  isUser: boolean;
  timestamp: string;
}

const responses = [
  "I'm here to help! What would you like to know?",
  "That's an interesting question. Let me help you with that.",
  "I understand your concern. Here's what I think...",
  "Thanks for asking! I'd be happy to assist you.",
  "Could you please provide more details about your question?",
];

export function getBotResponse(userMessage: string): string {
  // Simple static response system
  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}
