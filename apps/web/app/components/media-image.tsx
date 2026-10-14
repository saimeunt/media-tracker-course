import { BookOpen, Clapperboard, Gamepad2, Tv } from "lucide-react";
import { useState } from "react";
import type { MediaImage as Image, MediaType } from "@media-tracker/shared";
import { cn } from "~/lib/utils";

const TYPE_ICONS = { movie: Clapperboard, book: BookOpen, game: Gamepad2, series: Tv } satisfies Record<MediaType, unknown>;

/** "Image: author, license, via Wikimedia Commons", as free licenses ask. */
export function imageCredit(image: Pick<Image, "author" | "license">) {
  return ["Image:", image.author && `${image.author},`, image.license, "via Wikimedia Commons"].filter(Boolean).join(" ");
}

/**
 * A media's image, loaded from Wikimedia Commons. Without one, or when it can't load (offline),
 * an icon of the media's type takes its place. Logos are wide and title pages tall: the image
 * fits inside a fixed-ratio box, on a light background in both themes, since many logos are
 * black on a transparent background.
 */
export function MediaImage({ image, type, className }: { image: Pick<Image, "url" | "author" | "license"> | null; type: MediaType; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Icon = TYPE_ICONS[type];
  const shown = image && !failed;
  return (
    <div className={cn("flex aspect-video items-center justify-center overflow-hidden", shown ? "bg-neutral-100" : "bg-muted", className)}>
      {shown ? (
        <img src={image.url} alt="" title={imageCredit(image)} loading="lazy" onError={() => setFailed(true)} className="size-full object-contain p-4" />
      ) : (
        <Icon aria-hidden className="size-10 text-muted-foreground/40" />
      )}
    </div>
  );
}

/** The credit line under an image, linking to its page on Commons (author and full license). */
export function ImageCredit({ image }: { image: Image }) {
  return (
    <a href={image.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline">
      {imageCredit(image)}
    </a>
  );
}
