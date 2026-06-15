import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SliderInput } from "@/components/SliderInput";

function setup(overrides: Partial<Parameters<typeof SliderInput>[0]> = {}) {
  const props = {
    label: "מחיר",
    value: 1_000_000,
    onChange: vi.fn(),
    min: 0,
    max: 5_000_000,
    step: 50_000,
    unit: "₪" as const,
    ...overrides,
  };
  const result = render(<SliderInput {...props} />);
  return { ...result, props };
}

describe("SliderInput", () => {
  it("displays the formatted value when blurred (shekels with separator)", () => {
    setup();
    const input = screen.getByLabelText("מחיר") as HTMLInputElement;
    expect(input.value).toMatch(/1,000,000/);
    expect(input.value).toContain("₪");
  });

  it("typing a valid in-range number updates the slider via onChange", async () => {
    const onChange = vi.fn();
    setup({ onChange });
    const input = screen.getByLabelText("מחיר") as HTMLInputElement;
    // Use fireEvent for reliable event triggering (userEvent has async timing issues)
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2000000" } });
    // After typing a complete, valid, in-range number, onChange should have been called
    expect(onChange).toHaveBeenCalled();
    const lastValue = onChange.mock.calls.at(-1)?.[0];
    expect(lastValue).toBe(2_000_000);
  });

  it("clamps to max on blur when an out-of-range value is typed", () => {
    const onChange = vi.fn();
    setup({ onChange, max: 3_000_000 });
    const input = screen.getByLabelText("מחיר") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9999999" } });
    fireEvent.blur(input);
    // Last call must be clamped to max.
    const lastValue = onChange.mock.calls.at(-1)?.[0];
    expect(lastValue).toBe(3_000_000);
  });

  it("clamps to min on blur when value is below range", () => {
    const onChange = vi.fn();
    setup({ onChange, min: 100_000 });
    const input = screen.getByLabelText("מחיר") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    const lastValue = onChange.mock.calls.at(-1)?.[0];
    expect(lastValue).toBe(100_000);
  });

  it("snaps to step on blur", () => {
    const onChange = vi.fn();
    setup({ onChange, min: 0, max: 1_000_000, step: 50_000 });
    const input = screen.getByLabelText("מחיר") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.blur(input);
    const lastValue = onChange.mock.calls.at(-1)?.[0];
    // 123,456 snaps to 100,000 or 150,000 — both are valid multiples of 50K.
    expect(lastValue % 50_000).toBe(0);
  });

  it("respects asPercent: typed 5 → 0.05 internal", () => {
    const onChange = vi.fn();
    setup({
      onChange,
      asPercent: true,
      min: 0,
      max: 0.1,
      step: 0.001,
      value: 0.04,
      unit: "",
    });
    const input = screen.getByLabelText("מחיר") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);
    const lastValue = onChange.mock.calls.at(-1)?.[0];
    expect(lastValue).toBeCloseTo(0.05, 4);
  });
});
