const present = (v: (number | null | undefined)[]): number[] => v.filter((x): x is number => typeof x === "number");

export const minOf = (...v: (number | null | undefined)[]): number | null => {
  const a = present(v);
  return a.length ? Math.min(...a) : null;
};

export interface LineDims {
  widthTopMm: number | null; widthMidMm: number | null; widthBottomMm: number | null;
  heightLeftMm: number | null; heightMidMm: number | null; heightRightMm: number | null;
}

/** Smallest measured width/height: the opening is only as large as its tightest point. */
export const measuredWidth = (l: LineDims) => minOf(l.widthTopMm, l.widthMidMm, l.widthBottomMm);
export const measuredHeight = (l: LineDims) => minOf(l.heightLeftMm, l.heightMidMm, l.heightRightMm);
