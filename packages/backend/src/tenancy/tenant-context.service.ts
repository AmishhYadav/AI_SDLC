import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  getUserId(): string | undefined {
    return this.cls.get<string>('userId');
  }

  getOrganizationId(): string | undefined {
    return this.cls.get<string>('organizationId');
  }

  getOrganizationMemberId(): string | undefined {
    return this.cls.get<string>('organizationMemberId');
  }
}
