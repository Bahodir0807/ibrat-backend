import {
  ApiResourceDto,
  mapPublicResource,
  mapPublicResources,
} from '../../common/responses/public-response.mapper';

export type BranchResponseDto = ApiResourceDto & {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export function mapBranchResponse(value: unknown): BranchResponseDto {
  return mapPublicResource<BranchResponseDto>(value);
}

export function mapBranchResponses(values: unknown[]): BranchResponseDto[] {
  return mapPublicResources<BranchResponseDto>(values);
}
