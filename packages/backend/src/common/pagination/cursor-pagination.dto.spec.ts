import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CursorPaginationDto } from './cursor-pagination.dto';

describe('CursorPaginationDto', () => {
  it('validates a valid cursor and limit', async () => {
    const dto = plainToClass(CursorPaginationDto, { cursor: 'abc', limit: 10 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects limit > 100', async () => {
    const dto = plainToClass(CursorPaginationDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit < 1', async () => {
    const dto = plainToClass(CursorPaginationDto, { limit: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('defaults limit to 20 when no fields provided', async () => {
    const dto = plainToClass(CursorPaginationDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
  });

  it('coerces string limit to number via @Type(() => Number)', async () => {
    const dto = plainToClass(CursorPaginationDto, { limit: '50' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
  });
});
