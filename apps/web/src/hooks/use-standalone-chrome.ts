"use client";

/**
 * Standalone HRMS always uses module workspace chrome (HR sidebar).
 */
export function isModuleStandalonePath(_pathname: string) {
  return true;
}

/** @deprecated Use isModuleStandalonePath. */
export function isCrmStandalonePath(pathname: string) {
  return isModuleStandalonePath(pathname);
}

export function useStandaloneChrome() {
  return true;
}

export const STANDALONE_KEY = "erp-standalone";
