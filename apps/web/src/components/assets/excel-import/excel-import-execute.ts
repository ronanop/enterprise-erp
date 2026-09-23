/**
 * CR-004 Phase 8B — client wrapper around POST /assets/assets/import.
 */

import type {
  AssetExcelImportApiRequest,
  AssetExcelImportSummaryDto,
} from "@/components/assets/excel-import/excel-import-api-mapper";
import { assetOperationsService } from "@/services/assets-service";

export async function executeExcelImport(
  request: AssetExcelImportApiRequest,
): Promise<AssetExcelImportSummaryDto> {
  const data = await assetOperationsService.importExcelRegister(request);
  return data as AssetExcelImportSummaryDto;
}
