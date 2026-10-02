import { startViewAs } from "@/app/(app)/view-as-actions";

export function ViewAsButton({ staffId, name }: { staffId: string; name: string }) {
  return (
    <form action={startViewAs.bind(null, staffId)} className="inline">
      <button type="submit" className="text-xs font-bold uppercase tracking-wider text-on-surface-subtle hover:text-primary" title={`See the app as ${name} sees it`}>
        View as
      </button>
    </form>
  );
}
