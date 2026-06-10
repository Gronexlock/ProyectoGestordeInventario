import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupDisableNumberInputWheel } from "../utils/disableNumberInputWheel";

describe("setupDisableNumberInputWheel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("previene scroll en inputs type=number", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    setupDisableNumberInputWheel();

    expect(addSpy).toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
      { passive: false, capture: true }
    );

    const handler = addSpy.mock.calls[0][1] as (event: WheelEvent) => void;
    const input = document.createElement("input");
    input.type = "number";
    const event = {
      target: input,
      preventDefault: vi.fn(),
    } as unknown as WheelEvent;

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("no previene scroll en otros elementos", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    setupDisableNumberInputWheel();

    const handler = addSpy.mock.calls[0][1] as (event: WheelEvent) => void;
    const input = document.createElement("input");
    input.type = "text";
    const event = {
      target: input,
      preventDefault: vi.fn(),
    } as unknown as WheelEvent;

    handler(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
