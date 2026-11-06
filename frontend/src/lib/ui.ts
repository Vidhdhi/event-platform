export const inputCls = "input";
export const labelCls = "label";
export const btnCls = "btn";
export const btnGhostCls = "btn btn-ghost";
export const cardCls = "card";

// Color-coded chip for an event type
export function typeChip(type: string) {
  const known = ["wedding", "birthday", "corporate"];
  return `chip chip-${known.includes(type) ? type : "other"}`;
}