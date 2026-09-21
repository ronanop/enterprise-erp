"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { assignmentNavigationPaths } from "@/components/assets/navigation/assignment-navigation";
import {
  EMPTY_USER_TRANSFER_ASSIGN,
  EMPTY_USER_TRANSFER_RETURN,
  type UserTransferAssignFormState,
  type UserTransferDestinationMode,
  type UserTransferReturnFormState,
} from "@/components/assets/user-transfer-destination";
import {
  EMPTY_USER_TRANSFER_VERIFICATION,
  type UserTransferVerificationFormState,
} from "@/components/assets/user-transfer-verification";
import {
  UserTransferWorkspace,
  type UserTransferStage,
} from "@/components/assets/user-transfer-workspace";
import {
  listDepartmentOptions,
  listEmployeeDirectory,
  type OrgOption,
} from "@/lib/org-options";
import { ApiClientError } from "@/services/api-client";
import {
  userTransferService,
  type UserTransferContext,
  type UserTransferVerificationResult,
} from "@/services/assets-service";

export type UserTransferContainerProps = {
  assetId: string | null;
};

export function UserTransferContainer({ assetId }: UserTransferContainerProps) {
  const router = useRouter();
  const [context, setContext] = useState<UserTransferContext | null>(null);
  const [loading, setLoading] = useState(Boolean(assetId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState<UserTransferVerificationFormState>(
    EMPTY_USER_TRANSFER_VERIFICATION,
  );
  const [stage, setStage] = useState<UserTransferStage>("verification");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<UserTransferVerificationResult | null>(null);
  const [destinationMode, setDestinationMode] = useState<UserTransferDestinationMode>(null);
  const [assignForm, setAssignForm] = useState<UserTransferAssignFormState>(
    EMPTY_USER_TRANSFER_ASSIGN,
  );
  const [returnForm, setReturnForm] = useState<UserTransferReturnFormState>(
    EMPTY_USER_TRANSFER_RETURN,
  );
  const [employees, setEmployees] = useState<OrgOption[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<
    Awaited<ReturnType<typeof listEmployeeDirectory>>
  >([]);
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assetId?.trim()) {
      setContext(null);
      setLoading(false);
      setErrorMessage(null);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSubmitError(null);
    setStage("verification");
    setVerification(EMPTY_USER_TRANSFER_VERIFICATION);
    setVerificationResult(null);
    setDestinationMode(null);
    setAssignForm(EMPTY_USER_TRANSFER_ASSIGN);
    setReturnForm(EMPTY_USER_TRANSFER_RETURN);
    setFinalizeError(null);
    try {
      const [data, directory, deptOpts] = await Promise.all([
        userTransferService.getContext(assetId.trim()),
        listEmployeeDirectory(),
        listDepartmentOptions(),
      ]);
      setContext(data);
      setEmployeeDirectory(directory);
      setEmployees(directory.map((e) => ({ id: e.id, label: e.label })));
      setDepartments(deptOpts);
    } catch (err) {
      setContext(null);
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message || "Unable to load transfer context.");
      } else {
        setErrorMessage("Unable to load transfer context.");
      }
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onVerificationChange = useCallback(
    (patch: Partial<UserTransferVerificationFormState>) => {
      setVerification((prev) => ({ ...prev, ...patch }));
      setSubmitError(null);
    },
    [],
  );

  const onContinue = useCallback(async () => {
    if (!assetId?.trim() || !context) return;
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      const result = await userTransferService.submitVerification(assetId.trim(), {
        data_backup_verified: verification.dataBackupVerified,
        qc_completed: verification.qcCompleted,
        qc_remarks: verification.qcRemarks.trim() || null,
        physical_condition: verification.physicalCondition,
        verified_component_ids: verification.verifiedComponentIds,
        asset_version: context.version,
      });
      setVerificationResult(result);
      setStage("destination");
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.message || "Unable to save verification.");
      } else {
        setSubmitError("Unable to save verification.");
      }
    } finally {
      setSubmitBusy(false);
    }
  }, [assetId, context, verification]);

  const onAssignFormChange = useCallback(
    (patch: Partial<UserTransferAssignFormState>) => {
      setAssignForm((prev) => {
        const next = { ...prev, ...patch };
        if (patch.employeeId) {
          const emp = employeeDirectory.find((e) => e.id === patch.employeeId);
          if (emp?.departmentId) {
            next.departmentId = emp.departmentId;
          }
        }
        return next;
      });
      setFinalizeError(null);
    },
    [employeeDirectory],
  );

  const onSubmitAssign = useCallback(async () => {
    if (!assetId?.trim() || !context || !verificationResult) return;
    setFinalizeBusy(true);
    setFinalizeError(null);
    try {
      const isManual = assignForm.employeeSource === "MANUAL_ENTRY";
      const result = await userTransferService.assignToNewUser(assetId.trim(), {
        verification_id: verificationResult.verification_id,
        employee_source: assignForm.employeeSource,
        employee_id: isManual ? null : assignForm.employeeId,
        manual_employee_name: isManual ? assignForm.manualEmployeeName.trim() || null : null,
        manual_employee_phone: isManual ? assignForm.manualEmployeePhone.trim() || null : null,
        manual_employee_email: isManual
          ? assignForm.manualEmployeeEmail.trim() || null
          : null,
        manual_employee_deployed_to: isManual
          ? assignForm.manualEmployeeDeployedTo.trim() || null
          : null,
        department_id: assignForm.departmentId || null,
        to_location_id: assignForm.toLocationId,
        to_building_id: assignForm.toBuildingId,
        allocated_at: assignForm.allocatedAt,
        assignment_remarks: assignForm.assignmentRemarks.trim() || null,
        asset_version: context.version,
      });
      const q = new URLSearchParams({
        assetId: context.asset_id,
        transfer: result.document_number,
      });
      if (result.new_assignment_id) {
        q.set("assignmentId", result.new_assignment_id);
      }
      router.push(`/assets/asset-assignments?${q.toString()}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFinalizeError(err.message || "Unable to complete transfer.");
      } else {
        setFinalizeError("Unable to complete transfer.");
      }
    } finally {
      setFinalizeBusy(false);
    }
  }, [assetId, assignForm, context, router, verificationResult]);

  const onSubmitReturn = useCallback(async () => {
    if (!assetId?.trim() || !context || !verificationResult) return;
    setFinalizeBusy(true);
    setFinalizeError(null);
    try {
      await userTransferService.returnToStock(assetId.trim(), {
        verification_id: verificationResult.verification_id,
        reason: returnForm.reason.trim(),
        remarks: returnForm.remarks.trim() || null,
        asset_version: context.version,
      });
      router.push(assignmentNavigationPaths.inventory);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFinalizeError(err.message || "Unable to return asset to stock.");
      } else {
        setFinalizeError("Unable to return asset to stock.");
      }
    } finally {
      setFinalizeBusy(false);
    }
  }, [assetId, context, returnForm, router, verificationResult]);

  return (
    <UserTransferWorkspace
      assetId={assetId}
      context={context}
      loading={loading}
      errorMessage={errorMessage}
      verification={verification}
      onVerificationChange={onVerificationChange}
      stage={stage}
      submitBusy={submitBusy}
      submitError={submitError}
      verificationResult={verificationResult}
      onContinue={() => void onContinue()}
      onRetry={() => void load()}
      onBackToInventory={() => router.push(assignmentNavigationPaths.inventory)}
      onBackToVerification={() => {
        setStage("verification");
        setSubmitError(null);
        setDestinationMode(null);
        setFinalizeError(null);
      }}
      destinationMode={destinationMode}
      onDestinationModeChange={setDestinationMode}
      assignForm={assignForm}
      onAssignFormChange={onAssignFormChange}
      returnForm={returnForm}
      onReturnFormChange={(patch) => {
        setReturnForm((prev) => ({ ...prev, ...patch }));
        setFinalizeError(null);
      }}
      employees={employees}
      departments={departments}
      finalizeBusy={finalizeBusy}
      finalizeError={finalizeError}
      onSubmitAssign={() => void onSubmitAssign()}
      onSubmitReturn={() => void onSubmitReturn()}
    />
  );
}
