import { http, BASE_URL } from "./http";

export interface MindMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  level: number;
  children: string[];
  parent?: string;
}

// Defensive parsing to adapt to { nodes: [...] } or direct array responses
function parseMindMapResponse(data: unknown): MindMapNode[] {
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

  // normalize container
  const container = isObject(data) ? (data as Record<string, unknown>) : undefined;
  const rawNodes: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(container?.nodes)
    ? (container!.nodes as unknown[])
    : [];

  const rawEdges: Array<Record<string, unknown>> = Array.isArray(container?.edges)
    ? (container!.edges as Array<unknown>).filter(isObject) as Array<Record<string, unknown>>
    : [];

  // Build edge maps if present
  const outMap = new Map<string, string[]>();
  const inMap = new Map<string, string[]>();
  for (const e of rawEdges) {
    const s = e.source != null ? String(e.source) : undefined;
    const t = e.target != null ? String(e.target) : undefined;
    if (!s || !t) continue;
    outMap.set(s, [...(outMap.get(s) || []), t]);
    inMap.set(t, [...(inMap.get(t) || []), s]);
  }

  // First pass map nodes with coordinates
  const nodes = rawNodes
    .filter((n): n is Record<string, unknown> => isObject(n))
    .filter((n) => typeof n.id !== "undefined" && typeof n.label !== "undefined")
    .map((n) => {
      // coordinates: support either x/y or position.{x,y}
      const pos = isObject(n.position) ? (n.position as Record<string, unknown>) : undefined;
      const xVal = typeof n.x === "number" ? n.x : (typeof pos?.x === "number" ? pos.x : Number((pos?.x as unknown) ?? (n.x as unknown) ?? 0));
      const yVal = typeof n.y === "number" ? n.y : (typeof pos?.y === "number" ? pos.y : Number((pos?.y as unknown) ?? (n.y as unknown) ?? 0));

      // children: prefer node.children, else derive from edges
      const childrenFromNode = Array.isArray(n.children) ? (n.children as unknown[]).map(String) : undefined;
      const childrenFromEdges = outMap.get(String(n.id)) || [];
      const children = childrenFromNode ?? childrenFromEdges;

      // parent via incoming edges (first)
      const parent = (inMap.get(String(n.id)) || [])[0];

      // level: if provided, use it; else compute later
      const level = typeof n.level === "number" ? n.level : undefined;

      return {
        id: String(n.id),
        label: String(n.label),
        x: Number(xVal ?? 0),
        y: Number(yVal ?? 0),
        level: level as number | undefined as number, // temp, will fix below
        children,
        parent,
      } as MindMapNode;
    });

  // If any node has undefined level, compute via BFS from roots
  const hasUndefinedLevel = nodes.some((n) => typeof n.level !== "number" || Number.isNaN(n.level));
  if (hasUndefinedLevel) {
    const idToNode = new Map(nodes.map((n) => [n.id, n] as const));
    const roots = nodes.filter((n) => !(inMap.get(n.id)?.length));
    const queue: Array<{ id: string; level: number }> = [];
    if (roots.length === 0 && nodes.length) {
      queue.push({ id: nodes[0].id, level: 0 });
    } else {
      for (const r of roots) queue.push({ id: r.id, level: 0 });
    }
    const visited = new Set<string>();
    while (queue.length) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = idToNode.get(id);
      if (!node) continue;
      node.level = level;
      const children = Array.isArray(node.children) ? node.children : [];
      for (const cid of children) {
        queue.push({ id: cid, level: level + 1 });
      }
    }
    // Any remaining undefined levels default to 0
    for (const n of nodes) {
      if (typeof n.level !== "number" || Number.isNaN(n.level)) n.level = 0;
    }
  }

  return nodes.map((n) => ({
    ...n,
    level: typeof n.level === "number" ? n.level : 0,
    children: Array.isArray(n.children) ? n.children : [],
    parent: n.parent,
  }));
}

// High-level, extendable API surface
export const api = {
  mindmap: {
    async get(signal?: AbortSignal): Promise<MindMapNode[]> {
      const data = await http.get<unknown>("/mindmap", { signal });
      return parseMindMapResponse(data);
    },
    // Example for future endpoints:
    // create(payload: { title: string; root: string }, signal?: AbortSignal) {
    //   return http.post("/mindmap", payload, { signal });
    // },
  },
  // Minimal image upload API. Expects backend to return { url: string }
  // Path defaults to "/upload"; adjust as needed to match your server.
  upload: {
    async image(form: FormData, opts?: { path?: string; signal?: AbortSignal }): Promise<{
      success: boolean;
      image: {
        id: string;
        cloudinaryId: string;
        url: string;
        width?: number;
        height?: number;
        format?: string;
        size?: number;
        uploadedAt?: string | Date;
        userId?: string;
        sessionId?: string | null;
        tags?: string[];
      };
    }> {
      // Backend route is POST /api/upload with field name 'image'
      const path = opts?.path ?? "/api/upload";
      const res = await http.post<{
        success: boolean;
        image: {
          id: string;
          cloudinaryId: string;
          url: string;
          width?: number;
          height?: number;
          format?: string;
          size?: number;
          uploadedAt?: string | Date;
          userId?: string;
          sessionId?: string | null;
          tags?: string[];
        };
      }>(path, form, { signal: opts?.signal, timeoutMs: 20000 });
      return res;
    },
    async imageFile(
      file: File | Blob,
      opts?: { filename?: string; tags?: string[]; sessionId?: string; path?: string; signal?: AbortSignal }
    ): Promise<{
      success: boolean;
      image: {
        id: string;
        cloudinaryId: string;
        url: string;
        width?: number;
        height?: number;
        format?: string;
        size?: number;
        uploadedAt?: string | Date;
        userId?: string;
        sessionId?: string | null;
        tags?: string[];
      };
    }> {
      const fd = new FormData();
      fd.append('image', file, (opts?.filename ?? 'upload') + (file instanceof File && file.name.includes('.') ? '' : '.png'));
      if (opts?.sessionId) fd.append('sessionId', opts.sessionId);
      if (opts?.tags?.length) fd.append('tags', opts.tags.join(','));
      return this.image(fd, { path: opts?.path, signal: opts?.signal });
    }
  },
  process: {
    async image(
      payload: { imageId: string; userId?: string; options?: Record<string, unknown> },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{
      success: boolean;
      data: {
        imageId: string;
        sessionId: string;
        summary: string;
        evidence: Array<{ id: string; text: string; confidence?: number; bbox?: unknown; ocrMethod?: string }>;
        evidenceCount: number;
        processingTime: number;
        message?: string;
      };
      message?: string;
    }> {
      const path = opts?.path ?? "/api/process";
      if (!payload?.imageId) throw new Error("imageId is required");
      return http.post(path, payload, { signal: opts?.signal, timeoutMs: 60000 });
    },
  },
  chat: {
    async rag(
      payload: { sessionId: string; imageId: string; text?: string; message?: string; userId?: string; options?: Record<string, unknown>; context?: string },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{
      success: boolean;
      data?: { reply?: string; sessionId?: string; citations?: unknown[]; response?: { content?: string; [k: string]: unknown }; [k: string]: unknown };
      message?: string;
    }> {
      const path = opts?.path ?? "/api/chat/rag";
      if (!payload?.sessionId) throw new Error("sessionId is required");
      if (!payload?.imageId) throw new Error("imageId is required");
      const msg = (payload.message ?? payload.text ?? "").trim();
      if (!msg) throw new Error("message text is required");
      const body = {
        sessionId: payload.sessionId,
        imageId: payload.imageId,
        message: msg,
        context: payload.context ?? "study_session",
        userId: payload.userId,
        options: payload.options,
      } as Record<string, unknown>;
      return http.post(path, body, { signal: opts?.signal, timeoutMs: 60000 });
    },
  },
  // Notes API for saving editor content
  notes: {
    async save(payload: { id: string; title: string; content: string; tags: string[] }, opts?: { signal?: AbortSignal }) {
      if (!payload?.id) throw new Error("Note id is required");
      const body = { title: payload.title, content: payload.content, tags: payload.tags };
      // PUT to /notes/:id. Adjust path if your backend differs.
      await http.put(`/notes/${encodeURIComponent(payload.id)}`, body, { signal: opts?.signal, timeoutMs: 10000 });
    },
  },
} as const;

// Backward-compatible helper
export async function getMindMap(signal?: AbortSignal): Promise<MindMapNode[]> {
  return api.mindmap.get(signal);
}

export { BASE_URL };

// ===================== Quiz API =====================
export type QuizQuestionType = "mcq" | "short-answer" | "flashcard";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  // For MCQ/flashcard, index of correct option. For short-answer, a string.
  correctAnswer: number | string;
  explanation?: string;
}

export interface QuizMetadata {
  subject?: string;
  topic?: string;
  createdBy?: string;
  tags?: string[];
}

export interface Quiz {
  quizId: string;
  title: string;
  difficulty?: string;
  totalQuestions: number;
  createdAt?: string;
  updatedAt?: string;
  questions: QuizQuestion[];
  metadata?: QuizMetadata;
}

function parseQuizResponse(data: unknown): Quiz | null {
  if (!data || typeof data !== "object") return null;
  // Unwrap common shapes: { quiz: {...} } or { data: {...} } or { data: { quiz: {...} }}
  let o = data as Record<string, unknown>;
  if (o.quiz && typeof o.quiz === 'object') {
    o = o.quiz as Record<string, unknown>;
  } else if (o.data && typeof o.data === 'object') {
    const d = o.data as Record<string, unknown>;
    o = (d.quiz && typeof d.quiz === 'object') ? d.quiz as Record<string, unknown> : d;
  }
  const questions = Array.isArray(o.questions) ? (o.questions as unknown[]).filter((q) => q && typeof q === 'object') as Record<string, unknown>[] : [];
  return {
    quizId: String(o.quizId ?? ""),
    title: String(o.title ?? "Quiz"),
    difficulty: o.difficulty ? String(o.difficulty) : undefined,
    totalQuestions: Number(o.totalQuestions ?? questions.length),
    createdAt: o.createdAt ? String(o.createdAt) : undefined,
    updatedAt: o.updatedAt ? String(o.updatedAt) : undefined,
    questions: questions.map((q) => {
      const typeStr = (q.type === 'short' ? 'short-answer' : String(q.type || 'mcq')) as QuizQuestionType;
      const options = Array.isArray(q.options) ? (q.options as unknown[]).map(String) : undefined;
      let correct: number | string = 0;
      if (typeof q.correctAnswer === 'number' || typeof q.correctAnswer === 'string') {
        if ((typeStr === 'mcq' || typeStr === 'flashcard') && typeof q.correctAnswer === 'string') {
          const n = parseInt(q.correctAnswer as string, 10);
          correct = Number.isFinite(n) ? n : 0;
        } else {
          correct = q.correctAnswer as number | string;
        }
      }
      return {
        id: String(q.id ?? cryptoRandomId()),
        type: typeStr,
        question: String(q.question ?? ""),
        options,
        correctAnswer: correct,
        explanation: q.explanation ? String(q.explanation) : undefined,
      } as QuizQuestion;
    }),
    metadata: (() => {
      if (typeof o.metadata !== 'object' || o.metadata === null) return undefined;
      const m = o.metadata as Record<string, unknown>;
      const subject = typeof m.subject === 'string' ? m.subject : undefined;
      const topic = typeof m.topic === 'string' ? m.topic : undefined;
      const createdBy = typeof m.createdBy === 'string' ? m.createdBy : undefined;
      const tags = Array.isArray(m.tags) ? (m.tags as unknown[]).map(String) : undefined;
      return { subject, topic, createdBy, tags } satisfies QuizMetadata;
    })(),
  } satisfies Quiz;
}

function cryptoRandomId() {
  try {
    // Browser crypto
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export const quizApi = {
  async get(signal?: AbortSignal): Promise<Quiz> {
    // Debug: show which base URL is used and when request is attempted
    console.log("[quizApi] GET", `${BASE_URL}/quiz`);
    try {
      const data = await http.get<unknown>("/quiz", { signal, timeoutMs: 10000 });
      const parsed = parseQuizResponse(data);
      if (parsed) return parsed;
      console.warn("[quizApi] Invalid response shape from /quiz, trying /quiz.json fallback");
    } catch (err) {
      console.warn("[quizApi] /quiz request failed, trying /quiz.json fallback", err);
    }

    // Fallback to public/quiz.json (place the JSON you shared into public/quiz.json)
    const fallbackUrl = `${window.location.origin}/quiz.json`;
    console.log("[quizApi] GET", fallbackUrl);
    const fbData = await http.get<unknown>(fallbackUrl, { signal, timeoutMs: 10000 });
    const fbParsed = parseQuizResponse(fbData);
    if (!fbParsed) throw new Error("Invalid quiz response (fallback)");
    return fbParsed;
  },
} as const;
