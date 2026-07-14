"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { KnowledgeCollection } from "@/db/schema";

type Props = {
  collections: KnowledgeCollection[];
  activeCollectionId?: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function CollectionsSidebar({ collections, activeCollectionId, canCreate, canUpdate, canDelete }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<KnowledgeCollection | null>(null);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState(false);

  const active = collections.filter((c) => c.status === "active");
  const archived = collections.filter((c) => c.status === "archived");

  async function createCollection(name: string) {
    setPending(true);
    const res = await fetch("/api/knowledge/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not create collection");
      return;
    }
    toast.success("Collection created");
    setCreateOpen(false);
    router.refresh();
  }

  async function renameCollection(collectionId: string, name: string) {
    setPending(true);
    const res = await fetch(`/api/knowledge/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not rename collection");
      return;
    }
    toast.success("Collection renamed");
    setRenameTarget(null);
    router.refresh();
  }

  async function setStatus(collectionId: string, status: "active" | "archived") {
    const res = await fetch(`/api/knowledge/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not update collection");
      return;
    }
    toast.success(status === "archived" ? "Collection archived" : "Collection restored");
    router.refresh();
  }

  async function softDelete(collectionId: string) {
    const res = await fetch(`/api/knowledge/collections/${collectionId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not delete collection");
      return;
    }
    toast.success("Collection deleted");
    router.refresh();
  }

  return (
    <aside className="w-full shrink-0 rounded-xl border bg-card p-3 shadow-card md:w-60">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">Collections</h2>
        {canCreate ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button variant="ghost" size="sm">New</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New collection</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = String(formData.get("name") ?? "").trim();
                  if (name) void createCollection(name);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="new-collection-name">Name</Label>
                  <Input id="new-collection-name" name="name" required maxLength={120} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <nav className="space-y-1">
        <Link
          href={pathname}
          className={cn(
            "block rounded-md px-3 py-2 text-sm font-medium",
            !activeCollectionId
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          All documents
        </Link>
        {active.map((collection) => (
          <div key={collection.id} className="group flex items-center gap-1">
            <Link
              href={`${pathname}?collectionId=${collection.id}`}
              className={cn(
                "flex-1 truncate rounded-md px-3 py-2 text-sm font-medium",
                activeCollectionId === collection.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {collection.name}
              {collection.isDefault ? <span className="ml-1 text-xs text-muted-foreground">(default)</span> : null}
            </Link>
            {(canUpdate || canDelete) && !collection.isDefault ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  {canUpdate ? (
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(collection);
                        setNewName(collection.name);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                  ) : null}
                  {canUpdate ? (
                    <DropdownMenuItem onClick={() => setStatus(collection.id, "archived")}>
                      Archive
                    </DropdownMenuItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownMenuItem variant="destructive" onClick={() => softDelete(collection.id)}>
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ))}
      </nav>

      {archived.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-1 px-3 text-xs font-medium text-muted-foreground">Archived</h3>
          {archived.map((collection) => (
            <div key={collection.id} className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground">
              <span className="flex-1 truncate">{collection.name}</span>
              {canUpdate ? (
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => setStatus(collection.id, "active")}
                >
                  Restore
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename collection</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renameTarget && newName.trim()) void renameCollection(renameTarget.id, newName.trim());
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="rename-collection-name">Name</Label>
              <Input
                id="rename-collection-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
