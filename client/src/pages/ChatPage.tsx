import { useState, useEffect, useRef } from "react";
import { ChatContainer } from "@/components/ChatContainer";
import { WebLLMProvider } from "@/lib/WebLLMContext";
import { Button } from "@/components/ui/button";
import { PlusIcon, ChevronDownIcon, HelpCircleIcon, MessageCircleIcon, MoreVertical, Pencil, Trash } from "lucide-react";
import { chatDB } from "@/lib/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Conversation {
  id: number;
  title: string;
  messages: any[];
  updatedAt: string;
}

import { HelpDialog } from "@/components/HelpDialog";

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | undefined>();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const isInitialized = useRef(false);

  const handleDeleteConversation = async (id: number) => {
    await chatDB.deleteConversation(id);

    // If we just deleted the currently active conversation, switch to another one if available
    if (currentConversationId === id) {
      const remainingConversations = conversations.filter(conv => conv.id !== id);
      setCurrentConversationId(remainingConversations[0]?.id);
    }
    await refreshConversations();
  };

  const handleRenameConversation = async (id: number) => {
    if (!newTitle.trim()) return;
    await chatDB.renameConversation(id, newTitle.trim());
    setIsRenameDialogOpen(false);
    setNewTitle("");
    setConversationToRename(null);
    await refreshConversations();
  };

  const openRenameDialog = (id: number, currentTitle: string) => {
    setConversationToRename(id);
    setNewTitle(currentTitle);
    setIsRenameDialogOpen(true);
  };

  // ---------------
  // 1) Initialize DB & conversations
  // ---------------
  useEffect(() => {
    const initDB = async () => {
      if (isInitialized.current) return;
      isInitialized.current = true;

      try {
        await chatDB.init();
        const existingConversations = await chatDB.getConversations();
        setConversations(existingConversations);

        // Check localStorage for the last active conversation ID
        const storedId = localStorage.getItem("currentConversationId");
        if (storedId) {
          const parsedId = parseInt(storedId, 10);
          // Only set it if that conversation actually exists in the DB
          const conversationExists = existingConversations.some(conv => conv.id === parsedId);
          if (conversationExists) {
            setCurrentConversationId(parsedId);
          } else if (existingConversations.length > 0) {
            // fallback to first if the stored ID isn't valid
            setCurrentConversationId(existingConversations[0].id);
          } else {
            setCurrentConversationId(undefined);
          }
        } else {
          // Otherwise, just pick the first conversation if any exist
          if (existingConversations.length > 0) {
            setCurrentConversationId(existingConversations[0].id);
          } else {
            setCurrentConversationId(undefined);
          }
        }
      } catch (error) {
        console.error('Error initializing DB:', error);
      }
    };

    initDB();
  }, []);

  // ---------------
  // 2) Store currentConversationId in localStorage whenever it changes
  // ---------------
  useEffect(() => {
    if (currentConversationId !== undefined) {
      localStorage.setItem("currentConversationId", currentConversationId.toString());
    } else {
      localStorage.removeItem("currentConversationId");
    }
  }, [currentConversationId]);

  const refreshConversations = async () => {
    try {
      const updatedConversations = await chatDB.getConversations();
      setConversations(updatedConversations);
    } catch (error) {
      console.error('Error refreshing conversations:', error);
    }
  };

  const handleNewChat = () => {
    // Clear the currentConversationId so ChatContainer treats it as a brand new chat
    setCurrentConversationId(undefined);
  };

  const handleFirstMessage = async (content: string): Promise<number | undefined> => {
    try {
      const title = content.split(' ').slice(0, 5).join(' ');
      const newId = await chatDB.createConversation(title);
      setCurrentConversationId(newId);
      await refreshConversations();
      return newId;
    } catch (error) {
      console.error('Error creating new conversation:', error);
      return undefined;
    }
  };

  // Refresh conversations periodically to catch updates from other actions
  useEffect(() => {
    const interval = setInterval(refreshConversations, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className={`${
        isSidebarOpen ? "w-[320px]" : "w-[75px]"
      } bg-[#f1f4f9] flex flex-col transition-all duration-300 ease-in-out`}>
        {/* Header Section */}
        <div className="px-5 pt-5 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className={`text-xl font-semibold ${!isSidebarOpen && "hidden"}`}>Blueshell</h1>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform duration-300 ${
                  isSidebarOpen ? "rotate-90" : "-rotate-90"
                }`}
              />
            </Button>
          </div>
          <Button 
            className={`flex gap-2 mb-6 w-full font-semibold ${!isSidebarOpen && "px-0 justify-center"}`}
            onClick={handleNewChat}
          >
            <PlusIcon className="h-4 w-4" />
            {isSidebarOpen && "New chat"}
          </Button>
        </div>

        {/* Scrollable Chat List */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 scrollbar-thin scrollbar-thumb-[#dde3ea] hover:scrollbar-thumb-[#c4c7c5] scrollbar-track-transparent">
          {isSidebarOpen && conversations.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground mb-2 pl-3">Recent</h2>
          )}
          <div className="space-y-1">
            {isSidebarOpen && conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="flex items-center group rounded-md data-[active=true]:bg-[#d3e3fd] data-[active=false]:hover:bg-[#e9eef6]"
                data-active={currentConversationId === conversation.id}
              >
                <Button
                  variant="ghost"
                  className="flex-1 justify-start text-sm pl-3 min-w-0 hover:bg-transparent"
                  onClick={() => setCurrentConversationId(conversation.id)}
                >
                  <MessageCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 relative top-0" />
                  <span className="truncate">{conversation.title || 'New Chat'}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-transparent"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openRenameDialog(conversation.id, conversation.title)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this conversation? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteConversation(conversation.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-5 py-4 flex-shrink-0">
          <Button variant="ghost" className={`${!isSidebarOpen && "px-0 justify-center"} gap-2 w-full`} onClick={() => setHelpOpen(true)}>
            <HelpCircleIcon className="h-4 w-4" />
            {isSidebarOpen && "Help"}
          </Button>
        </div>
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <WebLLMProvider>
          <ChatContainer 
            conversationId={currentConversationId}
            onFirstMessage={handleFirstMessage}
          />
        </WebLLMProvider>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new title"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && conversationToRename) {
                  handleRenameConversation(conversationToRename);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => conversationToRename && handleRenameConversation(conversationToRename)}
              disabled={!newTitle.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}