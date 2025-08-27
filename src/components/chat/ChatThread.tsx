import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { addStickyFromText } from "@/lib/stickyStorage";
import { User, Bot, StickyNote, Copy } from "lucide-react";

export interface Message {
  type: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

interface ChatThreadProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatThread({ messages, isLoading }: ChatThreadProps) {
  const { toast } = useToast();
  const [typedText, setTypedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevAssistantKeyRef = useRef<string | null>(null);

  // Find last assistant message index
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "assistant") return i;
    }
    return -1;
  })();

  // Typing animation for last assistant message (only when it's new)
  useEffect(() => {
    if (lastAssistantIndex === -1) {
      setTypedText("");
      setIsAnimating(false);
      return;
    }
    const last = messages[lastAssistantIndex];
    const key = `${last?.content ?? ""}|${(last?.timestamp as Date | undefined)?.getTime?.() ?? ""}`;
    if (key === prevAssistantKeyRef.current) {
      // Same last assistant as before; don't animate
      setIsAnimating(false);
      setTypedText("");
      return;
    }

    // New assistant message detected -> animate
    prevAssistantKeyRef.current = key;
    const full = last?.content || "";
    setTypedText("");
    setIsAnimating(true);
    let i = 0;
    const timers: number[] = [];
    const tick = () => {
      setTypedText(full.slice(0, i + 1));
      i++;
      if (i < full.length) {
        const t = window.setTimeout(tick, 15);
        timers.push(t);
      } else {
        setIsAnimating(false);
      }
    };
    const first = window.setTimeout(tick, 50);
    timers.push(first);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [messages, lastAssistantIndex]);

  // Auto scroll to bottom when messages or loading/typing changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, typedText]);
  const handleAddToSticky = (text: string) => {
    const note = addStickyFromText(text, { color: "yellow" });
    toast({
      title: "Added to Sticky Notes",
      description: "Your assistant message was saved as a sticky note.",
    });
    return note;
  };
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Response copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex gap-4 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {message.type === "assistant" && (
            <Avatar className="w-8 h-8 bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500 ring-2 ring-white/50 dark:ring-white/20 shadow-sm">
              <AvatarFallback className="bg-transparent text-white">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          )}
          
          <div
            className={`max-w-2xl px-4 py-3 rounded-2xl ${
              message.type === "user"
                ? "bg-accent text-white"
                : "bg-surface border border-border"
            }`}
          >
            <p className="text-sm leading-relaxed">
              {index === lastAssistantIndex && message.type === "assistant" && isAnimating ? (
                <>
                  {typedText}
                  <span className="inline-flex items-center ml-1 align-middle">
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse"></span>
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse ml-0.5 delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse ml-0.5 delay-200"></span>
                  </span>
                </>
              ) : (
                message.content
              )}
            </p>
            {message.type === "assistant" && (
              <div className="mt-2 flex gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAddToSticky(message.content)}
                        aria-label="Add to Sticky Notes"
                        className="w-8 h-8"
                      >
                        <StickyNote className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add to Sticky Notes</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(message.content)}
                        aria-label="Copy response"
                        className="w-8 h-8"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          
          {message.type === "user" && (
            <Avatar className="w-8 h-8 bg-secondary">
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
      
      {isLoading && (
        <div className="flex gap-4 justify-start">
          <Avatar className="w-8 h-8 bg-accent">
            <AvatarFallback>
              <Bot className="w-4 h-4 text-white" />
            </AvatarFallback>
          </Avatar>
          <div className="bg-surface border border-border px-4 py-3 rounded-2xl">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-muted rounded-full animate-pulse delay-100"></div>
              <div className="w-2 h-2 bg-muted rounded-full animate-pulse delay-200"></div>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}