import { BatchRequest, BatchRequestBeingCreated, ConvertRequest, ConvertRequestBeingCreated } from '../../Storage';

export type CombinedConvertRequest = ConvertRequest & { convertRequestBeingCreated?: ConvertRequestBeingCreated };

export type CombinedBatchRequest = {
  batchConvertRequests?: BatchRequest;
  convertRequestBeingCreated?: BatchRequestBeingCreated;
};
