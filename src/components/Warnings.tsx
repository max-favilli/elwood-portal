export default function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div role="status" className="px-3 py-2 text-xs text-amber-300 bg-amber-950/30 border-b border-amber-700 max-h-36 overflow-auto">
      <strong>Warnings</strong>
      {warnings.map((warning, index) => <p className="whitespace-pre-wrap" key={index}>{warning}</p>)}
    </div>
  );
}
