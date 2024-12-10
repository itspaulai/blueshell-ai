import { useState } from "react";
import { ChatContainer } from "@/components/ChatContainer";
import { Button } from "@/components/ui/button";
import { PlusIcon, ChevronDownIcon, HelpCircleIcon, MessageCircleIcon } from "lucide-react";

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className={`${
        isSidebarOpen ? "w-[260px]" : "w-[60px]"
      } bg-[#f1f4f9] p-4 flex flex-col transition-all duration-300 ease-in-out`}>
        <div className="flex items-center justify-between mb-4">
          <h1 className={`text-xl font-semibold pl-3 ${!isSidebarOpen && "hidden"}`}>Blueshell</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ${isSidebarOpen ? "rotate-90" : "-rotate-90"}`} />
          </Button>
        </div>
        <Button className={`flex gap-2 mb-4 ${!isSidebarOpen && "px-0 justify-center"}`}>
          <PlusIcon className="h-4 w-4" />
          {isSidebarOpen && "New chat"}
        </Button>
        <div className="flex-1">
          {isSidebarOpen && <h2 className="text-sm font-medium text-muted-foreground mb-2 pl-3">Recent</h2>}
          <div className="space-y-1">
            {isSidebarOpen ? (
              <>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  Newsletter
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  Build Modern Chatbot
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  Create Modern Tortoise App
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  Trash Reminder Request
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm pl-3">
                  <MessageCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  Song Identification Request
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" className={`${!isSidebarOpen && "px-0 justify-center"} gap-2`}>
          <HelpCircleIcon className="h-4 w-4" />
          {isSidebarOpen && "Help"}
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <ChatContainer />
      </div>
    </div>
  );
}
