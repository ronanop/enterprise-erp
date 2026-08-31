import { WorkplaceStack } from "@/components/WorkplaceStack";

export default function RoomsLayout() {
  return (
    <WorkplaceStack
      screens={[
        { name: "index", title: "Meeting rooms" },
        { name: "book", title: "Book room" },
      ]}
    />
  );
}
