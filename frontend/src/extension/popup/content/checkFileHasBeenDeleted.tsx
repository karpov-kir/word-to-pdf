import { config } from '../../../Config';
import { CombinedConvertRequest } from '../CombinedConvertRequest';

export function checkFileHasBeenDeleted(
  combinedConvertRequest: CombinedConvertRequest,
  currentTime: number = Date.now(),
) {
  return combinedConvertRequest.convertedAt
    ? combinedConvertRequest.convertedAt + config.filesTtlMs < currentTime
    : false;
}
