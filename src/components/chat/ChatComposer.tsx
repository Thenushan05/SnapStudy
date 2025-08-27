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
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <Textarea
            placeholder="Ask about your notes, or try /summary, /explain, /quiz, /mindmap..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="min-h-[52px] sm:min-h-[60px] pr-16 sm:pr-24 resize-none focus-ring"
          />
          
          <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hidden sm:inline-flex"
              disabled={disabled}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hidden sm:inline-flex"
              disabled={disabled}
            >
              <Mic className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              size="icon"
              className="w-10 h-10 sm:w-8 sm:h-8"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-muted">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}