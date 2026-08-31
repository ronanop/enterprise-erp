import { WorkplaceStack } from "@/components/WorkplaceStack";

export default function ComplianceLayout() {
  return (
    <WorkplaceStack
      screens={[
        { name: "index", title: "Compliance" },
        { name: "[id]", title: "Policy" },
      ]}
    />
  );
}
