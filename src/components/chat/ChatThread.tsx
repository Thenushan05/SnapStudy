import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { addStickyFromText } from "@/lib/stickyStorage";
import { api } from "@/lib/api";
import { User, Bot, StickyNote, Copy, Pin, Image as ImageIcon } from "lucide-react";

export interface MessageAction {
  type: "retryProcess";
  label?: string;
}

export interface Message {
  type: "user" | "assistant";
  content: string;
  timestamp?: Date;
  action?: MessageAction;
  animate?: boolean; // if false, do not animate even if last assistant
  evidence?: Array<{
    id: string;
    text: string;
    confidence?: number;
    bbox?: unknown;
    ocrMethod?: string;
  }>;
  tag?: "upload" | "summary" | "info";
}

interface ChatThreadProps {
  messages: Message[];
  isLoading?: boolean;
  onRetryProcess?: () => void;
}

export function ChatThread({ messages, isLoading, onRetryProcess }: ChatThreadProps) {
  const { toast } = useToast();
  const [typedText, setTypedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevAssistantKeyRef = useRef<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState<
    Array<{ id: string; text: string; confidence?: number; bbox?: unknown; ocrMethod?: string }>
  >([]);

  // Simple markdown-lite renderer: supports #, ##, ###, -, *, **bold**, *italic*
  const renderMarkdownLite = (text: string) => {
    const lines = text.split(/\r?\n/);
    const elements: JSX.Element[] = [];
    let listBuffer: string[] = [];
    const flushList = () => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul className="list-disc pl-5 space-y-1" key={`ul-${elements.length}`}>
            {listBuffer.map((item, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: inline(item) }} />
            ))}
          </ul>
        );
        listBuffer = [];
      }
    };
    const inline = (s: string) => {
      // escape minimal HTML
      const esc = s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // bold **text** and italic *text*
      const bolded = esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      const italicized = bolded.replace(/(^|\s)\*(?!\*)([^*]+?)\*(?=\s|$)/g, "$1<em>$2</em>");
      return italicized;
    };
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Promote '**Title**:' and '1. **Title**:' style labels to attractive headings
      const numberedBoldLabel = trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*:\s*(.*)$/);
      if (numberedBoldLabel) {
        const title = numberedBoldLabel[1];
        const rest = numberedBoldLabel[2] || "";
        flushList();
        elements.push(
          <h3
            className="font-semibold text-base mt-3 text-sky-600 dark:text-sky-400"
            key={`nbh-${i}`}
            dangerouslySetInnerHTML={{ __html: title }}
          />
        );
        if (rest) {
          elements.push(
            <p
              className="leading-relaxed"
              key={`nbp-${i}`}
              dangerouslySetInnerHTML={{ __html: inline(rest) }}
            />
          );
        }
        return;
      }
      const boldLabel = trimmed.match(/^\*\*(.+?)\*\*:\s*(.*)$/);
      if (boldLabel) {
        const title = boldLabel[1];
        const rest = boldLabel[2] || "";
        flushList();
        elements.push(
          <h3
            className="font-semibold text-base mt-3 text-sky-600 dark:text-sky-400"
            key={`bh-${i}`}
            dangerouslySetInnerHTML={{ __html: title }}
          />
        );
        if (rest) {
          elements.push(
            <p
              className="leading-relaxed"
              key={`bp-${i}`}
              dangerouslySetInnerHTML={{ __html: inline(rest) }}
            />
          );
        }
        return;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        listBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
        return;
      }
      if (/^###\s+/.test(trimmed)) {
        elements.push(
          <h3
            className="font-semibold text-base mt-2 text-pink-600 dark:text-pink-400"
            key={`h3-${i}`}
            dangerouslySetInnerHTML={{ __html: inline(trimmed.replace(/^###\s+/, "")) }}
          />
        );
      } else if (/^##\s+/.test(trimmed)) {
        elements.push(
          <h2
            className="font-semibold text-lg mt-2 text-fuchsia-600 dark:text-fuchsia-400"
            key={`h2-${i}`}
            dangerouslySetInnerHTML={{ __html: inline(trimmed.replace(/^##\s+/, "")) }}
          />
        );
      } else if (/^#\s+/.test(trimmed)) {
        elements.push(
          <h1
            className="font-bold text-xl mt-2 text-indigo-600 dark:text-indigo-400"
            key={`h1-${i}`}
            dangerouslySetInnerHTML={{ __html: inline(trimmed.replace(/^#\s+/, "")) }}
          />
        );
      } else if (trimmed.length === 0) {
        elements.push(<div className="h-2" key={`sp-${i}`} />);
      } else {
        // Special styling for leading labels like "Summary:" and "Content Overview:" to make them attractive
        const labelMatch = trimmed.match(/^(Summary:|Content Overview:)\s*/);
        if (labelMatch) {
          const label = labelMatch[1];
          const rest = trimmed.slice(labelMatch[0].length);
          elements.push(
            <p className="leading-relaxed" key={`p-${i}`}>
              <span className="inline-block align-middle mr-2 px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 font-semibold">
                {label}
              </span>
              <span dangerouslySetInnerHTML={{ __html: inline(rest) }} />
            </p>
          );
        } else {
          elements.push(
            <p
              className="leading-relaxed"
              key={`p-${i}`}
              dangerouslySetInnerHTML={{ __html: inline(trimmed) }}
            />
          );
        }
      }
    });
    flushList();
    return <div className="space-y-1">{elements}</div>;
  };

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
    // Respect explicit animate flag
    if (last?.type === "assistant" && last?.animate === false) {
      setIsAnimating(false);
      setTypedText("");
      // Still set the key so subsequent identical content doesn't animate
      const keyNoAnim = `${last?.content ?? ""}|${(last?.timestamp as Date | undefined)?.getTime?.() ?? ""}`;
      prevAssistantKeyRef.current = keyNoAnim;
      return;
    }
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
  const handleAddToSticky = async (text: string) => {
    try {
      const sessionId = sessionStorage.getItem("lastSessionId") || "";
      if (!sessionId) throw new Error("missing sessionId");
      await api.bookmarks.createRef({
        refType: "session",
        refId: sessionId,
        title: "Important Study Session",
        description: text,
        note: "Focus on nodes 2 and 3",
        priority: "high",
        tags: ["important", "review"],
      });
      toast({ title: "Bookmarked", description: "Saved to bookmarks for this session." });
    } catch (e) {
      // Fallback to local storage when server unavailable or no sessionId present
      addStickyFromText(text, { color: "yellow" });
      toast({ title: "Saved locally", description: "Bookmark saved offline (no session).", variant: "default" });
    }
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
            className={`relative max-w-2xl px-4 py-3 rounded-2xl ${
              message.type === "user"
                ? "bg-accent text-white"
                : "bg-surface border border-border"
            } ${
              message.type === "assistant" && message.evidence && message.evidence.length > 0
                ? "pr-10"
                : ""
            }`}
          >
            {message.type === "assistant" && message.evidence && message.evidence.length > 0 && (
              <div className="absolute top-2 right-2 z-10">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Show evidence"
                        className="w-7 h-7"
                        onClick={() => { setCurrentEvidence(message.evidence!); setEvidenceOpen(true); }}
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Show evidence</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            {index === lastAssistantIndex && message.type === "assistant" && isAnimating ? (
              <p className="text-sm leading-relaxed">
                {typedText}
                <span className="inline-flex items-center ml-1 align-middle">
                  <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse ml-0.5 delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-muted rounded-full animate-pulse ml-0.5 delay-200"></span>
                </span>
              </p>
            ) : (
              <div className="text-sm">
                {message.type === "assistant" ? (
                  <div className="flex items-start gap-2">
                    {message.tag === "upload" && (
                      <ImageIcon className="w-4 h-4 mt-0.5 text-muted" />
                    )}
                    <div className="min-w-0 flex-1">{renderMarkdownLite(message.content)}</div>
                  </div>
                ) : (
                  <p className="leading-relaxed">{message.content}</p>
                )}
              </div>
            )}
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
                  {message.action?.type === "retryProcess" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRetryProcess?.()}
                          className="ml-1"
                        >
                          {message.action.label || "Retry"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Try processing again</TooltipContent>
                    </Tooltip>
                  )}
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

    {/* Evidence Dialog */}
    <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Extracted Evidence</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {currentEvidence.length === 0 ? (
            <p className="text-sm text-muted">No evidence available.</p>
          ) : (
            currentEvidence.map((ev) => (
              <div key={ev.id} className="p-3 rounded-md border border-border bg-card">
                <p className="text-sm whitespace-pre-wrap">{ev.text}</p>
                {typeof ev.confidence === "number" && (
                  <p className="mt-1 text-xs text-muted">Confidence: {(ev.confidence * 100).toFixed(1)}%</p>
                )}
                {ev.ocrMethod && (
                  <p className="mt-1 text-xs text-muted">OCR: {ev.ocrMethod}</p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>
);
}