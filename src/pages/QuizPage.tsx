import { useState } from "react";
import { QuizSetup } from "@/components/quiz/QuizSetup";
import { QuizRunner } from "@/components/quiz/QuizRunner";
import { QuizResults } from "@/components/quiz/QuizResults";
import { quizApi, type Quiz } from "@/lib/api";

type QuizMode = "setup" | "running" | "results";

type QuizRunnerConfig = {
  source?: string;
  quizType?: string;
  difficulty?: string;
  questionCount?: number;
  timer?: number | null; // minutes or null if disabled
};

type QuizRunResults = {
  answers: Record<number, string | number>;
  questions: Array<{
    type: string;
    question: string;
    options?: string[];
    correct: string | number;
  }>;
  score: number;
  timeSpent: number;
  config: QuizRunnerConfig;
};

export default function QuizPage() {
  const [mode, setMode] = useState<QuizMode>("setup");
  const [quizConfig, setQuizConfig] = useState<QuizRunnerConfig | null>(null);
  const [quizResults, setQuizResults] = useState<QuizRunResults | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuizStart = async (config: QuizRunnerConfig) => {
    setQuizConfig(config);
    setLoading(true);
    setError(null);
    try {
      // Prefer explicit quizId if present
      const storedQuizId = sessionStorage.getItem("quizId");
      if (storedQuizId && storedQuizId.trim()) {
        const data = await quizApi.byId(storedQuizId.trim());
        setQuiz(data);
        setMode("running");
        return;
      }
      const getQuizImageId = (): string | null => {
        // 1) Explicit quiz selection
        const selected = sessionStorage.getItem("quizSelectedImageId");
        if (selected && selected.trim()) return selected;
        // 2) Fallback to lastImageId (global)
        const last = sessionStorage.getItem("lastImageId");
        if (last && last.trim()) return last;
        // 3) Fallback to last of quizUploadedImageIds
        try {
          const raw = sessionStorage.getItem("quizUploadedImageIds");
          const list = raw ? (JSON.parse(raw) as string[]) : [];
          if (list.length) return list[list.length - 1] ?? null;
        } catch { /* ignore */ }
        // 4) Legacy fallback to imageId
        const img = sessionStorage.getItem("imageId");
        return img && img.trim() ? img : null;
      };
      const imageId = getQuizImageId();
      if (!imageId) {
        throw new Error("No imageId found in session — upload first or set sessionStorage.imageId");
      }
      const data = await quizApi.byImage(imageId);
      setQuiz(data);
      setMode("running");
    } catch (e) {
      // Show error and stay on setup; do NOT proceed with mock questions
      setError(e instanceof Error ? e.message : "Failed to load quiz");
      setQuiz(null);
      setMode("setup");
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = (results: QuizRunResults) => {
    setQuizResults(results);
    setMode("results");
  };

  const handleQuizReset = () => {
    setMode("setup");
    setQuizConfig(null);
    setQuizResults(null);
    setQuiz(null);
    setError(null);
  };

  return (
    <div className="h-full">
      {mode === "setup" && (
        <>
          <QuizSetup onStart={handleQuizStart} />
          {loading && (
            <div className="p-4 text-sm text-muted">Loading quiz…</div>
          )}
          {error && (
            <div className="p-4 text-sm text-error">{error}</div>
          )}
        </>
      )}
      
      {mode === "running" && quizConfig && (
        <QuizRunner 
          config={quizConfig} 
          quiz={quiz || undefined}
          onComplete={handleQuizComplete}
          onExit={handleQuizReset}
        />
      )}
      
      {mode === "results" && quizResults && (
        <QuizResults 
          results={quizResults}
          onRestart={handleQuizReset}
        />
      )}
    </div>
  );
}