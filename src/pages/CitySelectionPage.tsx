import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchProjects, readCachedProjects } from "@/lib/projectsApi";
import { scoreAllProjects } from "@/lib/scoring";
import { isOpenForRegistration } from "@/lib/projectFilters";
import type { ProjectsResponse, ScoredProject } from "@/lib/types";
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from "@/lib/userPreferences";
import { CityPicker } from "@/components/citySelection/CityPicker";
import { ProjectsTable } from "@/components/citySelection/ProjectsTable";
import { RecommendationCard } from "@/components/citySelection/RecommendationCard";
import { ProjectDetailModal } from "@/components/citySelection/ProjectDetailModal";
import { UserPreferencesCard } from "@/components/citySelection/UserPreferencesCard";

export function CitySelectionPage() {
  // Stale-while-revalidate: render cached data immediately, fetch fresh
  // in the background, swap state when ready.
  const [resp, setResp] = React.useState<ProjectsResponse | null>(
    () => readCachedProjects(),
  );
  const [isFetching, setIsFetching] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    fetchProjects()
      .then((data) => {
        if (!cancelled) {
          setResp(data);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(String(err));
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [prefs, setPrefs] = React.useState<UserPreferences>(
    DEFAULT_USER_PREFERENCES,
  );
  const [selectedCities, setSelectedCities] = React.useState<string[]>([]);
  const [highlightOnlySelected, setHighlightOnlySelected] =
    React.useState(false);
  const [openProjectId, setOpenProjectId] = React.useState<string | null>(null);

  const activeProjects = React.useMemo(
    () => (resp ? resp.projects.filter((p) => isOpenForRegistration(p)) : []),
    [resp],
  );
  const hiddenCount = resp ? resp.projects.length - activeProjects.length : 0;

  const scored: ScoredProject[] = React.useMemo(
    () =>
      scoreAllProjects(
        activeProjects,
        {
          equityAsPercent: true,
          equityPercent: prefs.equityPercent,
          currentRent: prefs.currentRent,
        },
        {
          discountOverride: prefs.discountOverride,
        },
      ),
    [activeProjects, prefs.equityPercent, prefs.currentRent, prefs.discountOverride],
  );

  const allCities: string[] = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of scored) set.add(s.project.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [scored]);

  const openProjectScored: ScoredProject | undefined = React.useMemo(() => {
    if (!openProjectId) return undefined;
    return scored.find((s) => s.project.id === openProjectId);
  }, [openProjectId, scored]);

  const totalCount = resp?.projects.length ?? 0;
  const openCount = activeProjects.length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">בחירת עיר להגרלה</h2>
          <p className="text-sm text-muted-foreground">
            השוואת הזדמנויות מחיר מטרה בכל הארץ — דירוג לפי הנחה, תשואה ריאלית
            לאורך תקופת החסימה החוקית, וסיכוי זכייה.
          </p>
          {resp ? (
            <p className="mt-2 text-sm">
              <span className="font-semibold tabular-nums">{openCount}</span>{" "}
              הגרלות פתוחות להרשמה
              {totalCount > openCount ? (
                <span className="text-muted-foreground">
                  {" "}
                  (מתוך {totalCount} שהחזיר ה-API)
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <DataSourceBadge
          resp={resp}
          loadError={loadError}
          isFetching={isFetching}
        />
      </div>

      {resp && activeProjects.length === 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-6 text-center space-y-1">
            <p className="font-semibold">אין כרגע הגרלות פתוחות</p>
            <p className="text-sm text-muted-foreground">
              נסו שוב בעוד מספר ימים. (סוננו {resp.projects.length} פרויקטים
              שאינם פתוחים להרשמה.)
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hiddenCount > 0 && activeProjects.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          מוצגות רק הגרלות פתוחות להרשמה. {hiddenCount}{" "}
          {hiddenCount === 1 ? "פרויקט" : "פרויקטים"} סוננו (סגורים או טרם
          נפתחו).
        </p>
      ) : null}

      <UserPreferencesCard prefs={prefs} onChange={setPrefs} />

      <Card>
        <CardContent className="p-4">
          <CityPicker
            cities={allCities}
            selected={selectedCities}
            onChange={setSelectedCities}
          />
        </CardContent>
      </Card>

      <RecommendationCard
        scored={scored}
        selectedCities={selectedCities}
        onOpenDetail={(id) => setOpenProjectId(id)}
      />

      <div className="flex items-center justify-end gap-3">
        <Label htmlFor="filter-switch" className="text-sm">
          הצג רק ערים נבחרות
        </Label>
        <Switch
          id="filter-switch"
          checked={highlightOnlySelected}
          onCheckedChange={setHighlightOnlySelected}
          disabled={selectedCities.length === 0}
        />
      </div>

      <ProjectsTable
        projects={scored}
        selectedCities={selectedCities}
        highlightOnlySelected={highlightOnlySelected}
        onSelectApartment={(id) => setOpenProjectId(id)}
      />

      <AssumptionsCard />

      {openProjectScored ? (
        <ProjectDetailModal
          scored={openProjectScored}
          prefs={prefs}
          onClose={() => setOpenProjectId(null)}
        />
      ) : null}
    </main>
  );
}

function DataSourceBadge({
  resp,
  loadError,
  isFetching,
}: {
  resp: ProjectsResponse | null;
  loadError: string | null;
  isFetching: boolean;
}) {
  if (loadError && !resp) {
    return (
      <span className="rounded-full bg-destructive/15 text-destructive px-3 py-1 text-xs font-medium">
        טעינה נכשלה: {loadError}
      </span>
    );
  }
  if (!resp) {
    return (
      <span className="rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs">
        טוען...
      </span>
    );
  }
  const tone =
    resp.source === "live"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : resp.source === "merged"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  const label =
    resp.source === "live"
      ? "נתונים חיים"
      : resp.source === "merged"
        ? "מיזוג חי + seed"
        : "נתוני seed (אופליין)";
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`rounded-full ${tone} px-3 py-1 text-xs font-medium`}
        title={resp.reason}
      >
        {label}
      </span>
      {isFetching ? (
        <span className="text-[10px] text-muted-foreground">
          מתעדכן ברקע...
        </span>
      ) : null}
    </div>
  );
}

function AssumptionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">הנחות הניתוח</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2 text-muted-foreground">
        <p>
          הניתוח עבור כל דירה רץ דרך מנוע הסימולציה של ה-Sandbox עם ברירות
          המחדל הנוכחיות (ריבית משכנתא, אינפלציה, תשואת S&P). הון עצמי, מספר
          חדרים ושכ״ד נוכחי לקוחים מהעדפות אישיות למעלה.
        </p>
        <ul className="list-disc list-inside space-y-1 ps-2">
          <li>
            תקופת החזקה אחרי המסירה מחושבת אוטומטית לפי תקנון מחיר מטרה
            (המוקדם מבין: 7 שנים מהגרלה / 5 שנים ממסירה).
          </li>
          <li>
            עלויות חד-פעמיות (מס רכישה לפי מדרגות, עו״ד, מדד, שדרוגים, ריהוט)
            ממומנות בתוך המשכנתא.
          </li>
          <li>
            סיכוי זכייה מחושב כדירות-בקטגוריה / נרשמים-לפרויקט. אם מספר
            הנרשמים עוד לא פורסם, מוצג ברירת מחדל שמרנית.
          </li>
          <li>
            שכ״ד מוערך לכל עיר מבוסס טבלת תשואות גולמיות (src/data/city-rental-yields.json).
            לעדכון: ערכו את הקובץ.
          </li>
          <li>
            התוצאות נשמרות ב-localStorage; בטעינה הבאה הן מוצגות מיד והעדכון
            רץ ברקע.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
