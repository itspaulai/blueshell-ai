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

export default function ChatPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | undefined>();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const isInitialized = useRef(false); // Initialization flag

  const handleDeleteConversation = async (id: number) => {
    await chatDB.deleteConversation(id);
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

  useEffect(() => {
    const initDB = async () => {
      if (isInitialized.current) return; // Prevent multiple initializations
      isInitialized.current = true; // Set the flag to true

      try {
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
      } catch (error) {
        console.error('Error initializing DB:', error);
      }
    };

    initDB();
  }, []); // Empty dependency array ensures this runs once

  const refreshConversations = async () => {
    try {
      const updatedConversations = await chatDB.getConversations();
      setConversations(updatedConversations);
    } catch (error) {
      console.error('Error refreshing conversations:', error);
    }
  };

  const handleNewChat = async () => {
    try {
      const newId = await chatDB.createConversation();
      setCurrentConversationId(newId);
      await refreshConversations();
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
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
                  <div key={conversation.id} className="flex items-center group">
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start text-sm pl-3 min-w-0"
                      onClick={() => setCurrentConversationId(conversation.id)}
                      data-active={currentConversationId === conversation.id}
                    >
                      <MessageCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 relative top-0" />
                      <span className="truncate">{conversation.title || 'New Chat'}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
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
