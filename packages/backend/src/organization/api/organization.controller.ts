import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GetCurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.type';
import { NoTenantScope } from '../../tenancy/decorators/no-tenant-scope.decorator';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { OrganizationService } from '../application/organization.service';
import { MemberService } from '../application/member.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';
import { MemberResponseDto } from './dto/member-response.dto';

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
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @GetCurrentUser() user: CurrentUser,
  ): Promise<OrganizationResponseDto> {
    const org = await this.organizationService.createOrganization(user.email, dto);
    return OrganizationResponseDto.from(org);
  }

  @Get('/mine')
  @NoTenantScope()
  async listMyOrgs(@GetCurrentUser() user: CurrentUser): Promise<OrganizationResponseDto[]> {
    const orgs = await this.organizationService.listMyOrgs(user.email);
    return orgs.map(OrganizationResponseDto.from);
  }

  @Get('/:id')
  @RequirePermissions('organization:read')
  async getOrganization(@Param('id') id: string): Promise<OrganizationResponseDto> {
    const org = await this.organizationService.findById(id);
    return OrganizationResponseDto.from(org);
  }

  @Post('/:id/members')
  @RequirePermissions('organization:manage')
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ): Promise<MemberResponseDto> {
    const member = await this.memberService.addMember(id, dto.email);
    return MemberResponseDto.from(member);
  }

  @Get('/:id/members')
  @RequirePermissions('organization:read')
  async listMembers(@Param('id') id: string): Promise<MemberResponseDto[]> {
    const members = await this.memberService.listMembers(id);
    return members.map(MemberResponseDto.from);
  }

  @Delete('/:id/members/:memberId')
  @RequirePermissions('organization:manage')
  @HttpCode(204)
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.memberService.removeMember(id, memberId);
  }
}
