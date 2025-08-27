import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./providers/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";

// Pages
import ChatPage from "./pages/ChatPage";
import HistoryPage from "./pages/HistoryPage";
import QuizPage from "./pages/QuizPage";
import MindMapPage from "./pages/MindMapPage";
import NotesPage from "./pages/NotesPage";
import StickyNotesPage from "./pages/StickyNotesPage";
import StudyPlanPage from "./pages/StudyPlanPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/mindmap" element={<MindMapPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/sticky-notes" element={<StickyNotesPage />} />
              <Route path="/study-plan" element={<StudyPlanPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
