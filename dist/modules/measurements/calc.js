"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.measuredHeight = exports.measuredWidth = exports.minOf = void 0;
const present = (v) => v.filter((x) => typeof x === "number");
const minOf = (...v) => {
    const a = present(v);
    return a.length ? Math.min(...a) : null;
};
exports.minOf = minOf;
/** Smallest measured width/height: the opening is only as large as its tightest point. */
const measuredWidth = (l) => (0, exports.minOf)(l.widthTopMm, l.widthMidMm, l.widthBottomMm);
exports.measuredWidth = measuredWidth;
const measuredHeight = (l) => (0, exports.minOf)(l.heightLeftMm, l.heightMidMm, l.heightRightMm);
exports.measuredHeight = measuredHeight;
