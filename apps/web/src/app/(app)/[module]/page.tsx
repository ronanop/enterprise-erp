import { notFound } from "next/navigation";

import { ModuleHub } from "@/components/module/module-hub";
import { getModule } from "@/config/modules";

interface PageProps {
  params: Promise<{ module: string }>;
}

export default async function ModulePage({ params }: PageProps) {
  const { module: moduleKey } = await params;
  const mod = getModule(moduleKey);
  if (!mod) notFound();
  return <ModuleHub module={mod} />;
}
