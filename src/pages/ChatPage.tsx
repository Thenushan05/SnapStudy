import { useState, useRef, useEffect, useCallback, useContext } from "react";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { api } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { toast } from "sonner";
import { AuthContext } from "@/providers/AuthProvider";

export default function ChatPage() {
  const auth = useContext(AuthContext);
  const currentUserId = (() => {
    const u = auth?.user as unknown as Record<string, unknown> | null | undefined;
    const idVal = u && (u["id"] ?? u?.["_id"] ?? u?.["userId"] ?? u?.["email"]);
    return idVal != null ? String(idVal) : "anonymous";
  })();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const expiryTimerRef = useRef<number | null>(null);
  // Track restored count and synced count for history posting
  const restoredCountRef = useRef(0);
  const historySyncedRef = useRef(0);
  const warnedSessionRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  const CHAT_STORAGE_KEY = "chat_messages";
  const CHAT_TTL_MS = 60 * 60 * 1000; // 60 minutes
  const CHAT_USER_KEY = "chat_user_id";

  // Helper to persist sessionId with debug logs
  const setSessionId = useCallback((sid: string) => {
    if (!sid) return;
    try {
      sessionStorage.setItem("lastSessionId", sid);
      console.debug("[chat] stored sessionId:", sid);
    } catch (e) {
      console.warn("[chat] failed to store sessionId", e);
    }
  }, []);

  function clearChatStorage() {
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
      sessionStorage.removeItem("lastSessionId");
      sessionStorage.removeItem("lastImageId");
      sessionStorage.removeItem("selectedImageId");
    } catch (_) {
      /* no-op */
    }
  }

  // Clear ALL session storage items (use when user changes)
  function clearAllSessionStorage() {
    try {
      sessionStorage.clear();
    } catch (_) {
      /* no-op */
    }
  }

  const saveChat = useCallback((messagesToSave: Message[]) => {
    const payload = {
      messages: messagesToSave.map((m) => ({
        ...m,
        timestamp: m.timestamp
          ? new Date(m.timestamp).toISOString()
          : undefined,
      })),
      savedAt: Date.now(),
      userId: currentUserId,
    };
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
      sessionStorage.setItem(CHAT_USER_KEY, currentUserId);
    } catch (_) {
      /* no-op */
    }
  }, [CHAT_STORAGE_KEY, CHAT_USER_KEY, currentUserId]);

  function loadChat(): Message[] | null {
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        messages: Message[];
        savedAt: number;
        userId?: string;
      };
      if (!parsed?.savedAt || !Array.isArray(parsed?.messages)) return null;
      // If stored chat belongs to a different user, clear it
      const storedUser = parsed.userId || sessionStorage.getItem(CHAT_USER_KEY) || "anonymous";
      if (storedUser !== currentUserId) {
        clearAllSessionStorage();
        return null;
      }
      const age = Date.now() - parsed.savedAt;
      if (age > CHAT_TTL_MS) {
        clearChatStorage();
        return null;
      }
      const restored: Message[] = parsed.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
        // Do not animate restored messages
        animate: false,
      }));
      return restored;
    } catch (_) {
      return null;
    }
  }

  const scheduleExpiry = useCallback(
    (fromSavedAt?: number) => {
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
        } catch {
          remaining = CHAT_TTL_MS;
        }
      }
      expiryTimerRef.current = window.setTimeout(() => {
        setMessages([]);
        clearChatStorage();
        toast.info("Chat cleared after 5 minutes");
      }, remaining);
    },
    [CHAT_TTL_MS]
  );

  // Load chat on mount or when user changes, if not expired
  useEffect(() => {
    // If user changed since last render, clear chat to prevent cross-user leakage
    if (prevUserIdRef.current && prevUserIdRef.current !== currentUserId) {
      clearAllSessionStorage();
      setMessages([]);
      restoredCountRef.current = 0;
      historySyncedRef.current = 0;
    }
    prevUserIdRef.current = currentUserId;
    const restored = loadChat();
    if (restored && restored.length) {
      setMessages(restored);
      restoredCountRef.current = restored.length;
    }
    scheduleExpiry();
    return () => {
      if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleExpiry, currentUserId]);

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
  }, [messages, scheduleExpiry, saveChat]);

  // Post chat history on every new message appended (skip restored-on-mount)
  useEffect(() => {
    const sessionId = sessionStorage.getItem("lastSessionId") || "";
    if (!sessionId) return;
    // Skip the messages restored on mount
    if (historySyncedRef.current === 0 && restoredCountRef.current > 0) {
      historySyncedRef.current = restoredCountRef.current;
    }
    if (messages.length > historySyncedRef.current) {
      const batch = messages.slice(historySyncedRef.current);
      batch.forEach((m) => {
        if (m?.type === "user" || m?.type === "assistant") {
          api.chat
            .postHistory({ sessionId, role: m.type, text: m.content })
            .catch((e) => {
              if (e instanceof HttpError && e.status === 404) {
                // Session not found -> warn once (do not clear to aid debugging)
                if (!warnedSessionRef.current) {
                  warnedSessionRef.current = true;
                  toast.error(
                    "Chat session expired or missing. Please upload/process again to start a new session."
                  );
                }
              } else {
                console.warn("postHistory failed", e);
              }
            });
        }
      });
      historySyncedRef.current = messages.length;
    }
  }, [messages]);

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
      if (sessionId) {
        setSessionId(sessionId);
        try { window.dispatchEvent(new Event("sessions:refresh")); } catch (e) { /* no-op */ }
      }
      const evidenceCount = Number(proc.data?.evidenceCount ?? 0);
      if (evidenceCount === 0) {
        setMessages((prev) => [
          ...prev,
          {
            type: "assistant",
            content: "Server busy. Please try again.",
            timestamp: new Date(),
            action: { type: "retryProcess", label: "Retry" },
            animate: true,
          },
        ]);
        toast.error("Server busy. Try again.");
        return;
      }
      const summary = proc.data?.summary || "Processed.";
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          content: `Summary: ${summary}`,
          timestamp: new Date(),
          animate: true,
          evidence: Array.isArray(proc.data?.evidence) ? proc.data!.evidence : [],
        },
      ]);
      toast.success("Image processed");
    } catch (err) {
      console.error("retry process failed", err);
      toast.error("Retry failed");
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          content: "Retry failed. Please try later.",
          timestamp: new Date(),
          animate: true,
        },
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
      const up = await api.upload.imageFile(file, {
        filename: file.name,
        tags: ["chat"],
      });
      const imageId = up.image.id;
      const imageUrl = up.image.url;
      sessionStorage.setItem("lastImageId", imageId);
      // Maintain last 3 uploads for chat picker as last1/last2/last3
      try {
        const parseEntry = (key: string) => {
          const v = sessionStorage.getItem(key);
          if (!v) return null;
          try { return JSON.parse(v) as { id: string; name?: string }; } catch { return null; }
        };
        const e1 = parseEntry("last1");
        const e2 = parseEntry("last2");
        // shift down and insert new at last1
        if (e2) sessionStorage.setItem("last3", JSON.stringify(e2));
        if (e1) sessionStorage.setItem("last2", JSON.stringify(e1));
        sessionStorage.setItem("last1", JSON.stringify({ id: imageId, name: file.name }));
      } catch (e) {
        console.warn("failed to update last1/2/3", e);
        try { sessionStorage.setItem("last1", JSON.stringify({ id: imageId, name: file.name })); } catch { /* ignore */ }
      }
      // If upload returns a sessionId, store it
      if (up.image.sessionId) setSessionId(String(up.image.sessionId));
      setMessages((prev) => [
        ...prev,
        {
          type: "user",
          content: `Uploaded ${file.name}`,
          timestamp: new Date(),
        },
        {
          type: "assistant",
          content: `Image uploaded and ready to process.`,
          timestamp: new Date(),
          tag: "upload",
        },
      ]);

      // Call process API
      const proc = await api.process.image({ imageId });
      const sessionId = proc.data?.sessionId;
      if (sessionId) setSessionId(sessionId);
      const evidenceCount = Number(proc.data?.evidenceCount ?? 0);
      if (evidenceCount === 0) {
        setMessages((prev) => [
          ...prev,
          {
            type: "assistant",
            content: "Server busy. Please try again.",
            timestamp: new Date(),
            action: { type: "retryProcess", label: "Retry" },
          },
        ]);
        toast.error("Server busy. Try again.");
      } else {
        const summary = proc.data?.summary || "Processed.";
        setMessages((prev) => [
          ...prev,
          {
            type: "assistant",
            content: `Summary: ${summary}`,
            timestamp: new Date(),
            animate: true,
            evidence: Array.isArray(proc.data?.evidence) ? proc.data!.evidence : [],
          },
        ]);
        toast.success("Image processed");
      }
    } catch (err: unknown) {
      console.error("Upload/process failed", err);
      toast.error("Upload failed");
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          content: "Failed to upload/process the image.",
          timestamp: new Date(),
          animate: true,
        },
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
                Drop a photo of your notes to start learning with AI-powered
                summaries, quizzes, and mind maps.
              </p>
            </div>
            <UploadDropzone onUpload={handleFilesUpload} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-[120px] sm:pb-28">
          <ChatThread
            messages={messages}
            isLoading={isLoading}
            onRetryProcess={retryProcess}
          />
        </div>
      )}

      <ChatComposer
        onSend={async (message) => {
          const text = message.trim();
          if (!text) return;
          const sessionId = sessionStorage.getItem("lastSessionId") || "";
          const selected = sessionStorage.getItem("selectedImageId") || "";
          const imageId = selected || sessionStorage.getItem("lastImageId") || "";
          setMessages((prev) => [
            ...prev,
            { type: "user", content: text, timestamp: new Date() },
          ]);
          // history posting handled by centralized useEffect

          if (!sessionId || !imageId) {
            toast.error("Please upload an image first to start a chat.");
            setMessages((prev) => [
              ...prev,
              {
                type: "assistant",
                content:
                  "Please upload an image first so I can analyze it and chat about it.",
                timestamp: new Date(),
              },
            ]);
            return;
          }
          try {
            setIsLoading(true);
            const res = await api.chat.rag({ sessionId, imageId, text });
            const newSessionId = res.data?.sessionId;
            if (newSessionId) {
              setSessionId(newSessionId);
              try { window.dispatchEvent(new Event("sessions:refresh")); } catch (e) { /* no-op */ }
            } else {
              // Even without a new session id, a chat addition may update recents
              try { window.dispatchEvent(new Event("sessions:refresh")); } catch (e) { /* no-op */ }
            }
            const reply =
              res.data?.response?.content ||
              res.data?.reply ||
              res.message ||
              "";
            setMessages((prev) => [
              ...prev,
              {
                type: "assistant",
                content: reply || "(no reply)",
                timestamp: new Date(),
                animate: true,
              },
            ]);
            // history posting handled by centralized useEffect

            // After chat response, fetch updated mind map using last image id
            try {
              const imgId = sessionStorage.getItem("lastImageId") || imageId;
              if (imgId) {
                const nodes = await api.mindmap.byImage(imgId);
                // Save to session for any mindmap view to pick up
                // sessionStorage.setItem(
                //   "mindmap_nodes",
                //   JSON.stringify({ nodes, savedAt: Date.now() })
                // );
              }
            } catch (e) {
              // Non-blocking: ignore failures silently or log
              console.warn("mindmap fetch failed", e);
            }
          } catch (err) {
            console.error("chat.rag failed", err);
            toast.error("Chat failed");
            setMessages((prev) => [
              ...prev,
              {
                type: "assistant",
                content: "I couldn't process that chat request.",
                timestamp: new Date(),
                animate: true,
              },
            ]);
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
