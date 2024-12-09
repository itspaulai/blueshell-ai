import { ChatContainer } from "@/components/ChatContainer";

export default function ChatPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <ChatContainer />
      </div>
    </div>
  );
}
