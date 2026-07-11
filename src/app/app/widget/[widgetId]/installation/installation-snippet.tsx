"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallationSnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-2">
      <pre className="overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{snippet}</pre>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy snippet"}
      </Button>
    </div>
  );
}
