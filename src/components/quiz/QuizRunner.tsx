import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, ArrowLeft, ArrowRight, Flag } from "lucide-react";
import type { Quiz } from "@/lib/api";

type UINormalizedQuestion = {
  id: string | number;
  type: "mcq" | "short" | "short-answer" | "flashcard";
  question: string;
  options?: string[];
  correct: number | string;
  explanation?: string;
};

// Mock quiz data
const mockQuestions: UINormalizedQuestion[] = [
  {
    id: 1,
    type: "mcq",
    question: "What is the formula for the quadratic equation?",
    options: [
      "ax² + bx + c = 0",
      "ax + b = 0", 
      "ax³ + bx² + cx + d = 0",
      "ax² + b = 0"
    ],
    correct: 0
  },
  {
    id: 2,
    type: "short",
    question: "Explain the process of photosynthesis in plants.",
    correct: "Photosynthesis is the process by which plants convert light energy into chemical energy..."
  },
  {
    id: 3,
    type: "mcq",
    question: "Which organelle is responsible for cellular respiration?",
    options: [
      "Nucleus",
      "Mitochondria",
      "Chloroplast", 
      "Ribosome"
    ],
    correct: 1
  }
];

type QuizRunnerConfig = {
  timer?: number; // minutes
};

interface QuizRunnerProps {
  config: QuizRunnerConfig;
  quiz?: Quiz;
  onComplete: (results: {
    answers: Record<number, string | number>;
    questions: UINormalizedQuestion[];
    score: number;
    timeSpent: number;
    config: QuizRunnerConfig;
  }) => void;
  onExit: () => void;
}

export function QuizRunner({ config, quiz, onComplete, onExit }: QuizRunnerProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(config.timer ? config.timer * 60 : null);
  const submittedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null); // epoch ms when quiz should auto-submit
  const [locked, setLocked] = useState<Record<number, boolean>>({});
  const [isCorrectMap, setIsCorrectMap] = useState<Record<number, boolean>>({});
  const [warnedOneMinute, setWarnedOneMinute] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const questions = useMemo<UINormalizedQuestion[]>(() => {
    if (quiz && Array.isArray(quiz.questions) && quiz.questions.length) {
      return quiz.questions.map((q) => ({
        id: q.id,
        type: (q.type === 'short-answer' ? 'short-answer' : q.type) as UINormalizedQuestion["type"],
        question: q.question,
        options: q.options,
        correct: q.correctAnswer, // number | string
        explanation: q.explanation,
      }));
    }
    return mockQuestions;
  }, [quiz]);

  const handleSubmitQuiz = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    // inline score computation to avoid extra deps
    let correct = 0;
    questions.forEach((question, index) => {
      const userAnswer = answers[index];
      if (question.type === "mcq" || question.type === "flashcard") {
        if (typeof question.correct === 'number' && userAnswer === question.correct) correct++;
      } else if (question.type === "short" || question.type === "short-answer") {
        if (typeof question.correct === 'string' && typeof userAnswer === 'string') {
          const a = userAnswer.trim().toLowerCase();
          const b = question.correct.trim().toLowerCase();
          if (a === b) correct++;
        }
      }
    });
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

    const results = {
      answers,
      questions,
      score,
      timeSpent: config.timer ? (config.timer * 60 - (timeLeft || 0)) : 0,
      config,
    };
    onComplete(results);
  }, [answers, questions, config, timeLeft, onComplete]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!config.timer) return; // no timer configured
    // Initialize deadline if needed
    if (!deadlineRef.current) {
      const seconds = Math.max(0, Math.floor((config.timer || 0) * 60));
      deadlineRef.current = Date.now() + seconds * 1000;
      setTimeLeft(seconds);
    }
    // Start a stable interval that doesn't depend on timeLeft
    const id = window.setInterval(() => {
      if (submittedRef.current) return;
      const dl = deadlineRef.current;
      if (!dl) return;
      const diffMs = dl - Date.now();
      const secs = Math.max(0, Math.ceil(diffMs / 1000));
      setTimeLeft(secs);
      if (secs <= 0) {
        handleSubmitQuiz();
      }
    }, 1000);
    intervalRef.current = id;
    return () => {
      clearInterval(id);
      intervalRef.current = null;
    };
  }, [config.timer, handleSubmitQuiz]);

  // Reset timer and submitted flag when config.timer changes (e.g., new run)
  useEffect(() => {
    submittedRef.current = false;
    if (config.timer && config.timer > 0) {
      const seconds = Math.max(0, Math.floor(config.timer * 60));
      deadlineRef.current = Date.now() + seconds * 1000;
      setTimeLeft(seconds);
    } else {
      deadlineRef.current = null;
      setTimeLeft(null);
    }
    setWarnedOneMinute(false);
  }, [config.timer]);

  // One-time warning state when 60 seconds remain (inline, non-blocking)
  useEffect(() => {
    if (timeLeft === null) return;
    if (!warnedOneMinute && timeLeft === 60) {
      setWarnedOneMinute(true);
      // Non-blocking notice; avoid alert which can pause timers
    }
  }, [timeLeft, warnedOneMinute]);

  const handleAnswer = (answer: string | number) => {
    const q = questions[currentQuestion];
    // If already locked, ignore further changes
    if (locked[currentQuestion]) return;

    // Update answer
    setAnswers(prev => ({ ...prev, [currentQuestion]: answer }));

    if (q.type === "mcq" || q.type === "flashcard") {
      const correct = typeof q.correct === 'number' && answer === q.correct;
      setIsCorrectMap(prev => ({ ...prev, [currentQuestion]: !!correct }));
      setLocked(prev => ({ ...prev, [currentQuestion]: true }));
      // Log the answer
      console.log("Answered", { index: currentQuestion, answer, correct });
    }
  };

  const submitShortAnswer = () => {
    const q = questions[currentQuestion];
    if (!(q.type === "short" || q.type === "short-answer")) return;
    if (locked[currentQuestion]) return;
    const ans = answers[currentQuestion];
    let correct = false;
    if (typeof q.correct === 'string' && typeof ans === 'string') {
      const a = ans.trim().toLowerCase();
      const b = q.correct.trim().toLowerCase();
      correct = a === b;
    }
    setIsCorrectMap(prev => ({ ...prev, [currentQuestion]: correct }));
    setLocked(prev => ({ ...prev, [currentQuestion]: true }));
    console.log("Answered", { index: currentQuestion, answer: ans, correct });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      const next = currentQuestion + 1;
      // Clear any pre-existing selection/state for the next question
      setAnswers(prev => {
        const copy = { ...prev };
        delete copy[next];
        return copy;
      });
      setLocked(prev => ({ ...prev, [next]: false }));
      setIsCorrectMap(prev => ({ ...prev, [next]: false }));
      setCurrentQuestion(next);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  // handleSubmitQuiz moved above and memoized; score computed inline

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLocked = !!locked[currentQuestion];
  const isCorrect = isCorrectMap[currentQuestion];
  const totalSeconds = config.timer ? Math.max(0, Math.floor(config.timer * 60)) : null;
  const timePercent = (timeLeft !== null && totalSeconds) ? Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100)) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onExit}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="text-sm text-muted">
                Question {currentQuestion + 1} of {questions.length}
              </div>
              <Progress value={progress} className="w-32 mt-1" />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div
                className={`px-3 py-1 rounded-md border font-mono flex items-center gap-2 text-base md:text-lg ${timeLeft <= 60 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700" : "bg-accent/10 text-accent border-accent/40"}`}
                aria-live="polite"
                aria-label={`Time remaining ${formatTime(timeLeft)}`}
                title={totalSeconds ? `Time remaining: ${formatTime(timeLeft)} of ${formatTime(totalSeconds)}` : `Time remaining: ${formatTime(timeLeft)}`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}
            {timeLeft !== null && warnedOneMinute && (
              <div className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                1 minute remaining
              </div>
            )}
            <Button variant="outline" onClick={handleSubmitQuiz}>
              <Flag className="w-4 h-4 mr-2" />
              Submit
            </Button>
          </div>
        </div>
        {timePercent !== null && (
          <div className="mt-3">
            <Progress value={timePercent} className="h-2" />
          </div>
        )}
      </div>

      {/* Question */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <Card className="surface-elevated">
            <CardHeader>
              <CardTitle className="text-xl leading-relaxed">
                {question.question}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(question.type === "mcq" || question.type === "flashcard") && (
                <RadioGroup
                  key={currentQuestion}
                  name={`q-${currentQuestion}`}
                  value={
                    typeof answers[currentQuestion] === 'number'
                      ? String(answers[currentQuestion])
                      : ""
                  }
                  onValueChange={(value) => handleAnswer(parseInt(value))}
                >
                  {question.options?.map((option, index) => {
                    const selected = answers[currentQuestion] === index;
                    const isCorrectOption = typeof question.correct === 'number' && question.correct === index;
                    let bg = "";
                    if (isLocked) {
                      if (selected && isCorrectOption) bg = " bg-green-100 border-green-300 dark:bg-green-900/40 dark:border-green-500";
                      else if (selected && !isCorrectOption) bg = " bg-red-100 border-red-300 dark:bg-red-900/40 dark:border-red-500";
                      else if (!selected && isCorrectOption) bg = " bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-600/60";
                    } else {
                      bg = " hover:bg-secondary/50";
                    }
                    return (
                      <div key={index} className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors${bg}`}>
                        <RadioGroupItem
                          disabled={isLocked}
                          value={index.toString()}
                          id={`q${currentQuestion}-option-${index}`}
                        />
                        <Label
                          htmlFor={`q${currentQuestion}-option-${index}`}
                          className={`flex-1 ${isLocked ? "cursor-default" : "cursor-pointer"}`}
                        >
                          {option}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              )}

              {(question.type === "short" || question.type === "short-answer") && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Type your answer here..."
                    value={(answers[currentQuestion] as string) || ""}
                    onChange={(e) => !isLocked && handleAnswer(e.target.value)}
                    className="min-h-32"
                    disabled={isLocked}
                  />
                  {!isLocked && (
                    <Button variant="secondary" onClick={submitShortAnswer}>Submit Answer</Button>
                  )}
                </div>
              )}

              {isLocked && (
                <div className="mt-4 space-y-2 text-sm">
                  {isCorrect ? (
                    <div className="text-green-700 dark:text-green-300">Correct!</div>
                  ) : (
                    <div className="text-red-700 dark:text-red-300">
                      Incorrect. { (question.type === "mcq" || question.type === "flashcard") && typeof question.correct === 'number' && question.options ? (
                        <span>Correct answer: <strong>{question.options[question.correct]}</strong></span>
                      ) : (question.type === "short" || question.type === "short-answer") && typeof question.correct === 'string' ? (
                        <span>Expected: <strong>{question.correct}</strong></span>
                      ) : null }
                    </div>
                  )}
                  {question.explanation && (
                    <div className="rounded-md border p-3 bg-muted/40 text-muted-foreground dark:bg-zinc-900/60 dark:border-zinc-700">
                      <div className="font-medium text-foreground mb-1">Explanation</div>
                      <div>{question.explanation}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-border bg-surface p-4">
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentQuestion === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <Button
            onClick={currentQuestion === questions.length - 1 ? handleSubmitQuiz : handleNext}
            disabled={currentQuestion === questions.length - 1 && !answers[currentQuestion]}
          >
            {currentQuestion === questions.length - 1 ? "Submit Quiz" : "Next"}
            {currentQuestion < questions.length - 1 && (
              <ArrowRight className="w-4 h-4 ml-2" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}