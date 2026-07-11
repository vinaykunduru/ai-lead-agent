"use client";

import { useState } from "react";
import type { Widget, WidgetSettings, WidgetTheme } from "@/db/schema";

export function WidgetPreview({
  widget,
  theme,
  settings,
}: {
  widget: Widget;
  theme: WidgetTheme;
  settings: WidgetSettings;
}) {
  const [open, setOpen] = useState(true);
  const suggested = Array.isArray(settings.suggestedQuestions)
    ? (settings.suggestedQuestions as string[])
    : [];

  const isTop = theme.launcherPosition.startsWith("top");
  const isRight = theme.launcherPosition.endsWith("right");

  return (
    <div className="relative h-[640px] max-w-2xl overflow-hidden rounded-lg border bg-muted/30">
      <p className="p-4 text-xs text-muted-foreground">yoursite.com</p>
      <div
        className="absolute flex flex-col items-end gap-3"
        style={{
          [isTop ? "top" : "bottom"]: 20,
          [isRight ? "right" : "left"]: 20,
        }}
      >
        {open ? (
          <div
            className="flex flex-col overflow-hidden bg-white shadow-2xl"
            style={{
              width: Math.min(theme.widgetWidth, 340),
              height: Math.min(theme.widgetHeight, 460),
              borderRadius: theme.borderRadius,
              fontFamily: theme.font,
            }}
          >
            <div className="p-4 font-semibold text-white" style={{ background: theme.primaryColor }}>
              {widget.name}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm text-gray-900">
              <p>{settings.welcomeMessage || "Hi! How can we help?"}</p>
              {suggested.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {suggested.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs"
                      style={{ borderColor: theme.accentColor, color: theme.accentColor }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              ) : null}
              {settings.showTypingIndicator ? (
                <p className="text-xs text-gray-400">Assistant is typing…</p>
              ) : null}
            </div>
            {settings.showPoweredBy ? (
              <div className="p-2 text-center text-[11px] text-gray-400">Powered by {widget.name}</div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex size-14 items-center justify-center rounded-full text-2xl text-white shadow-lg"
          style={{ background: theme.primaryColor }}
          aria-label="Toggle preview"
        >
          💬
        </button>
      </div>
    </div>
  );
}
