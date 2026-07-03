export class MemberResponseDto {
  id!: string;
  organizationId!: string;
  userId!: string;
  status!: string;
  joinedAt!: Date | null;
  createdAt!: Date;
}
