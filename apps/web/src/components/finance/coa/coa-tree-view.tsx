"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  FolderTree,
  Search,
} from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatInrPrecise } from "@/services/finance-service";
import {
  accountTypeLabel,
  type ChartOfAccount,
} from "@/services/coa-service";

const TYPE_COLORS: Record<string, string> = {
  asset: "text-emerald-700",
  liability: "text-amber-800",
  equity: "text-sky-800",
  revenue: "text-indigo-800",
  expense: "text-rose-800",
};

type TreeNode = ChartOfAccount & { children: TreeNode[] };

function buildTree(accounts: ChartOfAccount[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const a of accounts) {
    map.set(a.id, { ...a, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    const parentId = node.parent_account_id;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.account_code.localeCompare(b.account_code));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function matchesSearch(node: TreeNode, q: string): boolean {
  if (!q) return true;
  const hay = `${node.account_code} ${node.account_name}`.toLowerCase();
  if (hay.includes(q)) return true;
  return node.children.some((c) => matchesSearch(c, q));
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes;
  return nodes
    .filter((n) => matchesSearch(n, q))
    .map((n) => ({ ...n, children: filterTree(n.children, q) }));
}

const CoaTreeNode = memo(function CoaTreeNode({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id) || depth === 0;
  const inactive = node.status === "inactive";

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors duration-200 hover:bg-muted/60",
          inactive && "opacity-60",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <button
          type="button"
          className={cn(
            "flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground",
            !hasChildren && "invisible",
          )}
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={() => onToggle(node.id)}
        >
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <FolderTree className={cn("size-3.5 shrink-0", TYPE_COLORS[node.account_type] ?? "text-muted-foreground")} />
        <Link
          href={`/finance/chart-of-accounts/${node.id}`}
          className="min-w-0 flex-1 cursor-pointer truncate font-medium hover:underline"
        >
          <span className="font-mono text-xs text-muted-foreground">{node.account_code}</span>
          <span className="mx-1.5 text-muted-foreground/50">·</span>
          <span>{node.account_name}</span>
        </Link>
        <span className={cn("hidden text-[10px] font-medium uppercase sm:inline", TYPE_COLORS[node.account_type])}>
          {accountTypeLabel(node.account_type)}
        </span>
        <FinanceStatusBadge status={node.status} />
        {!node.is_posting_account ? (
          <span className="hidden text-[10px] text-muted-foreground md:inline">Header</span>
        ) : (
          <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground md:inline">
            {formatInrPrecise(node.balance ?? 0)}
          </span>
        )}
        {inactive ? <Circle className="size-2 fill-amber-500 text-amber-500" /> : null}
      </div>
      {hasChildren && isOpen ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <CoaTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
});

type Props = {
  accounts: ChartOfAccount[];
  loading?: boolean;
};

export function CoaTreeView({ accounts, loading }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => {
    const roots = buildTree(accounts);
    return filterTree(roots, search.trim().toLowerCase());
  }, [accounts, search]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(accounts.map((a) => a.id)));
  };

  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tree…"
            className="h-8 pl-8"
          />
        </div>
        <button
          type="button"
          className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={expandAll}
        >
          Expand all
        </button>
        <button
          type="button"
          className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={collapseAll}
        >
          Collapse all
        </button>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No accounts match the current filters.
        </div>
      ) : (
        <ul className="max-h-[560px] space-y-0.5 overflow-y-auto p-2">
          {tree.map((node) => (
            <CoaTreeNode
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
