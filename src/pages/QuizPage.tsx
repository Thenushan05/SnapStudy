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
  questions: Array<unknown>;
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
      const data = await quizApi.get();
      setQuiz(data);
      setMode("running");
    } catch (e) {
      // Show error but still proceed with mock questions in the runner
      setError(e instanceof Error ? e.message : "Failed to load quiz");
      setQuiz(null);
      setMode("running");
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