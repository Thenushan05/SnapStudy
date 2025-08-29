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
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;

  // normalize container
  const container = isObject(data)
    ? (data as Record<string, unknown>)
    : undefined;
  // Unwrap common envelopes: { data: {...} } or { data: { mindmap: {...} } }
  const inner = ((): Record<string, unknown> | undefined => {
    if (!container) return undefined;
    const c1 = container;
    if (isObject(c1.data)) {
      const d = c1.data as Record<string, unknown>;
      if (isObject(d.mindmap)) return d.mindmap as Record<string, unknown>;
      return d;
    }
    if (isObject(c1.mindmap)) return c1.mindmap as Record<string, unknown>;
    return c1;
  })();
  // New: support tree response { root: { id, text, children: [...] }, ... }
  if (inner && isObject(inner.root)) {
    type TreeNode = {
      id?: unknown;
      text?: unknown;
      title?: unknown;
      children?: unknown;
    };
    const root = inner.root as TreeNode;
    const nodesOut: MindMapNode[] = [];
    const edges: Array<{ source: string; target: string }> = [];

    const visit = (node: TreeNode, level: number, parentId?: string) => {
      const id = String(node.id ?? cryptoRandomId());
      const labelRaw =
        (typeof node.text === "string" && node.text) ||
        (typeof node.title === "string" && node.title) ||
        "";
      const label = String(labelRaw);
      const childrenArr = Array.isArray(node.children)
        ? (node.children as unknown[])
        : [];
      const childIds: string[] = [];
      for (const ch of childrenArr) {
        if (!isObject(ch)) continue;
        const cid = String((ch as TreeNode).id ?? cryptoRandomId());
        childIds.push(cid);
        edges.push({ source: id, target: cid });
      }
      nodesOut.push({
        id,
        label,
        x: 0,
        y: 0,
        level,
        children: childIds,
        parent: parentId,
      });
      for (const ch of childrenArr) {
        if (!isObject(ch)) continue;
        visit(ch as TreeNode, level + 1, id);
      }
    };

    visit(root, 0);

    // Simple layout: x by level, y stacked per level
    const grouped = new Map<number, MindMapNode[]>();
    for (const n of nodesOut)
      grouped.set(n.level, [...(grouped.get(n.level) || []), n]);
    for (const [lvl, list] of grouped) {
      list.forEach((n, idx) => {
        n.x = lvl * 240;
        n.y = idx * 100;
      });
    }
    return nodesOut;
  }

  // normalize container
  const rawNodes: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(container?.nodes)
    ? (container!.nodes as unknown[])
    : [];

  const rawEdges: Array<Record<string, unknown>> = Array.isArray(
    container?.edges
  )
    ? ((container!.edges as Array<unknown>).filter(isObject) as Array<
        Record<string, unknown>
      >)
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
    .filter(
      (n) => typeof n.id !== "undefined" && typeof n.label !== "undefined"
    )
    .map((n) => {
      // coordinates: support either x/y or position.{x,y}
      const pos = isObject(n.position)
        ? (n.position as Record<string, unknown>)
        : undefined;
      const xVal =
        typeof n.x === "number"
          ? n.x
          : typeof pos?.x === "number"
          ? pos.x
          : Number((pos?.x as unknown) ?? (n.x as unknown) ?? 0);
      const yVal =
        typeof n.y === "number"
          ? n.y
          : typeof pos?.y === "number"
          ? pos.y
          : Number((pos?.y as unknown) ?? (n.y as unknown) ?? 0);

      // children: prefer node.children, else derive from edges
      const childrenFromNode = Array.isArray(n.children)
        ? (n.children as unknown[]).map(String)
        : undefined;
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
  const hasUndefinedLevel = nodes.some(
    (n) => typeof n.level !== "number" || Number.isNaN(n.level)
  );
  if (hasUndefinedLevel) {
    const idToNode = new Map(nodes.map((n) => [n.id, n] as const));
    const roots = nodes.filter((n) => !inMap.get(n.id)?.length);
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
  sessions: {
    async list(opts?: { signal?: AbortSignal; path?: string }): Promise<
      Array<{
        id: string;
        title?: string;
        name?: string;
        sessionId?: string;
        imageId?: string;
        lastMessage?: string;
        createdAt?: string;
        updatedAt?: string;
      }>
    > {
      const path = opts?.path ?? "/api/sessions";
      const data = await http.get<unknown>(path, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
      const container =
        data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
      const arr: unknown = Array.isArray(data)
        ? data
        : Array.isArray(container?.data)
        ? (container!.data as unknown[])
        : Array.isArray(container?.sessions)
        ? (container!.sessions as unknown[])
        : Array.isArray(container?.items)
        ? (container!.items as unknown[])
        : [];
      const src = Array.isArray(arr) ? arr : [];
      return src.map((n) => {
        const o = n && typeof n === "object" ? (n as Record<string, unknown>) : {};
        const id = o.id ?? o._id ?? o.sessionId ?? cryptoRandomId();
        const titleRaw = o.title ?? o.name ?? o.summary ?? o.lastMessage ?? "Session";
        return {
          id: String(id),
          title: typeof titleRaw === "string" ? titleRaw : String(titleRaw ?? "Session"),
          name: typeof o.name === "string" ? o.name : undefined,
          sessionId: o.sessionId != null ? String(o.sessionId) : undefined,
          imageId: o.imageId != null ? String(o.imageId) : undefined,
          lastMessage: typeof o.lastMessage === "string" ? o.lastMessage : undefined,
          createdAt: o.createdAt != null ? String(o.createdAt) : undefined,
          updatedAt: o.updatedAt != null ? String(o.updatedAt) : undefined,
        };
      });
    },
  },
  mindmap: {
    async get(signal?: AbortSignal): Promise<MindMapNode[]> {
      const data = await http.get<unknown>("/mindmap", { signal });
      return parseMindMapResponse(data);
    },
    async byImage(
      imageId: string,
      signal?: AbortSignal
    ): Promise<MindMapNode[]> {
      if (!imageId) throw new Error("imageId is required");
      const path = `/api/mindmap/${encodeURIComponent(imageId)}`;
      const data = await http.get<unknown>(path, { signal, timeoutMs: 20000 });
      return parseMindMapResponse(data);
    },
    async save(
      imageId: string,
      nodes: MindMapNode[],
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{ success: boolean; message?: string }> {
      if (!imageId) throw new Error("imageId is required");
      if (!Array.isArray(nodes)) throw new Error("nodes array is required");
      const path = opts?.path ?? "/api/mindmap/save";
      try {
        await http.post(
          path,
          { imageId, nodes },
          { signal: opts?.signal, timeoutMs: 15000 }
        );
        return { success: true };
      } catch (err) {
        // Fallback to localStorage so user changes aren't lost
        try {
          const key = `mindmap:${imageId}`;
          const payload = { imageId, nodes, savedAt: new Date().toISOString() };
          localStorage.setItem(key, JSON.stringify(payload));
          return { success: true, message: "Saved locally (offline)" };
        } catch (_) {
          throw err instanceof Error
            ? err
            : new Error("Failed to save mind map");
        }
      }
    },
  },
  bookmarks: {
    async list(opts?: { signal?: AbortSignal; path?: string }): Promise<
      Array<{
        id: string;
        title?: string;
        content: string;
        createdAt?: string;
        updatedAt?: string;
        tags?: string[];
        priority?: string;
        refType?: string;
        refId?: string;
      }>
    > {
      const path = opts?.path ?? "/api/bookmarks";
      const data = await http.get<unknown>(path, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
      const container =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : undefined;
      // Helper to read array property from a generic container without using 'any'
      const getArrayProp = (
        obj: Record<string, unknown> | undefined,
        key: string
      ): unknown[] | undefined => {
        if (!obj) return undefined;
        const v = obj[key as keyof typeof obj] as unknown;
        return Array.isArray(v) ? (v as unknown[]) : undefined;
      };

      // Accept multiple common envelopes: root array, { data: [...] }, { bookmarks: [...] }, { results: [...] }, { items: [...] }
      const arrayData: unknown = Array.isArray(data)
        ? data
        : Array.isArray(container?.data)
        ? (container!.data as unknown[])
        : getArrayProp(container, "bookmarks")
        ?? getArrayProp(container, "results")
        ?? getArrayProp(container, "items")
        ?? [];
      const src = Array.isArray(arrayData) ? arrayData : [];
      return src.map((n: unknown) => {
        const o =
          n && typeof n === "object" ? (n as Record<string, unknown>) : {};
        const idRaw = o.id ?? o._id;
        const title = typeof o.title === "string" ? o.title : undefined;
        const contentRaw = o.content ?? o.description ?? o.note ?? o.text ?? "";
        const createdAt = o.createdAt != null ? String(o.createdAt) : undefined;
        const updatedAt = o.updatedAt != null ? String(o.updatedAt) : undefined;
        const tags = Array.isArray(o.tags)
          ? (o.tags as unknown[]).map(String)
          : undefined;
        const priority =
          typeof o.priority === "string" ? o.priority : undefined;
        const refType = typeof o.refType === "string" ? o.refType : undefined;
        const refId =
          typeof o.refId === "string"
            ? o.refId
            : o.ref &&
              typeof o.ref === "object" &&
              (o.ref as Record<string, unknown>)._id
            ? String((o.ref as Record<string, unknown>)._id)
            : undefined;
        return {
          id: idRaw != null ? String(idRaw) : cryptoRandomId(),
          title,
          content: String(contentRaw),
          createdAt,
          updatedAt,
          tags,
          priority,
          refType,
          refId,
        };
      });
    },
    async create(
      payload: { content: string; title?: string; tags?: string[] },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{ success?: boolean; id?: string; message?: string }> {
      if (!payload?.content) throw new Error("content is required");
      const path = opts?.path ?? "/api/bookmarks";
      const body: Record<string, unknown> = { content: payload.content };
      if (payload.title) body.title = payload.title;
      if (payload.tags) body.tags = payload.tags;
      const res = await http.post<unknown>(path, body, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
      const o =
        res && typeof res === "object"
          ? (res as Record<string, unknown>)
          : undefined;
      const id =
        o?.id ??
        (o?.data && typeof o.data === "object"
          ? (o.data as Record<string, unknown>).id
          : undefined) ??
        o?._id;
      return { success: true, id: id != null ? String(id) : undefined };
    },
    // New: create a bookmark referencing another entity (e.g., a calendar session)
    async createRef(
      payload: {
        refType: string; // e.g., "session"
        refId: string; // the referenced entity id
        title: string;
        description?: string;
        note?: string;
        priority?: "high" | "medium" | "low";
        tags?: string[];
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{ success?: boolean; id?: string; message?: string }> {
      if (!payload?.refType) throw new Error("refType is required");
      if (!payload?.refId) throw new Error("refId is required");
      if (!payload?.title) throw new Error("title is required");
      const path = opts?.path ?? "/api/bookmarks";
      const body: Record<string, unknown> = {
        refType: payload.refType,
        refId: payload.refId,
        title: payload.title,
      };
      if (payload.description !== undefined)
        body.description = payload.description;
      if (payload.note !== undefined) body.note = payload.note;
      if (payload.priority !== undefined) body.priority = payload.priority;
      if (payload.tags !== undefined) body.tags = payload.tags;
      const res = await http.post<unknown>(path, body, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
      const o =
        res && typeof res === "object"
          ? (res as Record<string, unknown>)
          : undefined;
      const id =
        o?.id ??
        (o?.data && typeof o.data === "object"
          ? (o.data as Record<string, unknown>).id
          : undefined) ??
        o?._id;
      return { success: true, id: id != null ? String(id) : undefined };
    },
  },
  calendar: {
    async entries(opts?: {
      signal?: AbortSignal;
      path?: string;
    }): Promise<unknown> {
      const path = opts?.path ?? "/api/calendar/entries";
      return http.get<unknown>(path, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
    },
    async create(
      payload: {
        title: string;
        subject: string;
        topic: string;
        startDate: string; // ISO string
        duration: number; // minutes
        priority: "high" | "medium" | "low";
        notes?: string;
        color?: string;
        emoji?: string;
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{
      success?: boolean;
      data?: { id?: string; _id?: string; [k: string]: unknown } | null;
      id?: string; // some backends may return id at root
      message?: string;
    }> {
      const path = opts?.path ?? "/api/calendar/create";
      return http.post(path, payload, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
    },
    async update(
      id: string,
      payload: {
        title: string;
        subject: string;
        topic: string;
        startDate: string; // ISO string
        duration: number; // minutes
        priority: "high" | "medium" | "low";
        notes?: string;
        color?: string;
        emoji?: string;
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{ success?: boolean; message?: string }> {
      if (!id) throw new Error("calendar entry id is required");
      const path =
        opts?.path ?? `/api/calendar/entry/${encodeURIComponent(id)}`;
      return http.put(path, payload, {
        signal: opts?.signal,
        timeoutMs: 15000,
      });
    },
    async delete(
      id: string,
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{ success?: boolean; message?: string }> {
      if (!id) throw new Error("calendar entry id is required");
      const path =
        opts?.path ?? `/api/calendar/entry/${encodeURIComponent(id)}`;
      return http.delete(path, { signal: opts?.signal, timeoutMs: 15000 });
    },
  },
  quiz: {
    async byImage(
      imageId: string,
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<Quiz> {
      if (!imageId) throw new Error("imageId is required");
      const path = opts?.path ?? `/api/quiz/${encodeURIComponent(imageId)}`;
      const data = await http.get<unknown>(path, {
        signal: opts?.signal,
        timeoutMs: 20000,
      });
      const parsed = parseQuizResponse(data);
      if (!parsed) throw new Error("Invalid quiz response");
      return parsed;
    },
  },
  // Minimal image upload API. Expects backend to return { url: string }
  // Path defaults to "/upload"; adjust as needed to match your server.
  upload: {
    async image(
      form: FormData,
      opts?: { path?: string; signal?: AbortSignal }
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
      opts?: {
        filename?: string;
        tags?: string[];
        sessionId?: string;
        path?: string;
        signal?: AbortSignal;
      }
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
      fd.append(
        "image",
        file,
        (opts?.filename ?? "upload") +
          (file instanceof File && file.name.includes(".") ? "" : ".png")
      );
      if (opts?.sessionId) fd.append("sessionId", opts.sessionId);
      if (opts?.tags?.length) fd.append("tags", opts.tags.join(","));
      return this.image(fd, { path: opts?.path, signal: opts?.signal });
    },
  },
  process: {
    async image(
      payload: {
        imageId: string;
        userId?: string;
        options?: Record<string, unknown>;
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{
      success: boolean;
      data: {
        imageId: string;
        sessionId: string;
        summary: string;
        evidence: Array<{
          id: string;
          text: string;
          confidence?: number;
          bbox?: unknown;
          ocrMethod?: string;
        }>;
        evidenceCount: number;
        processingTime: number;
        message?: string;
      };
      message?: string;
    }> {
      const path = opts?.path ?? "/api/process";
      if (!payload?.imageId) throw new Error("imageId is required");
      return http.post(path, payload, {
        signal: opts?.signal,
        timeoutMs: 60000,
      });
    },
  },
  chat: {
    async rag(
      payload: {
        sessionId: string;
        imageId: string;
        text?: string;
        message?: string;
        userId?: string;
        options?: Record<string, unknown>;
        context?: string;
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{
      success: boolean;
      data?: {
        reply?: string;
        sessionId?: string;
        citations?: unknown[];
        response?: { content?: string; [k: string]: unknown };
        [k: string]: unknown;
      };
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
    async postHistory(
      payload: {
        sessionId: string;
        role: "user" | "assistant";
        text: string;
        messageType?: string;
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<{ success?: boolean; message?: string }> {
      if (!payload?.sessionId) throw new Error("sessionId is required");
      const path =
        opts?.path ??
        `/api/sessions/${encodeURIComponent(payload.sessionId)}/chat`;
      const body = {
        role: payload.role,
        text: payload.text,
        messageType: payload.messageType ?? "chat",
      } as const;
      return http.post(path, body, { signal: opts?.signal, timeoutMs: 20000 });
    },
  },
  // Notes API for saving editor content
  notes: {
    async save(
      payload: {
        id: string;
        title: string;
        content: string;
        tags: string[];
        tagsCsv?: string;
      },
      opts?: { signal?: AbortSignal; path?: string }
    ): Promise<unknown> {
      if (!payload?.id) throw new Error("Note id is required");
      const body: Record<string, unknown> = {
        title: payload.title,
        content: payload.content,
        tags: payload.tags,
      };
      if (payload.tagsCsv !== undefined) body.tagsCsv = payload.tagsCsv;
      // PUT to /notes/:id by default; allow fixed override like /notes/note_123
      const path = opts?.path ?? `/notes/${encodeURIComponent(payload.id)}`;
      return http.put(path, body, { signal: opts?.signal, timeoutMs: 10000 });
    },
    async get(
      idOrPath?: { id?: string; path?: string },
      opts?: { signal?: AbortSignal }
    ): Promise<unknown> {
      const path =
        idOrPath?.path ??
        (idOrPath?.id
          ? `/notes/${encodeURIComponent(idOrPath.id)}`
          : "/notes/note_123");
      return http.get(path, { signal: opts?.signal, timeoutMs: 10000 });
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
  if (o.quiz && typeof o.quiz === "object") {
    o = o.quiz as Record<string, unknown>;
  } else if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    o =
      d.quiz && typeof d.quiz === "object"
        ? (d.quiz as Record<string, unknown>)
        : d;
  }
  const questions = Array.isArray(o.questions)
    ? ((o.questions as unknown[]).filter(
        (q) => q && typeof q === "object"
      ) as Record<string, unknown>[])
    : [];
  return {
    quizId: String(o.quizId ?? ""),
    title: String(o.title ?? "Quiz"),
    difficulty: o.difficulty ? String(o.difficulty) : undefined,
    totalQuestions: Number(o.totalQuestions ?? questions.length),
    createdAt: o.createdAt ? String(o.createdAt) : undefined,
    updatedAt: o.updatedAt ? String(o.updatedAt) : undefined,
    questions: questions.map((q) => {
      const typeStr = (
        q.type === "short" ? "short-answer" : String(q.type || "mcq")
      ) as QuizQuestionType;
      const options = Array.isArray(q.options)
        ? (q.options as unknown[]).map(String)
        : undefined;
      let correct: number | string = 0;
      if (
        typeof q.correctAnswer === "number" ||
        typeof q.correctAnswer === "string"
      ) {
        if (
          (typeStr === "mcq" || typeStr === "flashcard") &&
          typeof q.correctAnswer === "string"
        ) {
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
      if (typeof o.metadata !== "object" || o.metadata === null)
        return undefined;
      const m = o.metadata as Record<string, unknown>;
      const subject = typeof m.subject === "string" ? m.subject : undefined;
      const topic = typeof m.topic === "string" ? m.topic : undefined;
      const createdBy =
        typeof m.createdBy === "string" ? m.createdBy : undefined;
      const tags = Array.isArray(m.tags)
        ? (m.tags as unknown[]).map(String)
        : undefined;
      return { subject, topic, createdBy, tags } satisfies QuizMetadata;
    })(),
  } satisfies Quiz;
}

function cryptoRandomId() {
  try {
    // Browser crypto
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export const quizApi = {
  async get(signal?: AbortSignal): Promise<Quiz> {
    // Debug: show which base URL is used and when request is attempted
    console.log("[quizApi] GET", `${BASE_URL}/quiz`);
    try {
      const data = await http.get<unknown>("/quiz", {
        signal,
        timeoutMs: 10000,
      });
      const parsed = parseQuizResponse(data);
      if (parsed) return parsed;
      console.warn(
        "[quizApi] Invalid response shape from /quiz, trying /quiz.json fallback"
      );
    } catch (err) {
      console.warn(
        "[quizApi] /quiz request failed, trying /quiz.json fallback",
        err
      );
    }

    // Fallback to public/quiz.json (place the JSON you shared into public/quiz.json)
    const fallbackUrl = `${window.location.origin}/quiz.json`;
    console.log("[quizApi] GET", fallbackUrl);
    const fbData = await http.get<unknown>(fallbackUrl, {
      signal,
      timeoutMs: 10000,
    });
    const fbParsed = parseQuizResponse(fbData);
    if (!fbParsed) throw new Error("Invalid quiz response (fallback)");
    return fbParsed;
  },
  async byImage(imageId: string, signal?: AbortSignal): Promise<Quiz> {
    if (!imageId) throw new Error("imageId is required");
    const path = `/api/quiz/${encodeURIComponent(imageId)}`;
    const data = await http.get<unknown>(path, { signal, timeoutMs: 20000 });
    const parsed = parseQuizResponse(data);
    if (!parsed) throw new Error("Invalid quiz response");
    return parsed;
  },
} as const;
