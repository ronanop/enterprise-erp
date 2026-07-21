/**
 * Documents (DMS) workspace config — aligned with FRD-19 / ERD_18
 * and apps/api document routers (Document → Archive).
 */

import type { LucideIcon } from "lucide-react";
import {
  Archive,
  CheckSquare,
  FileStack,
  FileText,
  FolderOpen,
  Share2,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type DocumentsWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type DocumentsPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "documents"
    | "document-versions"
    | "document-approvals"
    | "document-shares"
    | "retention-policies"
    | "archives";
};

export const DOCUMENTS_MODULE_KEY = "documents";

export const documentsWorkspaceGroups: DocumentsWorkspaceGroup[] = [
  {
    key: "repository",
    title: "Repository",
    description: "Folders, documents, versions, and tags",
    icon: FolderOpen,
    resourceKeys: ["folders", "documents", "document-versions", "document-tags"],
  },
  {
    key: "governance",
    title: "Access & Governance",
    description: "Permissions, shares, approvals, and workflows",
    icon: CheckSquare,
    resourceKeys: [
      "document-permissions",
      "document-shares",
      "document-approvals",
      "document-workflows",
    ],
  },
  {
    key: "lifecycle",
    title: "Lifecycle",
    description: "Templates, retention policies, and archives",
    icon: Archive,
    resourceKeys: ["templates", "retention-policies", "archives"],
  },
];

/** FRD-19 §3 document lifecycle (core operational stages) */
export const documentsPipelineStages: DocumentsPipelineStage[] = [
  {
    key: "document",
    title: "Document",
    href: "/documents/documents",
    resource: "documents",
  },
  {
    key: "version",
    title: "Version",
    href: "/documents/document-versions",
    resource: "document-versions",
  },
  {
    key: "approval",
    title: "Approval",
    href: "/documents/document-approvals",
    resource: "document-approvals",
  },
  {
    key: "share",
    title: "Share",
    href: "/documents/document-shares",
    resource: "document-shares",
  },
  {
    key: "retention",
    title: "Retention",
    href: "/documents/retention-policies",
    resource: "retention-policies",
  },
  {
    key: "archive",
    title: "Archive",
    href: "/documents/archives",
    resource: "archives",
  },
];

export function getDocumentsResources(): ModuleResource[] {
  return getModule(DOCUMENTS_MODULE_KEY)?.resources ?? [];
}

export function resolveDocumentsGroupResources(
  group: DocumentsWorkspaceGroup,
): ModuleResource[] {
  const all = getDocumentsResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const documentsQuickLinks = [
  {
    title: "Documents",
    href: "/documents/documents",
    description: "Document library",
    icon: FileText,
  },
  {
    title: "Approvals",
    href: "/documents/document-approvals",
    description: "Publish control",
    icon: CheckSquare,
  },
  {
    title: "Shares",
    href: "/documents/document-shares",
    description: "Secure sharing",
    icon: Share2,
  },
  {
    title: "Archives",
    href: "/documents/archives",
    description: "Records vault",
    icon: Archive,
  },
] as const;

export const documentsIcons = {
  FileStack,
  FolderOpen,
} as const;
