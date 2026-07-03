import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GetCurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.type';
import { NoTenantScope } from '../../tenancy/decorators/no-tenant-scope.decorator';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { OrganizationService } from '../application/organization.service';
import { MemberService } from '../application/member.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';

/**
 * REST API for Organization and OrganizationMember operations.
 *
 * createOrganization and listMyOrgs are @NoTenantScope — they run on routes where
 * no active organization context exists yet (e.g. first-time org creation). Identity
 * comes from the authenticated JWT principal (user.email).
 *
 * All other routes are tenant-scoped by default (TenantGuard enforces ACTIVE membership
 * via X-Organization-Id header and populates CLS before any handler runs).
 *
 * No business logic here — all orchestration is delegated to OrganizationService
 * and MemberService (CLAUDE.md §6).
 */
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly memberService: MemberService,
  ) {}

  @Post('/')
  @NoTenantScope()
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.organizationService.createOrganization(user.email, dto);
  }

  @Get('/mine')
  @NoTenantScope()
  listMyOrgs(@GetCurrentUser() user: CurrentUser) {
    return this.organizationService.listMyOrgs(user.email);
  }

  @Get('/:id')
  @RequirePermissions('organization:read')
  getOrganization(@Param('id') id: string) {
    return this.organizationService.findById(id);
  }

  @Post('/:id/members')
  @RequirePermissions('organization:manage')
  addMember(@Param('id') _id: string, @Body() dto: AddMemberDto) {
    return this.memberService.addMember(dto.email);
  }

  @Get('/:id/members')
  @RequirePermissions('organization:read')
  listMembers(@Param('id') _id: string) {
    return this.memberService.listMembers();
  }

  @Delete('/:id/members/:memberId')
  @RequirePermissions('organization:manage')
  @HttpCode(204)
  removeMember(@Param('id') _id: string, @Param('memberId') memberId: string) {
    return this.memberService.removeMember(memberId);
  }
}
