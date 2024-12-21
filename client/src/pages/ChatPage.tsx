import { useState, useEffect } from "react";
import { ChatContainer } from "@/components/ChatContainer";
import { WebLLMProvider } from "@/lib/WebLLMContext";
import { Button } from "@/components/ui/button";
import { PlusIcon, ChevronDownIcon, HelpCircleIcon, MessageCircleIcon } from "lucide-react";
import { chatDB } from "@/lib/db";

interface Conversation {
  id: number;
  title: string;
  messages: any[];
  updatedAt: string;
}

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | undefined>();

  useEffect(() => {
    let isInitialized = false;
    
    const initDB = async () => {
      if (isInitialized) return;
      
      await chatDB.init();
      const existingConversations = await chatDB.getConversations();
      setConversations(existingConversations);
      
      if (existingConversations.length === 0) {
        const newId = await chatDB.createConversation();
        const updatedConversations = await chatDB.getConversations();
        setConversations(updatedConversations);
        setCurrentConversationId(newId);
      } else {
        setCurrentConversationId(existingConversations[0].id);
      }
      
      isInitialized = true;
    };
    
    initDB();
  }, []);

  const refreshConversations = async () => {
    const updatedConversations = await chatDB.getConversations();
    setConversations(updatedConversations);
  };

  const handleNewChat = async () => {
    const newId = await chatDB.createConversation();
    setCurrentConversationId(newId);
    await refreshConversations();
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering conversation selection
    if (conversations.length <= 1) {
      // Don't delete the last conversation
      return;
    }
    await chatDB.deleteConversation(id);
    
    // If we're deleting the current conversation, switch to another one
    if (currentConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      }
    }
    
    await refreshConversations();
  };

  // Refresh conversations periodically to catch updates
  useEffect(() => {
    const interval = setInterval(refreshConversations, 1000);
    return () => clearInterval(interval);
  }, []);

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
        <Button 
          className={`flex gap-2 mb-4 ${!isSidebarOpen && "px-0 justify-center"}`}
          onClick={handleNewChat}
        >
          <PlusIcon className="h-4 w-4" />
          {isSidebarOpen && "New chat"}
        </Button>
        <div className="flex-1">
          {isSidebarOpen && <h2 className="text-sm font-medium text-muted-foreground mb-2 pl-3">Recent</h2>}
          <div className="space-y-1">
            {isSidebarOpen ? (
              <>
                {conversations.map((conversation) => (
                  <Button
                    key={conversation.id}
                    variant="ghost"
                    className="w-full justify-start text-sm pl-3 group hover:bg-red-500/10"
                    onClick={() => setCurrentConversationId(conversation.id)}
                    data-active={currentConversationId === conversation.id}
                  >
                    <MessageCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 relative top-0" />
                    <span className="flex-1 truncate">{conversation.title || 'New Chat'}</span>
                    <button
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                      aria-label="Delete conversation"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </Button>
                ))}
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
        <WebLLMProvider>
          <ChatContainer 
            conversationId={currentConversationId}
            onConversationCreated={setCurrentConversationId}
          />
        </WebLLMProvider>
      </div>
    </div>
  );
}