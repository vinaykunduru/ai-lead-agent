# Frontend

## App Router structure

```
src/app/
  admin/       # Platform Admin surface (layout: requirePlatformAdmin())
  app/         # Company Dashboard surface (layout: requireCompanySession())
  auth/        # Login, invite confirmation, set-password
  api/         # Route Handlers
```

Each route segment under `app/` and `admin/` that fetches data ships a matching `loading.tsx`, sized to match the real page's layout to avoid content jumping when the real data arrives — Next.js's native Suspense-based route loading, not a hand-rolled spinner overlay.

## Component system

- **`src/components/ui/`** — shadcn/ui primitives (Button, Card, Dialog, AlertDialog, Select, Checkbox, Switch, Tabs, Table, Input, Badge, Avatar, DropdownMenu, etc.), each carrying this app's shared conventions: `cursor-pointer`/`cursor-not-allowed` states, a `loading` prop pattern on `Button` (and `AlertDialogAction`, which forwards to `Button`) that shows a spinner, sets `aria-busy`, and disables the control.
- **`src/shared/components/`** — app-specific composites built on top of the primitives: `DashboardShell` (the sidebar/header shell both `/admin` and `/app` use), `PageHeader`, `EmptyState`, `StatusBadge`, `BackLink`, skeleton primitives (`TableSkeleton`, `CardGridSkeleton`, `PageHeaderSkeleton`), and `RouteProgressBar` (a hand-rolled top progress bar, mounted once in the root layout).

## Design tokens

Defined via Tailwind v4's `@theme inline` in `globals.css`:

- **Typography scale** — named tokens (`--text-page-title` through `--text-metadata`), each paired with a `--line-height` value, rather than ad hoc `text-*` + `leading-*` combinations scattered per page.
- **Shadow scale** — `--shadow-card`, `--shadow-card-hover`, `--shadow-popover`, applied consistently to every bordered card/table/popover surface instead of one-off `shadow-*` utility choices.

## Loading & feedback conventions

A deliberate, app-wide system (not per-page ad hoc spinners):

- **Route-level**: `RouteProgressBar` (top progress bar, keyed on pathname/search params) + `loading.tsx` per route segment.
- **Button-level**: the `loading` prop (spinner, `aria-busy`, `disabled`, `cursor-progress`) — applied to every destructive action (`AlertDialogAction`) and every async form submission, not just some.
- **Table-level**: skeleton rows sized to the real table, never a flash-of-empty-state before data arrives.
- **Micro-interactions**: hover/press states target 150–200ms — see `Card interactive` (arrow-nudge-on-hover) as the standard "clickable card" pattern.
- **Accessibility**: `aria-busy` during async operations, `aria-live` for toasts, focus management on dialog open/close.

## Route progress bar — a non-obvious implementation detail

`src/shared/components/route-progress-bar.tsx` deliberately does **not** gate on `event.defaultPrevented` when detecting internal link clicks — `next/link`'s own click handler calls `preventDefault()` via React's root-container-level event delegation *before* this component's document-level bubble listener runs, so checking that flag would silently treat every real navigation as already-prevented and never show the bar. If you touch this file, keep that in mind before "cleaning up" the click detection.

## CSS layout gotcha worth knowing

A `<main>` (or any flex/grid container) without `min-width: 0` can let a descendant with `overflow-hidden` collapse to a `0`-width box under certain grid `fr`-track layouts — content present in the DOM, invisible on screen. `DashboardShell`'s `<main>` carries `min-w-0` for exactly this reason; detail-page two-column grids additionally use an explicit `minmax()` floor rather than a bare `fr` split. See [Troubleshooting → Layout/CSS issues](../troubleshooting/README.md#layout--css-issues-that-only-appear-in-production) if you see a region render empty despite data loading.

Related: [Architecture](../architecture/README.md) · [Troubleshooting](../troubleshooting/README.md)
