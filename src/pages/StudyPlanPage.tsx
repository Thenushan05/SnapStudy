import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar as CalendarIcon, 
  Plus, 
  Edit, 
  Trash2, 
  Sun, 
  Moon,
  Target,
  TrendingUp,
  Lightbulb,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Trophy,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTapOrClick } from "@/hooks/use-tap-or-click";

interface StudySession {
  id: string;
  title: string;
  subject: string;
  topic: string;
  startDate: Date;
  duration: number; // in minutes
  priority: "high" | "medium" | "low";
  status: "planned" | "completed" | "missed";
  notes?: string;
  color?: string;
  emoji?: string;
}

export default function StudyPlanPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  // Adjustable week hour range (1-hour intervals)
  const [weekStartHour, setWeekStartHour] = useState<number>(8);
  const [weekEndHour, setWeekEndHour] = useState<number>(20); // exclusive
  const visibleHours = Math.max(0, weekEndHour - weekStartHour);
  // Max duration allowed based on selected start time and visible hour range
  const [maxDuration, setMaxDuration] = useState<number>(24 * 60);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // UI options
  const colorOptions = [
    "#3B82F6", // blue-500
    "#10B981", // green-500
    "#8B5CF6", // purple-500
    "#F43F5E", // rose-500
    "#F59E0B", // amber-500
    "#06B6D4", // cyan-500
    "#64748B", // slate-500
  ];
  const emojiOptions = ["📘","🧪","🧠","📐","📝","🔬","⚛️","🧬","🎯","🔥","⭐","💡"]; 

  // Controlled form state
  const [form, setForm] = useState({
    title: "",
    subject: "",
    topic: "",
    start: "",
    duration: 60,
    priority: "medium" as "high" | "medium" | "low",
    notes: "",
    color: "",
    emoji: "",
  });

  // Mock data
  const [sessions, setSessions] = useState<StudySession[]>([
    {
      id: "1",
      title: "Math Revision - Algebra",
      subject: "Mathematics", 
      topic: "Quadratic Equations",
      startDate: new Date(2024, 11, 25, 9, 0),
      duration: 120,
      priority: "high",
      status: "planned",
      notes: "Focus on factoring methods"
    },
    {
      id: "2", 
      title: "Biology Study Session",
      subject: "Biology",
      topic: "Cell Biology",
      startDate: new Date(2024, 11, 25, 14, 0),
      duration: 90,
      priority: "medium", 
      status: "completed"
    },
    {
      id: "3",
      title: "Physics Practice",
      subject: "Physics",
      topic: "Mechanics",
      startDate: new Date(2024, 11, 26, 10, 0),
      duration: 180,
      priority: "high",
      status: "planned"
    }
  ]);

  const subjectColor = (subject: string) => {
    const key = subject.toLowerCase();
    if (key.includes('math')) return 'bg-blue-500';
    if (key.includes('bio')) return 'bg-green-500';
    if (key.includes('phys')) return 'bg-purple-500';
    if (key.includes('chem')) return 'bg-rose-500';
    if (key.includes('english')) return 'bg-amber-500';
    return 'bg-muted-foreground';
  };

  // Compute max duration from a given start date-time against current week range (end exclusive)
  const computeMaxDuration = useCallback((d: Date) => {
    if (isNaN(d.getTime())) return 0;
    const startMinAbs = d.getHours() * 60 + d.getMinutes();
    const endMinAbs = weekEndHour * 60;
    const within = startMinAbs >= weekStartHour * 60 && startMinAbs < endMinAbs;
    return within ? Math.max(0, endMinAbs - startMinAbs) : 0;
  }, [weekStartHour, weekEndHour]);

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0,0,0,0);
    return d;
  };

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatRange = (start: Date, durationMin: number) => {
    const end = new Date(start.getTime() + durationMin * 60000);
    return `${formatTime(start)}-${formatTime(end)}`;
  };

  const formatForInput = (date: Date) => {
    const d = new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  // Open Add modal prefilled with a date/time
  const openAddWith = (date: Date) => {
    const d = new Date(date);
    // Default to 9:00 if time component isn't meaningful
    if (isNaN(d.getTime())) return;
    setEditingId(null);
    setForm(f => ({
      ...f,
      start: formatForInput(d),
    }));
    // compute max duration against current visible range (end-exclusive)
    setMaxDuration(computeMaxDuration(d));
    setFormError("");
    setIsAddModalOpen(true);
  };

  const openEdit = (id: string) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    setEditingId(id);
    setForm({
      title: s.title,
      subject: s.subject,
      topic: s.topic,
      start: formatForInput(s.startDate),
      duration: s.duration,
      priority: s.priority,
      notes: s.notes || "",
      color: s.color || "",
      emoji: s.emoji || "",
    });
    setIsAddModalOpen(true);
  };

  const saveSession = () => {
    if (!form.title || !form.subject || !form.start) {
      setFormError("Please fill Title, Subject, and Start date/time.");
      return;
    }
    const startDate = new Date(form.start);
    if (startDate < new Date()) {
      setFormError("Start date/time cannot be in the past.");
      return;
    }
    // Validate duration within allowed max
    if (form.duration > maxDuration) {
      setFormError(`Duration exceeds available time in the selected range. Max allowed is ${Math.floor(maxDuration/60)}h ${maxDuration%60}m.`);
      return;
    }
    if (editingId) {
      setSessions(prev => prev.map(s => s.id === editingId ? { ...s, title: form.title, subject: form.subject, topic: form.topic, startDate, duration: Number(form.duration), priority: form.priority, notes: form.notes, color: form.color || s.color, emoji: form.emoji || s.emoji } : s));
    } else {
      const id = Math.random().toString(36).slice(2);
      setSessions(prev => [...prev, { id, title: form.title, subject: form.subject, topic: form.topic, startDate, duration: Number(form.duration), priority: form.priority, status: 'planned', notes: form.notes, color: form.color || undefined, emoji: form.emoji || undefined }]);
    }
    setFormError("");
    setIsAddModalOpen(false);
  };

  const deleteSession = (id: string) => setSessions(prev => prev.filter(s => s.id !== id));
  const markComplete = (id: string) => setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'completed' } : s));
  const openDetails = (id: string) => { setEditingId(id); setIsDetailsOpen(true); };

  const selectedSession = useMemo(() => sessions.find(s => s.id === editingId) || null, [sessions, editingId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Recompute maxDuration whenever start datetime or visible range changes
  useEffect(() => {
    if (!form.start) return;
    const d = new Date(form.start);
    const max = computeMaxDuration(d);
    setMaxDuration(max);
    // Clamp duration if it exceeds new max
    setForm(f => ({ ...f, duration: Math.min(f.duration || 0, max) }));
  }, [form.start, weekStartHour, weekEndHour, computeMaxDuration]);

  const totalPlannedHours = sessions.reduce((acc, session) => acc + session.duration, 0) / 60;
  const completedTasks = sessions.filter(s => s.status === "completed").length;
  const pendingTasks = sessions.filter(s => s.status === "planned").length;
  const nextSession = sessions
    .filter(s => s.status === "planned" && s.startDate > new Date())
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

  // Weekly progress (time-based) based on the selected week
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 7);
  const weeklySessions = sessions.filter(s => s.startDate >= weekStart && s.startDate < weekEnd);
  const weeklyPlannedMinutes = weeklySessions.reduce((acc, s) => acc + s.duration, 0);
  const weeklyCompletedMinutes = weeklySessions.filter(s => s.status === 'completed').reduce((acc, s) => acc + s.duration, 0);
  const weeklyTimePct = weeklyPlannedMinutes > 0 ? (weeklyCompletedMinutes / weeklyPlannedMinutes) * 100 : 0;

  // Now helpers for disabling past selections
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground"; 
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-success";
      case "planned": return "text-primary";
      case "missed": return "text-destructive";
      default: return "text-muted";
    }
  };

  // Helpers for duration UI limits
  const hoursMax = Math.floor(maxDuration / 60);
  const currentHours = Math.floor((form.duration || 0) / 60);
  const allowedMinutesMax = Math.max(0, Math.min(59, maxDuration - currentHours * 60));
  const minuteSteps = [0,5,10,15,20,25,30,35,40,45,50,55];
  const endCapLabel = useMemo(() => {
    if (!form.start) return '';
    const d = new Date(form.start);
    if (isNaN(d.getTime())) return '';
    const end = new Date(d);
    end.setHours(weekEndHour, 0, 0, 0);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [form.start, weekEndHour]);

  // Month view day cell component with scroll-safe tap handling on mobile
  const CalendarDayCell: React.FC<{
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPastDay: boolean;
    daysSessions: StudySession[];
  }> = ({ date, isCurrentMonth, isToday, isPastDay, daysSessions }) => {
    const handleOpen = useCallback(() => {
      if (isPastDay) return;
      const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0);
      const nowLocal = new Date();
      const addAt = (isToday && base < nowLocal)
        ? new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), nowLocal.getHours() + 1, 0)
        : base;
      openAddWith(addAt);
    }, [date, isPastDay, isToday]);

    // Long-press for touch, click for mouse
    const longPressMs = 400;
    const moveThresh = 10; // px
    const lpTimer = useRef<number | null>(null);
    const startXY = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const movedRef = useRef<boolean>(false);

    const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      startXY.current.x = t.clientX; startXY.current.y = t.clientY; movedRef.current = false;
      // schedule open
      lpTimer.current = window.setTimeout(() => {
        if (!movedRef.current) handleOpen();
      }, longPressMs);
    };
    const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startXY.current.x);
      const dy = Math.abs(t.clientY - startXY.current.y);
      if (dx > moveThresh || dy > moveThresh) {
        movedRef.current = true;
        if (lpTimer.current !== null) {
          clearTimeout(lpTimer.current);
          lpTimer.current = null;
        }
      }
    };
    const clearLP = () => { if (lpTimer.current !== null) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
    const onTouchEnd = () => { clearLP(); };
    const onTouchCancel = () => { clearLP(); };

    const tapHandlers = useTapOrClick(() => handleOpen(), { thresholdPx: 12, disableClickOnTouch: true });

    return (
      <div
        className={cn(
          "min-h-[84px] sm:min-h-[100px] p-2 border border-border/50 rounded-lg transition-colors",
          !isPastDay && "hover:bg-accent/20",
          !isCurrentMonth && "text-muted bg-muted/20",
          isToday && "ring-2 ring-accent bg-accent/10",
          isPastDay && "cb-disabled"
        )}
        aria-disabled={isPastDay}
        // Allow natural scroll; handle long-press only on touch
        style={{ touchAction: 'pan-x pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        // Keep desktop click immediate
        onClick={tapHandlers.onClick}
      >
        <div className="text-sm font-medium mb-1">{date.getDate()}</div>
        <div className="space-y-1">
          {daysSessions.slice(0, 3).map(session => (
            <div
              key={session.id}
              className={cn(
                "text-[11px] p-1 rounded text-white font-medium truncate cursor-pointer border shadow-sm",
                !session.color && subjectColor(session.subject)
              )}
              style={session.color ? { backgroundColor: session.color } : undefined}
              onClick={(e) => { e.stopPropagation(); openDetails(session.id); }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{session.emoji ? `${session.emoji} ` : ''}{session.subject}</span>
                <span className={cn("w-2 h-2 rounded-full", session.status === 'completed' ? 'bg-white' : 'bg-white/60')} />
              </div>
              <div className="truncate opacity-90">{session.topic}</div>
              <div className="opacity-90 text-[10px]">{formatRange(session.startDate, session.duration)}</div>
            </div>
          ))}
          {daysSessions.length > 3 && (
            <div className="text-xs text-muted">+{daysSessions.length - 3} more</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Study Plan</h1>
          <p className="text-muted">Organize your learning schedule effectively</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range quick pickers */}
          <div className="hidden md:flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
            <span className="text-muted text-sm">to</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md w-screen sm:w-auto max-h-[90dvh] overflow-y-auto sm:rounded-lg rounded-none p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Study Session' : 'Add Study Session'}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Session Title</Label>
                <Input id="title" placeholder="e.g., Math Revision - Algebra" value={form.title} onChange={(e) => setForm(f => ({...f, title: e.target.value}))} />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Select value={form.subject} onValueChange={(v) => setForm(f => ({...f, subject: v}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mathematics">Mathematics</SelectItem>
                      <SelectItem value="Biology">Biology</SelectItem>
                      <SelectItem value="Physics">Physics</SelectItem>
                      <SelectItem value="Chemistry">Chemistry</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="topic">Topic</Label>
                  <Input id="topic" placeholder="Specific topic" value={form.topic} onChange={(e) => setForm(f => ({...f, topic: e.target.value}))} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Start Date & Time</Label>
                  <Input
                    id="date"
                    type="datetime-local"
                    value={form.start}
                    min={formatForInput(new Date())}
                    onChange={(e) => setForm(f => ({...f, start: e.target.value}))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {/* Hours dropdown (0..23) */}
                    <Select
                      value={String(Math.min(Math.floor((form.duration || 0) / 60), hoursMax))}
                      onValueChange={(v) => {
                        const hours = Math.max(0, Math.min(Number(v) || 0, hoursMax));
                        let minutes = (form.duration || 0) % 60;
                        const maxMinsForHours = Math.max(0, Math.min(59, maxDuration - hours * 60));
                        if (minutes > maxMinsForHours) minutes = maxMinsForHours;
                        setForm(f => ({ ...f, duration: hours * 60 + minutes }));
                      }}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Hours" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: Math.max(0, hoursMax + 1) }, (_, h) => (
                          <SelectItem key={h} value={String(h)}>{h} h</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-sm text-muted">:</span>

                    {/* Minutes dropdown (0, 5, 10, ... 55) */}
                    <Select
                      value={String(Math.min((form.duration || 0) % 60, allowedMinutesMax))}
                      onValueChange={(v) => {
                        const raw = Math.max(0, Number(v) || 0);
                        const minutes = Math.min(raw, allowedMinutesMax);
                        const hours = Math.floor((form.duration || 0) / 60);
                        setForm(f => ({ ...f, duration: hours * 60 + minutes }));
                      }}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Minutes" />
                      </SelectTrigger>
                      <SelectContent>
                        {minuteSteps.filter(m => m <= allowedMinutesMax).map(m => (
                          <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="ml-2 text-xs text-muted">Total: {form.duration || 0} min</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">Max available: {Math.floor(maxDuration/60)}h {maxDuration%60}m (until {endCapLabel})</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Color</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {colorOptions.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm(f => ({...f, color: c}))}
                        className={cn("w-7 h-7 rounded-full ring-offset-2 focus:outline-none", form.color === c ? 'ring-2 ring-offset-background ring-accent' : 'ring-0')}
                        style={{ backgroundColor: c }}
                        aria-label={`Pick color ${c}`}
                      />
                    ))}
                    <button type="button" className="text-xs text-muted underline" onClick={() => setForm(f => ({...f, color: ""}))}>Clear</button>
                  </div>
                </div>
                <div>
                  <Label>Emoji</Label>
                  <Select value={form.emoji} onValueChange={(v) => setForm(f => ({...f, emoji: v}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an emoji" />
                    </SelectTrigger>
                    <SelectContent>
                      {emojiOptions.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-1 text-xs text-muted">Examples: 📘 for reading, 🧪 for labs, 🧠 for revision</div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({...f, priority: v as "high" | "medium" | "low"}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" placeholder="Additional notes..." value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} />
              </div>
      
              <div className="bg-surface p-3 rounded-lg border">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Lightbulb className="w-4 h-4" />
                  <span className="font-medium">Smart Suggestion:</span>
                </div>
                <p className="text-sm mt-1">Best time for focus: Morning 8-10 AM</p>
              </div>

              {formError && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                  {formError}
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveSession}>Save Session</Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      

      {/* Enhanced Study Calendar (full width) */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-2xl">Study Calendar</CardTitle>
                <p className="text-sm text-muted mt-1">Plan and track your learning journey</p>
              </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "week" | "month")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="week">Week</TabsTrigger>
                      <TabsTrigger value="month">Month</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {viewMode === 'week' && (
                    <Select
                      value={`${weekStartHour}-${weekEndHour}`}
                      onValueChange={(v) => {
                        const [s, e] = v.split('-').map(Number);
                        if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
                          setWeekStartHour(s);
                          setWeekEndHour(e);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Hours" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6-18">06:00 - 18:00</SelectItem>
                        <SelectItem value="8-20">08:00 - 20:00</SelectItem>
                        <SelectItem value="9-21">09:00 - 21:00</SelectItem>
                        <SelectItem value="0-24">00:00 - 24:00</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Session
                  </Button>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Weekly Progress</span>
                  <span className="text-sm text-muted">{Math.round(weeklyTimePct)}% Complete</span>
                </div>
                <Progress value={weeklyTimePct} className="h-2" />
                <p className="text-xs text-muted mt-2">{weeklyCompletedMinutes} / {weeklyPlannedMinutes} min done this week</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-hidden">
                {viewMode === 'month' ? (
                  <div className="space-y-4">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedDate(addMonths(selectedDate, -1))}>
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <h3 className="font-semibold text-lg">
                        {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Calendar Grid (7 columns with horizontal scroll on mobile to preserve alignment) */}
                    <div className="overflow-x-auto">
                      <div className="grid grid-cols-7 gap-1 min-w-[700px] sm:min-w-0 px-2 sm:px-0">
                        {/* Day Headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="p-2 text-center text-xs sm:text-sm font-medium text-muted border-b">
                            {day}
                          </div>
                        ))}
                        
                        {/* Calendar Days */}
                        {Array.from({ length: 35 }, (_, i) => {
                          const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i - 6);
                          const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
                          const isToday = date.toDateString() === new Date().toDateString();
                          const isPastDay = date < todayStart; // entire day in the past
                          const daysSessions = sessions.filter(s => s.startDate.toDateString() === date.toDateString());
                          return (
                            <CalendarDayCell
                              key={i}
                              date={date}
                              isCurrentMonth={isCurrentMonth}
                              isToday={isToday}
                              isPastDay={isPastDay}
                              daysSessions={daysSessions}
                            />
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Week Navigation */}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
                      <ChevronLeft className="w-4 h-4" />
                      Previous Week
                    </Button>
                    <h3 className="font-semibold text-lg">Week View</h3>
                    <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                      Next Week
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Week Grid */}
              <div className="overflow-x-auto pb-2">
                <div className="md:hidden px-2 pb-1 text-xs text-muted">Swipe horizontally to view all days</div>
                <div className="grid grid-cols-8 gap-2 min-w-[960px] sm:min-w-0 px-2 sm:px-0">
                  {/* Time Column */}
                  <div className="space-y-2 border-r border-border/60">
                      <div className="h-8"></div>
                      <div className="grid" style={{ gridTemplateRows: `repeat(${visibleHours}, 4rem)` }}>
                        {Array.from({ length: visibleHours }, (_, i) => (
                          <div
                            key={i}
                            className="border-t border-border/60 last:border-b text-xs text-muted flex items-center odd:bg-muted/5"
                          >
                            {weekStartHour + i}:00
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Day Columns */}
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                      const weekStart = startOfWeek(selectedDate);
                      const date = addDays(weekStart, dayIndex);
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                      const daysSessions = sessions.filter(s => s.startDate.toDateString() === date.toDateString());
                      
                      return (
                        <div key={dayIndex} className="space-y-2">
                          <div className="h-8 text-center">
                            <div className="text-sm font-medium">{dayName}</div>
                            <div className="text-xs text-muted">{date.getDate()}</div>
                          </div>
                          {/* Week hour grid with overlayed sessions */}
                          {/** Use calc-based minHeight so the column always covers all rows */}
                          <div className="relative overflow-hidden" style={{ height: `calc(${visibleHours} * 4rem)` }}>
                            {/* Background hour cells laid out as strict CSS grid rows to guarantee full coverage */}
                            <div
                              className="grid border-l border-r border-border/60"
                              style={{ gridTemplateRows: `repeat(${visibleHours}, 4rem)` }}
                            >
                              {Array.from({ length: visibleHours }, (_, hourIndex) => {
                                const hour = weekStartHour + hourIndex;
                                const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0);
                                const isPastSlot = slotDate < now;
                                return (
                                  <div
                                    key={hourIndex}
                                    className={cn("border-t border-border/60 last:border-b odd:bg-muted/5", isPastSlot && "cb-disabled")}
                                    aria-disabled={isPastSlot}
                                    onClick={() => {
                                      if (isPastSlot) return;
                                      openAddWith(slotDate);
                                    }}
                                    onPointerDown={(e) => {
                                      if (e.pointerType === 'touch') {
                                        if (isPastSlot) return;
                                        openAddWith(slotDate);
                                      }
                                    }}
                                  />
                                );
                              })}
                            </div>
                            {/* Overlay sessions spanning duration */}
                            <div className="absolute inset-0 pointer-events-none">
                              {daysSessions.map(session => {
                                const startHour = session.startDate.getHours();
                                const startMin = session.startDate.getMinutes();
                                const totalMinutesFromBase = (startHour - weekStartHour) * 60 + startMin; // minutes since base
                                const heightMinutes = Math.max(15, session.duration); // min 15min block
                                return (
                                  <div
                                    key={session.id}
                                    className={cn(
                                      "absolute left-0 right-0 mx-1 p-1 rounded text-xs text-white font-medium cursor-pointer shadow-sm border pointer-events-auto",
                                      !session.color && subjectColor(session.subject)
                                    )}
                                    style={{
                                      top: `calc(${totalMinutesFromBase} * (4rem / 60))`,
                                      height: `calc(${heightMinutes} * (4rem / 60) - 1px)`,
                                      backgroundColor: session.color || undefined,
                                    }}
                                    onClick={(e) => { e.stopPropagation(); openDetails(session.id); }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="truncate">{session.emoji ? `${session.emoji} ` : ''}{session.subject}</span>
                                      <span className={cn("w-2 h-2 rounded-full", session.status === 'completed' ? 'bg-white' : 'bg-white/60')} />
                                    </div>
                                    <div className="truncate text-[10px] opacity-90">{session.topic}</div>
                                    <div className="text-[10px] opacity-90">{formatRange(session.startDate, session.duration)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}
              {/* Close overflow-x-hidden wrapper */}
              </div>
              
              {/* Subject Legend */}
              <div className="mt-6 p-4 bg-surface rounded-lg border">
                <h4 className="text-sm font-medium mb-3">Subject Colors</h4>
                <div className="flex flex-wrap gap-3">
                  {['Mathematics', 'Biology', 'Physics', 'Chemistry', 'English'].map(subject => (
                    <div key={subject} className="flex items-center gap-2">
                      <div className={cn('w-3 h-3 rounded-full', subjectColor(subject))} />
                      <span className="text-xs">{subject}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Recommendations & Reminders (moved below the calendar) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Upcoming Quizzes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Upcoming Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div>
                <p className="text-sm font-medium">Math Quiz</p>
                <p className="text-xs text-muted">Algebra & Geometry</p>
              </div>
              <Badge variant="destructive" className="text-xs">2 days</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <div>
                <p className="text-sm font-medium">Biology Quiz</p>
                <p className="text-xs text-muted">Cell Structure</p>
              </div>
              <Badge variant="secondary" className="text-xs">5 days</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Exam Countdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Exam Countdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">15</div>
              <p className="text-sm text-muted">Days until Finals</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Physics Exam</span>
                <span className="text-xs text-muted">18 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Chemistry Exam</span>
                <span className="text-xs text-muted">22 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-500" />
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-green-600" />
                <span className="font-medium">Optimal Study Time</span>
              </div>
              <p className="text-xs">Your focus peaks at 9-11 AM. Schedule important topics then.</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Study Gap Alert</span>
              </div>
              <p className="text-xs">You have a 3-hour gap tomorrow. Perfect for Math revision!</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Progress Boost</span>
              </div>
              <p className="text-xs">You're 20% ahead in Biology. Consider focusing on weaker subjects.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Summary Cards (moved below calendar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours Planned</CardTitle>
            <Clock className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlannedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted">Across all subjects</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
            <p className="text-xs text-muted">Sessions finished</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Target className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks}</div>
            <p className="text-xs text-muted">Sessions remaining</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Session</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">{nextSession ? nextSession.title : "No upcoming"}</div>
            <p className="text-xs text-muted">
              {nextSession ? nextSession.startDate.toLocaleDateString() : "sessions"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Study Sessions</CardTitle>
          <CardDescription>Manage your learning schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center gap-4 p-4 rounded-lg border bg-surface">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{session.title}</h3>
                    <span className={cn('w-2.5 h-2.5 rounded-full', subjectColor(session.subject))} aria-hidden />
                    <Badge variant="secondary" className="text-xs">
                      {session.subject}
                    </Badge>
                    <Badge className={cn("text-xs", getPriorityColor(session.priority))}>
                      {session.priority}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {session.startDate.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {session.duration}min
                    </span>
                    <span className={cn("font-medium", getStatusColor(session.status))}>
                      {session.status}
                    </span>
                  </div>
                  
                  {session.notes && (
                    <p className="text-sm text-muted">{session.notes}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(session.id)} aria-label="Edit session">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteSession(session.id)} aria-label="Delete session">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => markComplete(session.id)} aria-label="Mark complete">
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details Drawer */}
      {selectedSession && (
        <div role="dialog" aria-modal="true" className={cn("fixed inset-0 z-50", isDetailsOpen ? '' : 'hidden')}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsDetailsOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Session Details</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setIsDetailsOpen(false); openEdit(selectedSession.id); }}>Edit</Button>
                <Button variant="outline" size="sm" onClick={() => setIsDetailsOpen(false)}>Close</Button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><span className={cn('w-2.5 h-2.5 rounded-full', subjectColor(selectedSession.subject))} aria-hidden /> <span className="font-medium">{selectedSession.title}</span></div>
              <div><span className="text-muted">Subject:</span> {selectedSession.subject}</div>
              <div><span className="text-muted">Topic:</span> {selectedSession.topic}</div>
              <div><span className="text-muted">Date:</span> {selectedSession.startDate.toLocaleString()}</div>
              <div><span className="text-muted">Duration:</span> {selectedSession.duration} min</div>
              <div><span className="text-muted">Priority:</span> {selectedSession.priority}</div>
              <div><span className="text-muted">Status:</span> {selectedSession.status}</div>
              {selectedSession.notes && <div><span className="text-muted">Notes:</span> {selectedSession.notes}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}