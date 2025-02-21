import { ConvertRequest, ConvertRequestBeingCreated } from '../../Storage';

export function createCombinedConvertRequests(
  newConvertRequests: ConvertRequest[],
  newConvertRequestsBeingCreated: ConvertRequestBeingCreated[],
) {
  const combinedConvertRequests = newConvertRequests.map((convertRequest) => {
    const convertRequestBeingCreated = newConvertRequestsBeingCreated.find(
      (convertRequestBeingCreated) => convertRequestBeingCreated.id === convertRequest.convertRequestBeingCreatedId,
    );

    return {
      ...convertRequest,
      convertRequestBeingCreated,
    };
  });

  return combinedConvertRequests;
}
