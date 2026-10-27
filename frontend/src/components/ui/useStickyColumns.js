import { useEffect, useMemo, useRef, useState } from "react";

/* How many leading columns stay frozen while the table scrolls sideways. */
const FROZEN_COLUMNS = 2;

/* Soft edge so the frozen block reads as sitting on top of the scrolling cells. */
const FROZEN_EDGE_SHADOW = "4px 0 10px -6px rgba(15, 23, 42, 0.35)";

const DIVIDER = "1px solid var(--color-border-secondary)";

export const resolveStickyKeys = (columns = [], stickyColumnKey) => {
  if (stickyColumnKey) {
    return Array.isArray(stickyColumnKey) ? stickyColumnKey : [stickyColumnKey];
  }
  /* Explicit `sticky: true` columns win over the default first-two rule. */
  const explicit = columns.filter((c) => c.sticky).map((c) => c.key);
  if (explicit.length > 0) return explicit;
  return columns.slice(0, FROZEN_COLUMNS).map((c) => c.key);
};

/**
 * Frozen-column bookkeeping shared by every table:
 *
 *  - which keys are frozen (the first two columns by default, so the S.No +
 *    name/organisation columns never scroll away)
 *  - the measured width of the first frozen column, used as the `left`
 *    offset of the second one so both sit flush — no gap, no overlap
 *  - style/attribute builders for the frozen header and body cells
 *
 * Frozen cells paint with `backgroundColor: inherit`, so they always match
 * the row/header they belong to (including hover) and stay fully opaque —
 * scrolled content can never bleed through them.
 */
export default function useStickyColumns(columns, stickyColumnKey) {
  const stickyKeys = useMemo(
    () => resolveStickyKeys(columns, stickyColumnKey),
    [columns, stickyColumnKey]
  );

  const tableRef = useRef(null);
  const [firstWidth, setFirstWidth] = useState(0);

  /* Re-measure after every render (data/sort/page/columns can all change
     the column width) and whenever the viewport resizes. */
  useEffect(() => {
    const measure = () => {
      const cell = tableRef.current?.querySelector("[data-sticky-first]");
      const width = cell ? Math.round(cell.getBoundingClientRect().width) : 0;
      setFirstWidth((prev) => (prev === width ? prev : width));
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const stickyIndex = (key) => stickyKeys.indexOf(key);
  const isFirstSticky = (key) => stickyIndex(key) === 0;
  const isSecondSticky = (key) => stickyIndex(key) === 1;
  const isSticky = (key) => stickyIndex(key) >= 0;

  /** Inline style for a frozen cell. `header` lifts it above the body cells. */
  const stickyStyle = (
    key,
    { header = false, borderTop = false, borderBottom = false } = {}
  ) => {
    const index = stickyIndex(key);
    if (index < 0) return { zIndex: 1 };

    const style = {
      position: "sticky",
      left: index === 0 ? 0 : firstWidth,
      zIndex: header ? 20 : 10,
      isolation: "isolate",
    };

    /* Shadow only on the last frozen column — that is the frozen edge. */
    if (index === stickyKeys.length - 1) style.boxShadow = FROZEN_EDGE_SHADOW;
    /* Own copy of the row/header divider so the lines stay continuous
       across the frozen cells while the rest of the row scrolls. */
    if (borderTop) style.borderTop = DIVIDER;
    if (borderBottom) style.borderBottom = DIVIDER;

    return style;
  };

  /** Marks the first frozen column so its width can be measured. */
  const firstStickyAttr = (key) =>
    isFirstSticky(key) ? { "data-sticky-first": "" } : undefined;

  return {
    tableRef,
    stickyKeys,
    stickyStyle,
    firstStickyAttr,
    isSticky,
    isFirstSticky,
    isSecondSticky,
  };
}
