import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, Target, RotateCcw, Download, BookOpen } from "lucide-react";

type QuizResultsData = {
  score: number;
  timeSpent: number;
  answers: Record<number, string | number>;
  questions: Array<{
    type: string;
    question: string;
    options?: string[];
    correct: number | string;
  }>;
  config: { timer?: number | null };
};

interface QuizResultsProps {
  results: QuizResultsData;
  onRestart: () => void;
}

export function QuizResults({ results, onRestart }: QuizResultsProps) {
  const { score, timeSpent, questions, answers, config } = results;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-error";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { text: "Excellent!", color: "bg-success" };
    if (score >= 60) return { text: "Good Job!", color: "bg-warning" };
    return { text: "Keep Practicing!", color: "bg-error" };
  };

  const scoreBadge = getScoreBadge(score);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-2">Quiz Complete!</h1>
        <Badge className={`${scoreBadge.color} text-white`}>
          {scoreBadge.text}
        </Badge>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="surface-elevated text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Final Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
              {score}%
            </div>
            <Progress value={score} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="surface-elevated text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Time Taken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 text-2xl font-semibold text-text">
              <Clock className="w-6 h-6" />
              {formatTime(timeSpent)}
            </div>
          </CardContent>
        </Card>

        <Card className="surface-elevated text-center">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted">
              Questions Answered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 text-2xl font-semibold text-text">
              <Target className="w-6 h-6" />
              {Object.keys(answers).length}/{questions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Question Review */}
      <Card className="surface-elevated mb-8">
        <CardHeader>
          <CardTitle>Question Review</CardTitle>
          <CardDescription>
            Review your answers and see where you can improve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions.map((question, index: number) => {
              const userAnswer = answers[index];
              const isCorrect = question.type === "mcq" 
                ? userAnswer === question.correct
                : true; // For short answers, we'd need more sophisticated checking

              return (
                <div key={index} className="p-4 rounded-lg border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-text">
                      {index + 1}. {question.question}
                    </h4>
                    <Badge 
                      variant="default"
                      className={isCorrect ? "bg-green-600 text-white dark:bg-green-500" : "bg-red-600 text-white dark:bg-red-500"}
                    >
                      {isCorrect ? "Correct" : "Incorrect"}
                    </Badge>
                  </div>
                  
                  {question.type === "mcq" && (
                    <div className="text-sm text-muted">
                      <div>Your answer: {question.options?.[userAnswer] || "Not answered"}</div>
                      {!isCorrect && (
                        <div className="text-success dark:text-green-400">
                          Correct answer: {question.options?.[question.correct]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Button onClick={onRestart} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Back to Setup
        </Button>
        
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Results
        </Button>
        
        <Button variant="outline" className="gap-2">
          <BookOpen className="w-4 h-4" />
          Add Wrong Answers to Notes
        </Button>
      </div>
    </div>
  );
}