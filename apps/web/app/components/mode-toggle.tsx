import { MoonIcon, SunIcon } from "lucide-react";
import { Theme, useTheme } from "remix-themes";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";

/** Light, dark, or the system's theme (the default). */
export function ModeToggle() {
  const [theme, setTheme, { definedBy }] = useTheme();
  const value = definedBy === "SYSTEM" ? "system" : (theme ?? "system");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Theme">
            <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => setTheme(next === "system" ? null : (next as Theme))}>
          <DropdownMenuRadioItem value={Theme.LIGHT}>Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={Theme.DARK}>Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
