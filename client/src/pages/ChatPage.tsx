import { ChatContainer } from "@/components/ChatContainer";
import { Button } from "@/components/ui/button";
import { PlusIcon, ChevronDownIcon, HelpCircleIcon } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-[260px] bg-white p-4 flex flex-col border-r">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Blueshell</h1>
          <Button variant="ghost" size="icon">
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button className="flex gap-2 mb-4">
          <PlusIcon className="h-4 w-4" />
          New chat
        </Button>
        <div className="flex-1">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Recent</h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start text-sm">Newsletter</Button>
            <Button variant="ghost" className="w-full justify-start text-sm">Build Modern Chatbot</Button>
            <Button variant="ghost" className="w-full justify-start text-sm">Create Modern Tortoise App</Button>
            <Button variant="ghost" className="w-full justify-start text-sm">Trash Reminder Request</Button>
            <Button variant="ghost" className="w-full justify-start text-sm">Song Identification Request</Button>
          </div>
        </div>
        <Button variant="ghost" className="justify-start gap-2">
          <HelpCircleIcon className="h-4 w-4" />
          Help
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <ChatContainer />
      </div>
    </div>
  );
}
