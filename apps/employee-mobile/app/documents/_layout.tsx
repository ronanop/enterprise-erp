import { WorkplaceStack } from "@/components/WorkplaceStack";

export default function DocumentsLayout() {
  return (
    <WorkplaceStack
      screens={[
        { name: "index", title: "Documents" },
        { name: "[id]", title: "Document" },
        { name: "upload", title: "Upload" },
      ]}
    />
  );
}
