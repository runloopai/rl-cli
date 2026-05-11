import { describe, it, expect } from "@jest/globals";
import {
  allocateSectionLines,
  type SectionAllocation,
} from "../../../src/components/ResourceDetailPage.js";
import type { DetailSection } from "../../../src/components/resourceDetailTypes.js";

function makeSection(title: string, fieldCount: number): DetailSection {
  return {
    title,
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      label: `${title}-field-${i}`,
      value: `value-${i}`,
    })),
  };
}

function makeSectionWithNulls(
  title: string,
  validCount: number,
  nullCount: number,
): DetailSection {
  return {
    title,
    fields: [
      ...Array.from({ length: validCount }, (_, i) => ({
        label: `${title}-field-${i}`,
        value: `value-${i}`,
      })),
      ...Array.from({ length: nullCount }, (_, i) => ({
        label: `${title}-null-${i}`,
        value: undefined as unknown as string,
      })),
    ],
  };
}

describe("allocateSectionLines", () => {
  it("zero available lines puts all sections in sectionViewRefs", () => {
    const sections = [makeSection("A", 3), makeSection("B", 2)];
    const result = allocateSectionLines(sections, 0);

    expect(result.visibleFieldCount).toEqual([0, 0]);
    expect(result.sectionViewRefs).toHaveLength(2);
    expect(result.sectionViewRefs[0].partiallyVisible).toBe(false);
    expect(result.sectionViewRefs[1].partiallyVisible).toBe(false);
  });

  it("fewer lines than sections gives headers only, no fields", () => {
    const sections = [
      makeSection("A", 3),
      makeSection("B", 3),
      makeSection("C", 3),
    ];
    const result = allocateSectionLines(sections, 2);

    expect(result.visibleFieldCount).toEqual([0, 0, 0]);
    // All 3 sections should be in sectionViewRefs
    expect(result.sectionViewRefs).toHaveLength(3);
    // First 2 are partially visible (have header space), 3rd is not
    expect(result.sectionViewRefs[0].partiallyVisible).toBe(true);
    expect(result.sectionViewRefs[1].partiallyVisible).toBe(true);
    expect(result.sectionViewRefs[2].partiallyVisible).toBe(false);
  });

  it("all fields fit when enough lines available", () => {
    const sections = [makeSection("A", 2), makeSection("B", 2)];
    // 2 sections * 2 (header + view row) + 4 fields = 8 lines needed
    const result = allocateSectionLines(sections, 100);

    expect(result.visibleFieldCount).toEqual([2, 2]);
    expect(result.sectionViewRefs).toHaveLength(0);
  });

  it("single-field sections get priority", () => {
    const sections = [makeSection("Big", 10), makeSection("Single", 1)];
    // Enough for headers (4 lines) + 1 field only
    const result = allocateSectionLines(sections, 5);

    // Single-field section should get its 1 field guaranteed
    expect(result.visibleFieldCount[1]).toBe(1);
    // No sectionViewRef for Single since all its fields are visible
    const singleRef = result.sectionViewRefs.find(
      (r) => r.section.title === "Single",
    );
    expect(singleRef).toBeUndefined();
  });

  it("partial visibility creates sectionViewRef with partiallyVisible=true", () => {
    const sections = [makeSection("A", 10)];
    // 1 section * 2 (header + view row) + some field lines
    const result = allocateSectionLines(sections, 5);

    expect(result.visibleFieldCount[0]).toBeLessThan(10);
    expect(result.visibleFieldCount[0]).toBeGreaterThan(0);
    expect(result.sectionViewRefs).toHaveLength(1);
    expect(result.sectionViewRefs[0].partiallyVisible).toBe(true);
  });

  it("sections with all undefined/null fields are not in sectionViewRefs", () => {
    const sections = [
      makeSection("Valid", 3),
      makeSectionWithNulls("AllNull", 0, 5),
    ];
    const result = allocateSectionLines(sections, 0);

    // Only the Valid section should appear in sectionViewRefs
    expect(result.sectionViewRefs).toHaveLength(1);
    expect(result.sectionViewRefs[0].section.title).toBe("Valid");
  });

  it("empty section (0 valid fields) gets visibleFieldCount=0", () => {
    const sections = [makeSectionWithNulls("Empty", 0, 3)];
    const result = allocateSectionLines(sections, 100);

    expect(result.visibleFieldCount).toEqual([0]);
    expect(result.sectionViewRefs).toHaveLength(0);
  });

  it("distributes remaining lines to first sections after singles", () => {
    const sections = [
      makeSection("A", 5),
      makeSection("B", 5),
      makeSection("Single", 1),
    ];
    // 3 sections * 2 (header + view) = 6 overhead
    // If we have 11 lines: 6 overhead + 5 field lines
    // Single gets 1, remaining 4 go to A first
    const result = allocateSectionLines(sections, 11);

    expect(result.visibleFieldCount[2]).toBe(1); // Single gets its 1
    expect(result.visibleFieldCount[0]).toBe(4); // A gets remaining
    expect(result.visibleFieldCount[1]).toBe(0); // B gets none
  });

  it("handles single section with exact fit", () => {
    const sections = [makeSection("A", 3)];
    // 1 section * 2 (header + view) + 3 field lines = 5
    const result = allocateSectionLines(sections, 5);

    expect(result.visibleFieldCount).toEqual([3]);
    expect(result.sectionViewRefs).toHaveLength(0);
  });

  it("handles many sections with tight budget", () => {
    const sections = Array.from({ length: 5 }, (_, i) =>
      makeSection(`Section${i}`, 3),
    );
    // 5 sections * 2 = 10 overhead, only 10 lines available → no field lines
    const result = allocateSectionLines(sections, 10);

    // All sections get 0 fields and appear in sectionViewRefs
    result.visibleFieldCount.forEach((count) => expect(count).toBe(0));
    expect(result.sectionViewRefs).toHaveLength(5);
  });
});
