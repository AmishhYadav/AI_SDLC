import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { OrganizationController } from './api/organization.controller';
import { OrganizationService } from './application/organization.service';
import { MemberService } from './application/member.service';
import { OrganizationRepository } from './persistence/organization.repository';
import { MemberRepository } from './persistence/member.repository';

/**
 * Organization domain module — leaf-level.
 *
 * Imports TenancyModule to access TenantedPrismaService and TenantContextService
 * (required by MemberRepository and OrganizationService). PrismaModule and
 * ClsModule are @Global() in AppModule and do not need to be listed here.
 */
@Module({
  imports: [TenancyModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, MemberService, OrganizationRepository, MemberRepository],
})
export class OrganizationModule {}
