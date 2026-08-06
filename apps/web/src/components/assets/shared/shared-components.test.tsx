/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Package } from "lucide-react";

import {
  BranchSelector,
  BRANCH_ALL_VALUE,
  EmptyState,
  InventoryFilterBar,
  EMPTY_INVENTORY_FILTERS,
  QueueCard,
  QuickActionCard,
  StatCard,
  StatusBadge,
  StatCardSkeleton,
  QueueCardSkeleton,
  TableRowsSkeleton,
  OPERATIONAL_STATUS_LABELS,
} from "@/components/assets/shared";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Assets" value={42} />);
    expect(screen.getByText("Total Assets")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("changes StatCard title for empty test without label clash", () => {
    render(<StatCard title="Assigned" empty />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders skeleton when loading", () => {
    render(<StatCard title="X" loading />);
    expect(screen.getByLabelText("Loading statistic")).toBeInTheDocument();
  });

  it("renders trend and icon", () => {
    render(
      <StatCard
        title="Ready"
        value={10}
        icon={Package}
        trend={{ label: "+2 this week", direction: "up" }}
      />,
    );
    expect(screen.getByText("+2 this week")).toBeInTheDocument();
  });

  it("calls onClick when interactive", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<StatCard title="Disposed" value={1} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("QueueCard", () => {
  it("renders rows", () => {
    render(
      <QueueCard
        title="Ready queue"
        columnLabels={["Tag", "Name"]}
        rows={[{ id: "1", cells: ["AST-1", "Laptop"] }]}
      />,
    );
    expect(screen.getByText("AST-1")).toBeInTheDocument();
    expect(screen.getByText("Laptop")).toBeInTheDocument();
  });

  it("shows empty state when no rows", () => {
    render(<QueueCard title="Pending" rows={[]} />);
    expect(screen.getByText("Queue is empty")).toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    render(<QueueCard title="Q" loading />);
    expect(screen.getByLabelText("Loading queue")).toBeInTheDocument();
  });

  it("fires action callback", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <QueueCard
        title="Ready"
        rows={[{ id: "1", cells: ["A"] }]}
        action={{ label: "View all", onClick }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View all" }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("StatusBadge", () => {
  it.each([
    "READY_TO_MOVE",
    "ASSIGNED",
    "RETIRED",
    "PENDING_DISPOSAL",
    "DISPOSED",
  ] as const)("renders operational label for %s", (status) => {
    const { container } = render(<StatusBadge kind="operational" status={status} />);
    expect(container).toHaveTextContent(OPERATIONAL_STATUS_LABELS[status]);
  });

  it("renders lifecycle badge", () => {
    render(<StatusBadge kind="lifecycle" status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});

describe("BranchSelector", () => {
  const branches = [
    { id: "noida", label: "Noida" },
    { id: "mumbai", label: "Mumbai" },
    { id: "dubai", label: "Dubai" },
  ];

  it("renders All and branches", () => {
    render(
      <BranchSelector value={BRANCH_ALL_VALUE} onChange={() => {}} branches={branches} />,
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Noida" })).toBeInTheDocument();
  });

  it("calls onChange when branch selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BranchSelector value={BRANCH_ALL_VALUE} onChange={onChange} branches={branches} />,
    );
    await user.click(screen.getByRole("button", { name: "Mumbai" }));
    expect(onChange).toHaveBeenCalledWith("mumbai");
  });
});

describe("InventoryFilterBar", () => {
  it("renders search and apply", () => {
    render(
      <InventoryFilterBar
        values={EMPTY_INVENTORY_FILTERS}
        onChange={() => {}}
        onApply={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});

describe("QuickActionCard", () => {
  it("renders title and fires onPress", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <QuickActionCard title="Register Asset" description="New register" icon={Package} onPress={onPress} />,
    );
    await user.click(screen.getByRole("button", { name: /Register Asset/i }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("EmptyState", () => {
  it("renders no-results variant", () => {
    render(<EmptyState variant="no-results" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders custom copy", () => {
    render(<EmptyState variant="no-assets" title="Custom" description="Hint" />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});

describe("LoadingSkeletons", () => {
  it("renders stat and queue skeletons", () => {
    const { container } = render(
      <>
        <StatCardSkeleton />
        <QueueCardSkeleton />
        <TableRowsSkeleton rows={2} />
      </>,
    );
    expect(container.querySelectorAll("[aria-busy=true]").length).toBeGreaterThanOrEqual(2);
  });
});

describe("responsive class hooks", () => {
  it("stat card accepts className for grid layouts", () => {
    const { container } = render(
      <StatCard title="T" value={1} className="min-w-[140px] md:min-w-[160px]" />,
    );
    expect(container.firstChild).toHaveClass("md:min-w-[160px]");
  });
});
