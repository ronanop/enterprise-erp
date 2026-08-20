"use client";

import { Boxes, LayoutDashboard, PackagePlus, Undo2, UserPlus, Users } from "lucide-react";

import { useAssetNavigation } from "@/components/assets/navigation/use-asset-navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AssetModuleHubProps = {
  className?: string;
};

/**
 * Simple 3-module Asset Management hub.
 * Each module opens an existing workflow (no new APIs / pages duplicated).
 */
export function AssetModuleHub({ className }: AssetModuleHubProps) {
  const navigation = useAssetNavigation();

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-6",
        className,
      )}
      data-testid="asset-module-hub"
    >
      <PageHeader
        title="Asset Management"
        description="Choose a module to manage the register, allocate assets, or register a new asset."
      />

      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
        data-testid="asset-module-hub-grid"
      >
        {/* Module 1 — Asset register */}
        <Card
          className="border-border/80 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
          data-testid="module-asset"
        >
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50">
              <Boxes className="size-5 text-foreground" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-medium tracking-tight">Asset</CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Browse, search, and manage the company asset register.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              type="button"
              className="w-full cursor-pointer transition-colors duration-200"
              onClick={() => navigation.openInventory()}
              data-testid="module-asset-open"
            >
              Open Asset Register
            </Button>
          </CardContent>
        </Card>

        {/* Module 2 — Allocation */}
        <Card
          className="border-border/80 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
          data-testid="module-allocation"
        >
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50">
              <Users className="size-5 text-foreground" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-medium tracking-tight">Asset Allocation</CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Assign assets to employees and process returns.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              className="w-full cursor-pointer transition-colors duration-200"
              onClick={() => navigation.openAssignmentWizard()}
              data-testid="module-allocation-allocate"
            >
              <UserPlus className="size-4" aria-hidden />
              Allocate Asset
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer transition-colors duration-200"
              onClick={() => navigation.openReturnWizard()}
              data-testid="module-allocation-return"
            >
              <Undo2 className="size-4" aria-hidden />
              Return Asset
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full cursor-pointer text-muted-foreground transition-colors duration-200"
              onClick={() => navigation.openAssignmentList()}
              data-testid="module-allocation-list"
            >
              View assignments
            </Button>
          </CardContent>
        </Card>

        {/* Module 3 — Add Asset */}
        <Card
          className="border-border/80 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
          data-testid="module-add-asset"
        >
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50">
              <PackagePlus className="size-5 text-foreground" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-medium tracking-tight">Add Asset</CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Register a new asset into the company inventory.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              type="button"
              className="w-full cursor-pointer transition-colors duration-200"
              onClick={() => navigation.openRegisterNew()}
              data-testid="module-add-asset-open"
            >
              <PackagePlus className="size-4" aria-hidden />
              Register New Asset
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center border-t border-border/50 pt-4">
        <Button
          type="button"
          variant="link"
          className="cursor-pointer gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
          onClick={() => navigation.openOperations()}
          data-testid="module-hub-operations-link"
        >
          <LayoutDashboard className="size-3.5" aria-hidden />
          Full operations workspace
        </Button>
      </div>
    </div>
  );
}
