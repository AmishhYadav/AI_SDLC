import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Shared cursor-based pagination DTO for all list endpoints (SEAM-06, D-08).
 *
 * ValidationPipe flags that enforce this DTO are registered in AppModule (Plan 06):
 *   whitelist: true — strip non-decorated properties silently
 *   forbidNonWhitelisted: true — 400 if unknown properties present
 *   transform: true + enableImplicitConversion: true — coerce query param strings to numbers
 *
 * @example
 *   @Get()
 *   list(@Query() query: CursorPaginationDto) { ... }
 */
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
