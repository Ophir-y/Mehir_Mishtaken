import { describe, expect, it } from "vitest";
import { SCORING_WEIGHTS, scoreApartment, scoreAllProjects } from "@/lib/scoring";
import { getSeedProjects } from "@/lib/projectsApi";
import type { Project, ProjectApartment } from "@/lib/types";

function mkProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-1",
    city: "תל אביב",
    projectName: "פרויקט בדיקה",
    estimatedHandoverMonths: 24,
    apartments: [mkApt()],
    status: "open",
    ...overrides,
  };
}

function mkApt(overrides: Partial<ProjectApartment> = {}): ProjectApartment {
  return {
    rooms: 4,
    lotteryPrice: 2_000_000,
    marketPrice: 2_600_000,
    unitsOffered: 30,
    applicants: 600,
    estimatedRent: 7000,
    ...overrides,
  };
}

describe("scoring weights", () => {
  it("weights sum to 1.0", () => {
    const sum =
      SCORING_WEIGHTS.discount +
      SCORING_WEIGHTS.realReturn +
      SCORING_WEIGHTS.rentalYield +
      SCORING_WEIGHTS.winProbability +
      SCORING_WEIGHTS.equityBurden;
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("scoreApartment", () => {
  it("returns score in 0..100", () => {
    const project = mkProject();
    const s = scoreApartment(project, project.apartments[0]);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it("discount: large discount → high discount sub-score", () => {
    const project = mkProject({
      apartments: [
        mkApt({ lotteryPrice: 1_500_000, marketPrice: 3_000_000 }), // 50%
      ],
    });
    const s = scoreApartment(project, project.apartments[0]);
    expect(s.breakdown.discount).toBeGreaterThan(90);
    expect(s.metrics.discountFraction).toBeCloseTo(0.5, 2);
  });

  it("discount: zero discount → zero discount sub-score", () => {
    const project = mkProject({
      apartments: [mkApt({ lotteryPrice: 2_000_000, marketPrice: 2_000_000 })],
    });
    const s = scoreApartment(project, project.apartments[0]);
    expect(s.breakdown.discount).toBe(0);
    expect(s.metrics.discountFraction).toBe(0);
  });

  it("applicants = null → uses conservative default for win probability", () => {
    const project = mkProject({ apartments: [mkApt({ applicants: null })] });
    const s = scoreApartment(project, project.apartments[0]);
    expect(s.metrics.winProbability).toBe(0.05);
  });

  it("more apartments / fewer applicants → higher winning sub-score", () => {
    const lowChance = scoreApartment(
      mkProject(),
      mkApt({ unitsOffered: 5, applicants: 5000 }), // 0.1%
    );
    const highChance = scoreApartment(
      mkProject(),
      mkApt({ unitsOffered: 50, applicants: 500 }), // 10%
    );
    expect(highChance.breakdown.winProbability).toBeGreaterThan(
      lowChance.breakdown.winProbability,
    );
  });

  it("higher market price (same lottery) → bigger discount → higher composite", () => {
    const cheap = scoreApartment(
      mkProject(),
      mkApt({ lotteryPrice: 2_000_000, marketPrice: 2_200_000 }),
    );
    const expensive = scoreApartment(
      mkProject(),
      mkApt({ lotteryPrice: 2_000_000, marketPrice: 3_000_000 }),
    );
    expect(expensive.score).toBeGreaterThan(cheap.score);
  });
});

describe("scoreAllProjects", () => {
  it("returns one entry per project, sorted by score desc", () => {
    const seed = getSeedProjects();
    const scored = scoreAllProjects(seed);
    expect(scored.length).toBe(seed.length);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score);
    }
  });

  it("each scored project's best.score equals its project.score", () => {
    const seed = getSeedProjects();
    const scored = scoreAllProjects(seed);
    for (const s of scored) {
      expect(s.score).toBe(s.best.score);
    }
  });
});
