import { PageHeader } from "@/shared/components/page-header";
import { AiBehaviourNav } from "./ai-behaviour-nav";

export default function AiBehaviourLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader
        title="AI Behaviour"
        description="Configure how your AI agent responds — identity, personality, rules, and safety."
      />
      <AiBehaviourNav />
      {children}
    </div>
  );
}
