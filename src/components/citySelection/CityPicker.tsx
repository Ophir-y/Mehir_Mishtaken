import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface CityPickerProps {
  cities: string[]; // all available
  selected: string[]; // up to 3
  onChange: (next: string[]) => void;
  max?: number;
}

export function CityPicker({
  cities,
  selected,
  onChange,
  max = 3,
}: CityPickerProps) {
  function toggle(city: string) {
    if (selected.includes(city)) {
      onChange(selected.filter((c) => c !== city));
    } else if (selected.length < max) {
      onChange([...selected, city]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          בחירת ערים להגרלה ({selected.length}/{max})
        </h3>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            נקה הכל
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {cities.map((city) => {
          const isSelected = selected.includes(city);
          const atCap = !isSelected && selected.length >= max;
          return (
            <button
              key={city}
              type="button"
              onClick={() => toggle(city)}
              disabled={atCap}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : atCap
                    ? "border-input bg-background text-muted-foreground opacity-50 cursor-not-allowed"
                    : "border-input bg-background hover:bg-accent",
              )}
            >
              {isSelected ? (
                <span className="inline-flex items-center gap-1">
                  {city}
                  <X className="h-3 w-3" />
                </span>
              ) : (
                city
              )}
            </button>
          );
        })}
      </div>

      {selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          בחרו עד {max} ערים (תקנון מחיר מטרה מאפשר רישום ל-3 ערים בסיבוב).
          לוח ההמלצות יציע אוטומטית את 3 ההזדמנויות הכי טובות.
        </p>
      ) : null}
    </div>
  );
}
