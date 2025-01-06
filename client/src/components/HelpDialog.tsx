
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How to Use the App</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section>
            <h3 className="font-semibold mb-2">Chat Interface</h3>
            <p>Type your messages in the input box at the bottom of the screen and press Enter or click the send button to communicate with the AI assistant.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">PDF Documents</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Click the "Load PDF" button to upload a PDF document</li>
              <li>Once loaded, the AI will use the PDF content to provide more informed answers</li>
              <li>You can unload the PDF at any time to return to general conversation</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Controls</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the stop button to interrupt the AI's response</li>
              <li>The conversation will automatically scroll as new messages appear</li>
              <li>Your chat history is saved automatically</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Model Information</h3>
            <p>This app uses a local AI model that runs directly in your browser, ensuring privacy and offline functionality.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
