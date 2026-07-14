export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-4 border-b bg-background/95 px-6 py-6 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-page-title font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-body text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
