"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERSONALITY_TYPES } from "@/modules/ai-behaviour/validation";
import type { PlaygroundTestResult } from "@/modules/ai-behaviour/playground-service";
import type { AiProfile } from "@/db/schema";

const PERSONALITY_LABELS: Record<string, string> = {
  professional: "Professional",
  friendly: "Friendly",
  technical: "Technical",
  luxury: "Luxury",
  healthcare: "Healthcare",
  legal: "Legal",
  sales: "Sales",
  custom: "Custom",
};

export function PlaygroundForm({ profile, canTest }: { profile: AiProfile; canTest: boolean }) {
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState(profile.primaryLanguage);
  const [personality, setPersonality] = useState<string>(profile.personalityType);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PlaygroundTestResult | null>(null);

  const supportedLanguages = Array.isArray(profile.supportedLanguages)
    ? (profile.supportedLanguages as string[])
    : [profile.primaryLanguage];

  async function runTest() {
    if (!message.trim()) {
      toast.error("Enter a question to preview");
      return;
    }
    setPending(true);
    const res = await fetch("/api/ai-behaviour/playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim(), language, personalityOverride: personality }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not run preview");
      return;
    }
    setResult(await res.json());
  }

  if (!canTest) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          You don&rsquo;t have permission to use the playground.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <p className="text-sm text-muted-foreground">
            Internal testing only — this previews your configuration, it is not the live chat widget and
            does not call an AI provider.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playground-message">Question</Label>
            <Textarea
              id="playground-message"
              rows={3}
              placeholder="e.g. What are your business hours?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="playground-language">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v ?? language)}>
                <SelectTrigger id="playground-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="playground-personality">Behaviour profile</Label>
              <Select value={personality} onValueChange={(v) => setPersonality(v ?? personality)}>
                <SelectTrigger id="playground-personality" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONALITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PERSONALITY_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" disabled={pending} onClick={runTest}>
            {pending ? "Running preview..." : "Preview"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Preview result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{result.appliedLanguage.toUpperCase()}</Badge>
              <Badge variant="outline" className="capitalize">
                {result.appliedPersonality}
              </Badge>
              <Badge variant={result.withinBusinessHours ? "secondary" : "outline"}>
                {result.withinBusinessHours ? "Within business hours" : "Outside business hours"}
              </Badge>
            </div>
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {result.mockReply}
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Assembled configuration (what a future chat engine would receive)
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(result.promptPreview, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
