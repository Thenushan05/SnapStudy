import { useState, useMemo, useEffect } from "react";
import { Clock, MessageSquare, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSearchParams } from "react-router-dom";

function timeAgo(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [params] = useSearchParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chat-history-sessions"],
    queryFn: () => api.chat.historySessions(),
    staleTime: 30_000,
  });
  const selected = useMemo(() => (openId && data ? data.find(s => s.id === openId) : null), [openId, data]);

  // Auto-open a session if sessionId is provided in query string
  useEffect(() => {
    const sid = params.get("sessionId");
    if (!sid || !data || !data.length) return;
    const exists = data.find((s) => s.id === sid);
    if (exists) setOpenId(sid);
  }, [params, data]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Chat History</h1>
          <p className="text-muted">Review your past conversations</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>Refresh</Button>
      </div>

      {isLoading && (
        <div className="text-muted">Loading chat history…</div>
      )}
      {isError && (
        <div className="text-red-600 dark:text-red-400">Failed to load history.</div>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4">
          {(data && data.length ? data : []).map((session) => {
            const last = (session.messages && session.messages.length)
              ? session.messages[session.messages.length - 1]
              : undefined;
            const isUser = (last?.role || "assistant").toLowerCase() === "user";
            const Icon = isUser ? User : MessageSquare;
            const title = session.title || "New Chat";
            const subtitle = `${session.messageCount ?? session.messages.length} message${(session.messageCount ?? session.messages.length) === 1 ? "" : "s"}`;
            return (
              <Card key={session.id} className="surface-interactive">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold text-text flex items-center gap-2">
                          {title}
                          <Badge variant="secondary" className="ml-1">{subtitle}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted">
                          <Clock className="w-3 h-3" />
                          {timeAgo(session.updatedAt || session.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(session.id)}>View Chat</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-foreground whitespace-pre-wrap line-clamp-3">
                    {last?.content || ""}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
          {data && data.length === 0 && (
            <div className="text-muted">No chat sessions yet.</div>
          )}
        </div>
      )}

      {/* View Chat Dialog */}
      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="sm:max-w-2xl w-screen sm:w-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title || "Chat Session"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected?.messages && selected.messages.length > 0 ? (
              <div className="space-y-3">
                {[...selected.messages]
                  .sort((a, b) => {
                    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    if (ta !== tb) return ta - tb; // chronological
                    const wa = (a.role || "assistant").toLowerCase() === "user" ? 0 : 1;
                    const wb = (b.role || "assistant").toLowerCase() === "user" ? 0 : 1;
                    return wa - wb; // user before assistant when same time
                  })
                  .map((m, idx) => {
                  const role = (m.role || "assistant").toLowerCase();
                  const Icon = role === "user" ? User : MessageSquare;
                  return (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-md border bg-background">
                      <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted mb-1">
                          <span className="capitalize">{role}</span>
                          {m.timestamp && <span>• {timeAgo(m.timestamp)}</span>}
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{m.content || ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted">No messages in this session.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}