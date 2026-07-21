/** Shared API contract types aligned with backend Pydantic schemas. */

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errors: string[];
}

export interface HealthData {
  status: string;
  environment: string;
  version: string;
  database: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  mfa_required?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  tenant_id?: string;
  permissions?: string[];
  [key: string]: unknown;
}
