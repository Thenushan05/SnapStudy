import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Brain, Upload } from "lucide-react";

type QuizRunnerConfig = {
  source: string;
  quizType: string;
  difficulty: string;
  questionCount: number;
  timer: number | null; // minutes
};

interface QuizSetupProps {
  onStart: (config: QuizRunnerConfig) => void;
}

export function QuizSetup({ onStart }: QuizSetupProps) {
  const [source, setSource] = useState("upload");
  const [quizType, setQuizType] = useState("mcq");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState([10]);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState([30]);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // Load quiz-specific uploaded IDs
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("quizUploadedImageIds");
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      setAvailableIds(arr);
    } catch {
      setAvailableIds([]);
    }
    const sel = sessionStorage.getItem("quizSelectedImageId");
    setSelectedImageId(sel && sel.trim() ? sel : null);
  }, []);

  const handleStartQuiz = async () => {
    setErr(null);
    const config: QuizRunnerConfig = {
      source,
      quizType,
      difficulty,
      questionCount: questionCount[0],
      timer: timerEnabled ? timerDuration[0] : null,
    };

    try {
      if (source === "upload") {
        if (!file) {
          setErr("Please select an image to upload.");
          return;
        }
        setLoading(true);
        const form = new FormData();
        form.append("image", file);
        const res = await api.upload.image(form);
        const imageId = res.image.id;
        if (!imageId) {
          throw new Error("Upload succeeded but no imageId was returned");
        }
        const idStr = String(imageId);
        sessionStorage.setItem("imageId", idStr);
        sessionStorage.setItem("lastImageId", idStr);
        // Maintain quiz-only list of uploaded ids and current selection
        try {
          const raw = sessionStorage.getItem("quizUploadedImageIds");
          const list = raw ? (JSON.parse(raw) as string[]) : [];
          if (!list.includes(idStr)) list.push(idStr);
          sessionStorage.setItem("quizUploadedImageIds", JSON.stringify(list));
          setAvailableIds(list);
        } catch {
          sessionStorage.setItem("quizUploadedImageIds", JSON.stringify([idStr]));
          setAvailableIds([idStr]);
        }
        sessionStorage.setItem("quizSelectedImageId", idStr);
        setSelectedImageId(idStr);
        // Process the image before starting the quiz so backend has content ready
        try {
          await api.process.image({ imageId: idStr });
        } catch (e) {
          // Surface but don't block if processing API returns an error (optional behavior)
          console.warn("[QuizSetup] process.image failed", e);
        }
      } else if (source === "last") {
        // Always use the global lastImageId for this branch
        const imageId = sessionStorage.getItem("lastImageId");
        if (!imageId || !imageId.trim()) {
          setErr("No last image found. Please upload new content first.");
          return;
        }
        // Optionally persist the choice for consistency
        sessionStorage.setItem("quizSelectedImageId", imageId);
      }
      onStart(config);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to prepare quiz";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">Create Quiz</h1>
        <p className="text-muted">Configure your quiz settings and start learning</p>
      </div>

      <div className="space-y-6">
        {/* Source Selection */}
        <Card className="surface-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Content Source
            </CardTitle>
            <CardDescription>
              Choose where to generate quiz questions from
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={source} onValueChange={(v) => { setSource(v); setErr(null); }}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="upload" id="upload" />
                <Label htmlFor="upload">Upload new content</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last" id="last" />
                <Label htmlFor="last">Last uploaded image</Label>
              </div>
            </RadioGroup>
            {source === "upload" && (
              <div className="mt-4">
                <Label className="mb-2 block">Select image (PNG/JPG)</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm"
                />
              </div>
            )}
            {source === "last" && (
              <div className="mt-4 text-sm text-muted-foreground">
                The quiz will use your most recent upload (lastImageId).
              </div>
            )}
            {err && (
              <div className="mt-3 text-sm text-destructive">{err}</div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Configuration */}
        <Card className="surface-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Quiz Configuration
            </CardTitle>
            <CardDescription>
              Customize the quiz type and difficulty
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Quiz Type</Label>
                <Select value={quizType} onValueChange={setQuizType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="short">Short Answer</SelectItem>
                    <SelectItem value="flashcards">Flashcards</SelectItem>
                    <SelectItem value="mixed">Mixed Types</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Difficulty Level</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Number of Questions: {questionCount[0]}</Label>
              <Slider
                value={questionCount}
                onValueChange={setQuestionCount}
                max={25}
                min={5}
                step={5}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Timer</Label>
                <p className="text-sm text-muted">
                  Add time pressure to your quiz
                </p>
              </div>
              <Switch
                checked={timerEnabled}
                onCheckedChange={setTimerEnabled}
              />
            </div>

            {timerEnabled && (
              <div className="space-y-3">
                <Label>Time Limit: {timerDuration[0]} minutes</Label>
                <Slider
                  value={timerDuration}
                  onValueChange={(v) => {
                    // Enforce minimum of 2 minutes
                    const clamped = Math.max(2, v[0] ?? 2);
                    setTimerDuration([clamped]);
                  }}
                  max={120}
                  min={2}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Button 
          onClick={handleStartQuiz}
          className="w-full h-12 text-lg font-medium"
          size="lg"
          disabled={loading}
        >
          {loading ? "Preparing…" : "Start Quiz"}
        </Button>
      </div>
    </div>
  );
}