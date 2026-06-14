import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SliderInput } from "@/components/SliderInput";
import type { UserPreferences } from "@/lib/userPreferences";

interface UserPreferencesCardProps {
  prefs: UserPreferences;
  onChange: (next: UserPreferences) => void;
}

export function UserPreferencesCard({
  prefs,
  onChange,
}: UserPreferencesCardProps) {
  const set = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => onChange({ ...prefs, [key]: value });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">העדפות אישיות</CardTitle>
        <p className="text-sm text-muted-foreground">
          הערכים האלה משפיעים על החישוב הפיננסי בכל השורות בטבלה ועל סדר ההמלצות.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <SliderInput
            label="הון עצמי (% ממחיר הרכישה)"
            value={prefs.equityPercent}
            onChange={(n) => set("equityPercent", n)}
            min={0.10}
            max={1.00}
            step={0.01}
            asPercent
            helper="כמה הון עצמי תוכלו לשים מהכיס"
          />
          <SliderInput
            label="שכ״ד נוכחי שלכם (₪/חודש)"
            value={prefs.currentRent}
            onChange={(n) => set("currentRent", n)}
            min={2000}
            max={20000}
            step={100}
            unit="₪"
            helper="כמה אתם משלמים כיום בשכירות (תרחיש C)"
          />
        </div>
      </CardContent>
    </Card>
  );
}
