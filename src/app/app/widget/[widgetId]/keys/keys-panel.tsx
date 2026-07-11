"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { WidgetKey } from "@/db/schema";

export function KeysPanel({
  widgetId,
  keys,
  canRotate,
}: {
  widgetId: string;
  keys: WidgetKey[];
  canRotate: boolean;
}) {
  const router = useRouter();

  async function rotate() {
    const res = await fetch(`/api/widgets/${widgetId}/keys/rotate`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not rotate key");
      return;
    }
    toast.success("Key rotated — update your installation snippet with the new key");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Public keys</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rotating a key immediately revokes the old one — any site still using it will stop working
            until its snippet is updated.
          </p>
        </div>
        {canRotate ? (
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline">Rotate key</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rotate the public key?</AlertDialogTitle>
                <AlertDialogDescription>
                  The current key stops working immediately. You&rsquo;ll need to update the installation
                  snippet on every site using this widget.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={rotate}>Rotate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {keys.map((key) => (
          <div key={key.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div>
              <p className="font-mono text-xs">{key.publicKey}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Created {key.createdAt.toLocaleString()}
                {key.revokedAt ? ` · Revoked ${key.revokedAt.toLocaleString()}` : ""}
              </p>
            </div>
            <Badge variant={key.status === "active" ? "secondary" : "outline"} className="capitalize">
              {key.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
