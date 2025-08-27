import { History, FileImage, Brain, FileText, HelpCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const historyItems = [
  {
    id: 1,
    title: "Math Notes - Chapter 5",
    type: "summary",
    icon: FileText,
    timestamp: "2 hours ago",
    preview: "Quadratic equations and their applications in real-world problems...",
    tags: ["Mathematics", "Algebra"]
  },
  {
    id: 2,
    title: "Biology Diagrams",
    type: "quiz",
    icon: HelpCircle,
    timestamp: "1 day ago",
    preview: "Created 15 questions about cellular respiration and photosynthesis...",
    tags: ["Biology", "Cell Biology"]
  },
  {
    id: 3,
    title: "History Timeline",
    type: "mindmap",
    icon: Brain,
    timestamp: "3 days ago",
    preview: "World War II events and their interconnections...",
    tags: ["History", "World War II"]
  },
  {
    id: 4,
    title: "Chemistry Formulas",
    type: "notes",
    icon: FileImage,
    timestamp: "1 week ago",
    preview: "Organic chemistry reaction mechanisms and synthesis pathways...",
    tags: ["Chemistry", "Organic"]
  }
];

const typeColors = {
  summary: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  quiz: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  mindmap: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  notes: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
};

export default function HistoryPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">Study History</h1>
        <p className="text-muted">Review and revisit your learning sessions</p>
      </div>

      <div className="grid gap-4">
        {historyItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} className="surface-interactive cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-text">
                        {item.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="secondary" 
                          className={typeColors[item.type as keyof typeof typeColors]}
                        >
                          {item.type}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted">
                          <Clock className="w-3 h-3" />
                          {item.timestamp}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Reopen
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-muted mb-3">
                  {item.preview}
                </CardDescription>
                <div className="flex gap-2">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}