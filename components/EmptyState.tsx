import Link from "next/link";

type EmptyStateProps = {
  message: string;
  linkHref?: string;
  linkLabel?: string;
};

export function EmptyState({ message, linkHref, linkLabel }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-paper/20 px-6 py-10 text-center">
      <p className="text-paper/70">{message}</p>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="mt-3 inline-block text-sm text-blue underline-offset-4 hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
