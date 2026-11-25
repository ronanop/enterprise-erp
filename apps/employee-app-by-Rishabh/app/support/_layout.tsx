import { WorkplaceStack } from "@/components/WorkplaceStack";

export default function SupportLayout() {
  return (
    <WorkplaceStack
      screens={[
        { name: "index", title: "Support" },
        { name: "new", title: "New ticket" },
        { name: "[id]", title: "Ticket" },
      ]}
    />
  );
}
