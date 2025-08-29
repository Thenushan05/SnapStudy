import { useState, useRef, useEffect, useCallback } from "react";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const expiryTimerRef = useRef<number | null>(null);

  const CHAT_STORAGE_KEY = "chat_messages";
  const CHAT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function clearChatStorage() {
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (_) { /* no-op */ }
  }

  function saveChat(messagesToSave: Message[]) {
    const payload = {
      messages: messagesToSave.map((m) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
      })),
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) { /* no-op */ }
  }

  function loadChat(): Message[] | null {
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { messages: Message[]; savedAt: number };
      if (!parsed?.savedAt || !Array.isArray(parsed?.messages)) return null;
      const age = Date.now() - parsed.savedAt;
      if (age > CHAT_TTL_MS) {
        clearChatStorage();
        return null;
      }
      const restored: Message[] = parsed.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
      }));
      return restored;
    } catch (_) { return null; }
  }

  const scheduleExpiry = useCallback((fromSavedAt?: number) => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    let remaining = CHAT_TTL_MS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { savedAt?: number };
        const savedAt = fromSavedAt ?? parsed?.savedAt ?? Date.now();
        remaining = Math.max(0, savedAt + CHAT_TTL_MS - Date.now());
      } catch { remaining = CHAT_TTL_MS; }
    }
    expiryTimerRef.current = window.setTimeout(() => {
      setMessages([]);
      clearChatStorage();
      toast.info("Chat cleared after 5 minutes");
    }, remaining);
  }, [CHAT_TTL_MS]);

  // Load chat on mount if not expired
  useEffect(() => {
    const restored = loadChat();
    if (restored && restored.length) {
      setMessages(restored);
    }
    scheduleExpiry();
    return () => {
      if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleExpiry]);

  // Persist chat and reset expiry whenever messages change
  useEffect(() => {
    saveChat(messages);
    // Update expiry starting now
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      const savedAt = raw ? (JSON.parse(raw).savedAt as number) : Date.now();
      scheduleExpiry(savedAt);
    } catch {
      scheduleExpiry();
    }
  }, [messages, scheduleExpiry]);
  
  async function retryProcess() {
    const imageId = sessionStorage.getItem("lastImageId");
    if (!imageId) {
      toast.error("No image to process. Please upload again.");
      return;
    }
    try {
      setIsLoading(true);
      toast("Re-trying processing…");
      const proc = await api.process.image({ imageId });
      const sessionId = proc.data?.sessionId;
      if (sessionId) sessionStorage.setItem("lastSessionId", sessionId);
      const evidenceCount = Number(proc.data?.evidenceCount ?? 0);
      if (evidenceCount === 0) {
        setMessages(prev => [
          ...prev,
          { type: "assistant", content: "Server busy. Please try again.", timestamp: new Date(), action: { type: "retryProcess", label: "Retry" } },
        ]);
        toast.error("Server busy. Try again.");
        return;
      }
      const summary = proc.data?.summary || "Processed.";
      setMessages(prev => [
        ...prev,
        { type: "assistant", content: `Summary: ${summary}`, timestamp: new Date() },
      ]);
      toast.success("Image processed");
    } catch (err) {
      console.error("retry process failed", err);
      toast.error("Retry failed");
      setMessages(prev => [
        ...prev,
        { type: "assistant", content: "Retry failed. Please try later.", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFilesUpload(files: File[]) {
    if (!files || files.length === 0) return;
    try {
      setIsLoading(true);
      toast("Uploading…");
      const file = files[0];
      const up = await api.upload.imageFile(file, { filename: file.name, tags: ["chat"] });
      const imageId = up.image.id;
      const imageUrl = up.image.url;
      sessionStorage.setItem("lastImageId", imageId);
      setMessages(prev => [
        ...prev,
        { type: "user", content: `Uploaded ${file.name}`, timestamp: new Date() },
        { type: "assistant", content: `Image uploaded. ID: ${imageId}`, timestamp: new Date() },
      ]);

      // Call process API
      const proc = await api.process.image({ imageId });
      const sessionId = proc.data?.sessionId;
      if (sessionId) sessionStorage.setItem("lastSessionId", sessionId);
      const evidenceCount = Number(proc.data?.evidenceCount ?? 0);
      if (evidenceCount === 0) {
        setMessages(prev => [
          ...prev,
          { type: "assistant", content: "Server busy. Please try again.", timestamp: new Date(), action: { type: "retryProcess", label: "Retry" } },
        ]);
        toast.error("Server busy. Try again.");
      } else {
        const summary = proc.data?.summary || "Processed.";
        setMessages(prev => [
          ...prev,
          { type: "assistant", content: `Summary: ${summary}`, timestamp: new Date() },
        ]);
        toast.success("Image processed");
      }
    } catch (err: unknown) {
      console.error("Upload/process failed", err);
      toast.error("Upload failed");
      setMessages(prev => [
        ...prev,
        { type: "assistant", content: "Failed to upload/process the image.", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 pb-[120px] sm:pb-28">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-text mb-4 text-balance">
                Turn your notes into knowledge
              </h1>
              <p className="text-lg text-muted text-balance">
                Drop a photo of your notes to start learning with AI-powered summaries, quizzes, and mind maps.
              </p>
            </div>
            <UploadDropzone onUpload={handleFilesUpload} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-[120px] sm:pb-28">
          <ChatThread messages={messages} isLoading={isLoading} onRetryProcess={retryProcess} />
        </div>
      )}
      
      <ChatComposer 
        onSend={async (message) => {
          const text = message.trim();
          if (!text) return;
          const sessionId = sessionStorage.getItem("lastSessionId") || "";
          const imageId = sessionStorage.getItem("lastImageId") || "";
          setMessages(prev => [...prev, { type: "user", content: text, timestamp: new Date() }]);

          if (!sessionId || !imageId) {
            toast.error("Please upload an image first to start a chat.");
            setMessages(prev => [...prev, { type: "assistant", content: "Please upload an image first so I can analyze it and chat about it.", timestamp: new Date() }]);
            return;
          }
          try {
            setIsLoading(true);
            const res = await api.chat.rag({ sessionId, imageId, text });
            const newSessionId = res.data?.sessionId;
            if (newSessionId) sessionStorage.setItem("lastSessionId", newSessionId);
            const reply = res.data?.response?.content || res.data?.reply || res.message || "";
            setMessages(prev => [...prev, { type: "assistant", content: reply || "(no reply)", timestamp: new Date() }]);
          } catch (err) {
            console.error("chat.rag failed", err);
            toast.error("Chat failed");
            setMessages(prev => [...prev, { type: "assistant", content: "I couldn't process that chat request.", timestamp: new Date() }]);
          } finally {
            setIsLoading(false);
          }
        }}
        onUpload={handleFilesUpload}
        disabled={isLoading}
      />
    </div>
  );
}