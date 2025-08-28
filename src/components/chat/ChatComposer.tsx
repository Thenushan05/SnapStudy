import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Mic, Camera } from "lucide-react";

interface ChatComposerProps {
  onSend: (message: string) => void;
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

const PLACEHOLDERS = [
  "Ask about your notes...",
  "Try /summary, /explain, /quiz, /mindmap",
  "Attach an image to analyze",
];

export function ChatComposer({ onSend, onUpload, disabled }: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState("");
  const [phText, setPhText] = useState("");
  const [phIndex, setPhIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Typing animation for placeholder
  useEffect(() => {
    if (disabled) return; // pause when disabled
    const current = PLACEHOLDERS[phIndex % PLACEHOLDERS.length];
    const speed = isDeleting ? 40 : 70;
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        const next = current.slice(0, phText.length + 1);
        setPhText(next);
        if (next === current) {
          setIsDeleting(true);
          // small hold before deleting
          setTimeout(() => {}, 600);
        }
      } else {
        const next = current.slice(0, Math.max(0, phText.length - 1));
        setPhText(next);
        if (next.length === 0) {
          setIsDeleting(false);
          setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
        }
      }
    }, speed);
    return () => clearTimeout(timeout);
  }, [phText, isDeleting, phIndex, disabled]);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onUpload(Array.from(event.target.files));
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <Textarea
            placeholder={phText || "Ask about your notes..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="min-h-[52px] sm:min-h-[60px] pr-16 sm:pr-24 resize-none focus-ring"
          />
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept="image/*,application/pdf"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
            capture="environment"
          />
          <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hidden sm:inline-flex"
              disabled={disabled}
              onClick={handleUploadClick}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              disabled={disabled}
              onClick={handleCameraClick}
            >
              <Camera className="w-4 h-4" />
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