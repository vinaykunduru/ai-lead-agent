"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KnowledgeCollection } from "@/db/schema";

type Props = {
  collections: KnowledgeCollection[];
  defaultCollectionId?: string;
};

type Mode = "file" | "text" | "website";

export function UploadDialog({ collections, defaultCollectionId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("file");
  const [pending, setPending] = useState(false);
  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? collections[0]?.id ?? "");

  async function submitFile(formData: FormData) {
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a file to upload");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("collectionId", collectionId);
    body.set("title", title || file.name);

    setPending(true);
    const res = await fetch("/api/knowledge/documents", { method: "POST", body });
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Upload failed");
      return;
    }
    toast.success("Document uploaded — processing will start shortly");
    setOpen(false);
    router.refresh();
  }

  async function submitText(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    if (!title || !content) {
      toast.error("Title and content are required");
      return;
    }
    setPending(true);
    const res = await fetch("/api/knowledge/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, title, content }),
    });
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Could not save text");
      return;
    }
    toast.success("Document created — processing will start shortly");
    setOpen(false);
    router.refresh();
  }

  async function submitWebsite(formData: FormData) {
    const url = String(formData.get("url") ?? "").trim();
    if (!url) {
      toast.error("Enter a URL");
      return;
    }
    setPending(true);
    const res = await fetch("/api/knowledge/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, url }),
    });
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Could not import this page");
      return;
    }
    toast.success("Page queued for import");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add document</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to knowledge base</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="upload-collection">Collection</Label>
          <Select value={collectionId} onValueChange={(value) => setCollectionId(value ?? "")}>
            <SelectTrigger id="upload-collection" className="w-full">
              <SelectValue placeholder="Choose a collection" />
            </SelectTrigger>
            <SelectContent>
              {collections
                .filter((c) => c.status === "active")
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="file" className="flex-1">
              File
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1">
              Text
            </TabsTrigger>
            <TabsTrigger value="website" className="flex-1">
              Website
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <form
              action={submitFile}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="upload-file-title">Title (optional)</Label>
                <Input id="upload-file-title" name="title" maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-file">PDF or DOCX (max 20MB)</Label>
                <Input id="upload-file" name="file" type="file" accept=".pdf,.docx" required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending || !collectionId}>
                  {pending ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="text">
            <form action={submitText} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="upload-text-title">Title</Label>
                <Input id="upload-text-title" name="title" required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-text-content">Content</Label>
                <Textarea id="upload-text-content" name="content" required rows={8} maxLength={200_000} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending || !collectionId}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="website">
            <form action={submitWebsite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="upload-website-url">Page URL</Label>
                <Input id="upload-website-url" name="url" type="url" placeholder="https://example.com/about" required />
                <p className="text-xs text-muted-foreground">Imports one page only — no crawling.</p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending || !collectionId}>
                  {pending ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
