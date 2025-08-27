import { useState, useEffect, useMemo, useCallback } from "react";
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
  const [timeLeft, setTimeLeft] = useState(config.timer ? config.timer * 60 : null);
  const [locked, setLocked] = useState<Record<number, boolean>>({});
  const [isCorrectMap, setIsCorrectMap] = useState<Record<number, boolean>>({});
  const [warnedOneMinute, setWarnedOneMinute] = useState(false);

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
    if (timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, handleSubmitQuiz]);

  // One-time alert when 60 seconds remain
  useEffect(() => {
    if (timeLeft === null) return;
    if (!warnedOneMinute && timeLeft === 60) {
      setWarnedOneMinute(true);
      // Use a simple alert; can be swapped to toast if preferred
      window.alert("Only 1 minute remaining!");
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
      setCurrentQuestion(prev => prev + 1);
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
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                <span className={timeLeft < 300 ? "text-error" : "text-muted"}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
            <Button variant="outline" onClick={handleSubmitQuiz}>
              <Flag className="w-4 h-4 mr-2" />
              Submit
            </Button>
          </div>
        </div>
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
                  value={answers[currentQuestion]?.toString()}
                  onValueChange={(value) => handleAnswer(parseInt(value))}
                >
                  {question.options?.map((option, index) => {
                    const selected = answers[currentQuestion] === index;
                    const isCorrectOption = typeof question.correct === 'number' && question.correct === index;
                    let bg = "";
                    if (isLocked) {
                      if (selected && isCorrectOption) bg = " bg-green-100 border-green-300";
                      else if (selected && !isCorrectOption) bg = " bg-red-100 border-red-300";
                      else if (!selected && isCorrectOption) bg = " bg-green-50 border-green-200";
                    } else {
                      bg = " hover:bg-secondary/50";
                    }
                    return (
                      <div key={index} className={`flex items-center space-x-2 p-3 rounded-lg border${bg}`}>
                        <RadioGroupItem disabled={isLocked} value={index.toString()} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className={`flex-1 ${isLocked ? "cursor-default" : "cursor-pointer"}`}>
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
                    <div className="text-green-700">Correct!</div>
                  ) : (
                    <div className="text-red-700">
                      Incorrect. { (question.type === "mcq" || question.type === "flashcard") && typeof question.correct === 'number' && question.options ? (
                        <span>Correct answer: <strong>{question.options[question.correct]}</strong></span>
                      ) : (question.type === "short" || question.type === "short-answer") && typeof question.correct === 'string' ? (
                        <span>Expected: <strong>{question.correct}</strong></span>
                      ) : null }
                    </div>
                  )}
                  {question.explanation && (
                    <div className="rounded-md border p-3 bg-muted/40 text-muted-foreground">
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