/**
 * CR-004 Phase 5B-2B Task 5 — Query → container prop mapping (page hosts only).
 * Containers never import this; they remain URL-agnostic.
 */

import type {
  AssignmentWizardQuery,
  ReturnWizardQuery,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import {
  parseAssignmentWizardQuery,
  parseReturnWizardQuery,
} from "@/components/assets/assignment-wizard/assignment-wizard-query";
import type {
  AssignmentWizardState,
  ReturnWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";

export type SearchParamsLike = {
  get: (key: string) => string | null;
};

/** Trim; empty / whitespace → undefined. */
export function normalizeQueryId(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type AssignmentPageContainerProps = {
  draftId?: string;
  initialState?: Partial<AssignmentWizardState>;
  /** Echo of normalized query for page-host success/cancel side effects. */
  query: {
    assetId?: string;
    employeeId?: string;
    draftId?: string;
  };
};

export type ReturnPageContainerProps = {
  assetId?: string;
  assignmentId?: string;
  initialState?: Partial<ReturnWizardState>;
  /** True when intent is absent or exactly "return". */
  isReturnIntent: boolean;
  /** True when intent is present but not "return". */
  hasInvalidIntent: boolean;
  query: {
    assetId?: string;
    assignmentId?: string;
    intent?: string;
  };
};

export function mapAssignmentQueryToContainerProps(
  query: AssignmentWizardQuery,
): AssignmentPageContainerProps {
  const assetId = normalizeQueryId(query.assetId);
  const employeeId = normalizeQueryId(query.employeeId);
  const draftId = normalizeQueryId(query.draftId);

  const initialState: Partial<AssignmentWizardState> = {};
  if (assetId) initialState.assetId = assetId;
  if (employeeId) initialState.employeeId = employeeId;

  return {
    draftId,
    initialState: Object.keys(initialState).length > 0 ? initialState : undefined,
    query: { assetId, employeeId, draftId },
  };
}

export function mapReturnQueryToContainerProps(query: ReturnWizardQuery): ReturnPageContainerProps {
  const assetId = normalizeQueryId(query.assetId);
  const assignmentId = normalizeQueryId(query.assignmentId);
  const intent = normalizeQueryId(query.intent);
  const isReturnIntent = intent === undefined || intent === "return";
  const hasInvalidIntent = intent !== undefined && intent !== "return";

  return {
    assetId,
    assignmentId,
    isReturnIntent,
    hasInvalidIntent,
    query: { assetId, assignmentId, intent },
  };
}

/** Page-host entry: URLSearchParams → Assignment container props. */
export function assignmentPropsFromSearchParams(
  params: SearchParamsLike,
): AssignmentPageContainerProps {
  return mapAssignmentQueryToContainerProps(parseAssignmentWizardQuery(params as URLSearchParams));
}

/** Page-host entry: URLSearchParams → Return container props. */
export function returnPropsFromSearchParams(params: SearchParamsLike): ReturnPageContainerProps {
  return mapReturnQueryToContainerProps(parseReturnWizardQuery(params as URLSearchParams));
}

export function hasReturnTarget(props: ReturnPageContainerProps): boolean {
  return Boolean(props.assignmentId || props.assetId);
}
