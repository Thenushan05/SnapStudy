import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Mic } from "lucide-react";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-surface/80 backdrop-blur-sm p-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <Textarea
            placeholder="Ask about your notes, or try /summary, /explain, /quiz, /mindmap..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="min-h-[60px] pr-20 resize-none focus-ring"
          />
          
          <div className="absolute bottom-3 right-3 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              disabled={disabled}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              disabled={disabled}
            >
              <Mic className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              size="icon"
              className="w-8 h-8"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-muted">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}