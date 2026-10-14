import { Link } from "react-router";
import type { EntryStatus } from "@media-tracker/shared";
import { Badge } from "~/components/ui/badge";
import { STATUS_LABELS } from "~/lib/media";

/** An entry as GraphQL queries return it: enum values are uppercase (COMPLETED). */
export interface EntryNode {
  status: Uppercase<EntryStatus>;
  rating: number | null;
  review: string | null;
  updatedAt: string;
  user: { id: string; username: string };
  media: { id: string; title: string };
}

/** One line of activity: who logged what, with their rating and review. */
export function EntryRow({ entry, showMedia = true }: { entry: EntryNode; showMedia?: boolean }) {
  return (
    <li className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm">
          <Link to={`/users/${entry.user.id}`} className="font-medium hover:underline">
            {entry.user.username}
          </Link>
          {showMedia && (
            <>
              {" · "}
              <Link to={`/media/${entry.media.id}`} className="hover:underline">
                {entry.media.title}
              </Link>
            </>
          )}
        </span>
        {entry.review && <p className="text-sm">“{entry.review}”</p>}
        <span className="text-xs text-muted-foreground">{new Date(entry.updatedAt).toLocaleDateString("en", { dateStyle: "medium" })}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        {entry.rating !== null && <span className="font-medium">★ {entry.rating}</span>}
        <Badge variant="secondary">{STATUS_LABELS[entry.status.toLowerCase() as EntryStatus]}</Badge>
      </div>
    </li>
  );
}
