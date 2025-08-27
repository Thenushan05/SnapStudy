import { Search, Upload, Sun, Moon, User, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AppHeaderProps {
  onOpenSticky?: () => void;
}

export function AppHeader({ onOpenSticky }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="h-16 flex items-center gap-4 px-4 border-b border-border bg-surface/80 backdrop-blur-sm">
      <SidebarTrigger />
      
      {/* Logo */}
      <div className="flex items-center gap-2 font-semibold text-lg">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
        <span className="hidden sm:inline text-text">SnapStudy</span>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
        <Input
          placeholder="Search or ask anything..."
          className="pl-10 bg-surface border-border focus-ring"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSticky}
          className="gap-2"
        >
          <StickyNote className="w-4 h-4" />
          <span className="hidden sm:inline">Sticky Notes</span>
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="focus-ring"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>

        <Button variant="default" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload</span>
        </Button>

        <Avatar className="w-8 h-8">
          <AvatarImage src="" />
          <AvatarFallback>
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}