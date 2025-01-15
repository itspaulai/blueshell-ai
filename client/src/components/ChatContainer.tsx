<div className="flex flex-col h-screen">
      <div className="py-4 px-4 border-b">
        <Select defaultValue="basic">
          <SelectTrigger className="w-[250px] pl-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="basic">
                <div className="flex flex-col gap-0.5">
                  <div className="font-medium whitespace-nowrap">Basic AI model</div>
                  <div className="text-xs text-muted-foreground">Faster but less powerful</div>
                </div>
              </SelectItem>
              <SelectItem value="smart">
                <div className="flex flex-col gap-0.5">
                  <div className="font-medium whitespace-nowrap">Smarter AI model</div>
                  <div className="text-xs text-muted-foreground">More powerful but slower</div>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {/* Rest of the component */}
    </div>