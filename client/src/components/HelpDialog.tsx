
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-2xl text-blue-600">How to Use the App</DialogTitle>
        </DialogHeader>
        <div className="space-y-8 py-6 px-2">
          <section className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 text-blue-700 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">🤖</span>
              AI Model
            </h3>
            <div className="space-y-3 text-gray-600">
              <p>This app uses a local AI model that runs directly in your browser. Here's what you need to know:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>When you first open the app, the AI model will begin downloading automatically</li>
                <li>You'll see a loading progress indicator showing the download status</li>
                <li>Once loaded, the model runs entirely in your browser - ensuring privacy and offline functionality</li>
                <li>The model may take a few moments to load initially, but subsequent uses will be faster</li>
              </ul>
            </div>
          </section>

          <section className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 text-blue-700 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">💬</span>
              Basic Chat
            </h3>
            <div className="space-y-3 text-gray-600">
              <p>Using the chat interface is straightforward:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Type your message in the input box at the bottom</li>
                <li>Press Enter or click the send button to send your message</li>
                <li>Use the stop button (red X) to interrupt the AI's response if needed</li>
                <li>The chat will automatically scroll as new messages appear</li>
              </ul>
            </div>
          </section>

          <section className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 text-blue-700 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">📄</span>
              Working with PDFs
            </h3>
            <div className="space-y-3 text-gray-600">
              <p className="font-medium mb-2">Loading a PDF:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Click the "Load PDF" button to upload a PDF document</li>
                <li>The app will process the PDF and extract its content</li>
                <li>Once loaded, the AI will use the PDF content to provide informed answers</li>
              </ul>

              <p className="font-medium mt-4 mb-2">Discussing PDF Content:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Ask questions directly about the PDF content</li>
                <li>The AI will reference relevant parts of the document in its responses</li>
                <li>You can ask for summaries, explanations, or specific information from the PDF</li>
              </ul>

              <p className="font-medium mt-4 mb-2">Unloading a PDF:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Click the "Unload PDF" button to remove the current PDF</li>
                <li>This will return the chat to general conversation mode</li>
                <li>Your chat history will be preserved, but new responses won't reference the PDF</li>
              </ul>
            </div>
          </section>

          <section className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 text-blue-700 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">📝</span>
              Managing Conversations
            </h3>
            <div className="space-y-3 text-gray-600">
              <p className="font-medium mb-2">Renaming Conversations:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Click the three dots (⋮) next to any conversation in the sidebar</li>
                <li>Select "Rename" from the dropdown menu</li>
                <li>Enter the new title in the dialog that appears</li>
                <li>Click "Save" or press Enter to confirm</li>
              </ul>

              <p className="font-medium mt-4 mb-2">Deleting Conversations:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Click the three dots (⋮) next to the conversation you want to delete</li>
                <li>Select "Delete" from the dropdown menu</li>
                <li>Confirm the deletion in the confirmation dialog</li>
                <li>Note: This action cannot be undone</li>
              </ul>
            </div>
          </section>

          <section className="bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 text-blue-700 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">✨</span>
              Additional Features
            </h3>
            <div className="space-y-3 text-gray-600">
              <ul className="list-disc pl-6 space-y-2">
                <li>The sidebar can be collapsed for more chat space</li>
                <li>Your chat history is saved automatically</li>
                <li>Start a new chat anytime by clicking "New chat" in the sidebar</li>
              </ul>
            </div>
          </section>
        </div>
        <DialogFooter className="border-t pt-4">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.href = 'mailto:hello@blueshell.com'}
            >
              Contact us
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
