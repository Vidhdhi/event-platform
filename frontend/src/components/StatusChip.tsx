const STYLES: Record<string, string> = {
  pending: "chip chip-birthday",
  accepted: "chip chip-corporate",
  completed: "chip chip-wedding",
  rejected: "chip bg-red-100 text-red-700",
  cancelled: "chip chip-other",
};

export default function StatusChip({ status }: { status: string }) {
  return <span className={STYLES[status] ?? "chip chip-other"}>{status}</span>;
}