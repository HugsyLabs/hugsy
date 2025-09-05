import { describe, it, expect } from 'vitest';
import { cn } from '../src/utils/cn';

describe('cn utility', () => {
  it('should merge class names', () => {
    const result = cn('base-class', 'additional-class');
    expect(result).toBe('base-class additional-class');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', {
      active: true,
      disabled: false,
    });
    expect(result).toBe('base active');
  });

  it('should handle arrays', () => {
    const result = cn(['base', 'secondary'], 'additional');
    expect(result).toBe('base secondary additional');
  });

  it('should filter falsy values', () => {
    const result = cn('base', null, undefined, false, '', 'valid');
    expect(result).toBe('base valid');
  });

  it('should handle tailwind-merge conflicts', () => {
    const result = cn('p-4', 'p-8');
    expect(result).toBe('p-8');
  });
});
