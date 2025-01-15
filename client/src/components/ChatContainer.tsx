import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select"

const ChatContainer = () => {
  return (
    <div className="flex flex-col h-screen">
      <div className="py-4 px-4 border-b">
        <Select defaultValue="basic">
          <SelectTrigger className="w-[250px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="basic" textValue="Basic AI model">
                <div>
                  <div className="font-medium">Basic AI model</div>
                  <div className="text-xs text-muted-foreground">Faster but less powerful</div>
                </div>
              </SelectItem>
              <SelectItem value="smart" textValue="Smarter AI model">
                <div>
                  <div className="font-medium">Smarter AI model</div>
                  <div className="text-xs text-muted-foreground">More powerful but slower</div>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {/* Rest of the component */}
    </div>
  )
}

export { ChatContainer }