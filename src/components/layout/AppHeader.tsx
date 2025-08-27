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
    <header className="fixed top-0 left-0 right-0 z-50 h-14 sm:h-16 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="w-full max-w-7xl mx-auto h-full flex items-center gap-3 px-3 sm:px-4">
        <SidebarTrigger />

        {/* Logo */}
        <div className="flex items-center gap-2 font-semibold text-lg">
          <img
            src="/Snapstudy.png"
            alt="SnapStudy logo"
            className="w-8 h-8 rounded-lg select-none object-contain"
            loading="eager"
            decoding="async"
          />
          <span className="hidden sm:inline text-text">SnapStudy</span>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md relative hidden xs:flex">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <Input
            placeholder="Search or ask anything..."
            className="pl-10 bg-surface border-border focus-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Mobile sticky notes trigger */}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSticky}
            className="sm:hidden"
            aria-label="Open Sticky Notes"
          >
            <StickyNote className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSticky}
            className="gap-2 hidden sm:flex"
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

          <Button variant="default" size="sm" className="gap-2 hidden sm:flex">
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
      </div>
    </header>
  );
}