export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 640px 320px at 50% -10%, color-mix(in oklch, var(--primary), transparent 93%), transparent 65%)",
        }}
      />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}
