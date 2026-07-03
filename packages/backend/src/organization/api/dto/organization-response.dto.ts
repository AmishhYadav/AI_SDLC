export class OrganizationResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: string;
  createdAt!: Date;
  createdBy!: string | null;
}
