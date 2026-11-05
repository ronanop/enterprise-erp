import { MarketingTaskBoard } from "@/components/marketing/marketing-task-board";

export default function MarketingTasksPage() {
  // Team board: default to all visible tasks; My Work uses mineOnly.
  return <MarketingTaskBoard mineOnly={false} />;
}
