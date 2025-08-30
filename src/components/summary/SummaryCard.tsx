import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

export type ParsedSummary = {
  title?: string;
  overview?: string;
  evidence?: string;
  keyTopics?: string[];
  contentType?: string;
};

function parseSummary(raw: string): ParsedSummary {
  if (!raw) return {};
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const res: ParsedSummary = {};
  const getAfter = (line: string, marker: string) =>
    line.slice(line.indexOf(marker) + marker.length).trim();

  for (const line of lines) {
    if (!res.title && (line.startsWith("📚") || line.toLowerCase().startsWith("summary"))) {
      // e.g. "summary": "📚 Chemistry Notes" or just title line
      const t = line.replace(/^summary\s*:\s*/i, "").trim();
      res.title = t.replace(/^📚\s*/, "");
      continue;
    }
    if (line.startsWith("🔍")) {
      // 🔍 Content Overview: ...
      const marker = /content overview\s*:/i.test(line)
        ? line.match(/content overview\s*:/i)![0]
        : "";
      res.overview = marker ? getAfter(line, marker) : line.replace(/^🔍\s*/, "");
      continue;
    }
    if (line.startsWith("📊")) {
      // 📊 Evidence Records: ...
      const marker = /evidence records\s*:/i.test(line)
        ? line.match(/evidence records\s*:/i)![0]
        : "";
      res.evidence = marker ? getAfter(line, marker) : line.replace(/^📊\s*/, "");
      continue;
    }
    if (line.startsWith("📝")) {
      // 📝 Key Topics: a, b, c
      const marker = /key topics\s*:/i.test(line)
        ? line.match(/key topics\s*:/i)![0]
        : "";
      const topicsStr = marker ? getAfter(line, marker) : line.replace(/^📝\s*/, "");
      res.keyTopics = topicsStr
        .split(/,|•|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (line.startsWith("🔬")) {
      // 🔬 Content Type: Biology
      const marker = /content type\s*:/i.test(line)
        ? line.match(/content type\s*:/i)![0]
        : "";
      res.contentType = marker ? getAfter(line, marker) : line.replace(/^🔬\s*/, "");
      continue;
    }
  }

  return res;
}

export interface SummaryCardProps {
  summary: string; // raw summary string
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary, className }) => {
  const parsed = React.useMemo(() => parseSummary(summary), [summary]);
  const topicColors = [
    "bg-blue-100 text-blue-800",
    "bg-emerald-100 text-emerald-800",
    "bg-amber-100 text-amber-800",
    "bg-fuchsia-100 text-fuchsia-800",
    "bg-cyan-100 text-cyan-800",
    "bg-rose-100 text-rose-800",
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <CardTitle className="text-xl md:text-2xl">
            {parsed.title || "Summary"}
          </CardTitle>
          {parsed.contentType ? (
            <Badge className="ml-auto bg-indigo-600 hover:bg-indigo-600">
              {parsed.contentType}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 pt-4">
        {parsed.overview && (
          <section className="rounded-lg border border-muted-foreground/10 bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span>🔍</span>
              <span>Content Overview</span>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-sm md:text-base">
              {parsed.overview}
            </p>
          </section>
        )}

        {parsed.keyTopics && parsed.keyTopics.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <span>📝</span>
              <span>Key Topics</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {parsed.keyTopics.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    topicColors[i % topicColors.length]
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {parsed.evidence && (
          <section className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-950/30">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <span>📊</span>
              <span>Evidence Records</span>
            </div>
            <p className="text-sm md:text-base">{parsed.evidence}</p>
          </section>
        )}
      </CardContent>
    </Card>
  );
};

export default SummaryCard;
