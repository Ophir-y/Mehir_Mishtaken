import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Nav() {
  return (
    <header className="border-b bg-card sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold leading-tight">מחיר מטרה</h1>
          <p className="text-xs text-muted-foreground">
            כלי החלטה: סנדבוקס פיננסי ובחירת ערים להגרלה
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <TabLink to="/city-selection">בחירת עיר</TabLink>
          <TabLink to="/sandbox">Sandbox</TabLink>
        </nav>
      </div>
    </header>
  );
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-1.5 transition-colors",
          isActive
            ? "bg-primary text-primary-foreground font-medium"
            : "text-muted-foreground hover:bg-muted",
        )
      }
    >
      {children}
    </NavLink>
  );
}
