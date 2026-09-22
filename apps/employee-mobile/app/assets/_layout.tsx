import { WorkplaceStack } from "@/components/WorkplaceStack";

export default function AssetsLayout() {
  return (
    <WorkplaceStack
      screens={[
        { name: "index", title: "My assets" },
        { name: "[id]", title: "Asset" },
        { name: "scan", title: "Scan asset" },
        { name: "report", title: "Report issue" },
      ]}
    />
  );
}
