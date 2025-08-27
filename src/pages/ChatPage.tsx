import { useState, useEffect } from "react";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { UploadDropzone } from "@/components/upload/UploadDropzone";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const STORAGE_KEY = "chat.thread.v1";

  // Load chat from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          type UnknownMessage = { type: "user" | "assistant"; content: string; timestamp?: string | Date };
          const revived: Message[] = (parsed as UnknownMessage[])
            .filter((m) => m && (m.type === "user" || m.type === "assistant") && typeof m.content === "string")
            .map((m) => ({
              type: m.type,
              content: m.content,
              timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
            }));
          setMessages(revived);
        }
      }
    } catch (e) {
      console.warn("Failed to load chat from storage", e);
    }
  }, []);

  // Persist chat on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to save chat to storage", e);
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-text mb-4 text-balance">
                Turn your notes into knowledge
              </h1>
              <p className="text-lg text-muted text-balance">
                Drop a photo of your notes to start learning with AI-powered summaries, quizzes, and mind maps.
              </p>
            </div>
            <UploadDropzone 
              onUpload={(files) => {
                // Handle file upload
                console.log("Files uploaded:", files);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ChatThread messages={messages} isLoading={isLoading} />
        </div>
      )}
      
      <ChatComposer 
        onSend={(message) => {
          setMessages(prev => [...prev, { type: "user", content: message, timestamp: new Date() }]);
          setIsLoading(true);
          // Simulate AI response
          setTimeout(() => {
            setMessages(prev => [...prev, { 
              type: "assistant", 
              content: "I'd be happy to help you with that! Please upload an image of your notes so I can analyze them and provide summaries, explanations, or create quizzes.",
              timestamp: new Date(),
            }]);
            setIsLoading(false);
          }, 1000);
        }}
        disabled={isLoading}
      />
    </div>
  );
}