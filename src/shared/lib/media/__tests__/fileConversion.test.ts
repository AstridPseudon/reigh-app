import { describe, it, expect } from 'vitest';
import { dataURLtoFile } from '../fileConversion';

describe('dataURLtoFile', () => {
  it('converts a valid data URL to a File', () => {
    const dataUrl = 'data:text/plain;base64,SGVsbG8=';
    const result = dataURLtoFile(dataUrl, 'test.txt');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }
    expect(result.value).toBeInstanceOf(File);
    expect(result.value.name).toBe('test.txt');
    expect(result.value.type).toBe('text/plain');
  });

  it('uses custom MIME type when provided', () => {
    const dataUrl = 'data:text/plain;base64,SGVsbG8=';
    const result = dataURLtoFile(dataUrl, 'test.bin', 'application/octet-stream');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }
    expect(result.value.type).toBe('application/octet-stream');
  });

  it('returns a structured failure for invalid data URL', () => {
    const result = dataURLtoFile('not-a-data-url', 'test.txt');
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure');
    }
    expect(result.errorCode).toBe('data_url_file_conversion_failed');
    expect(result.error.message).toBe('Invalid Data URL format');
  });

  it('falls back to application/octet-stream when MIME not in URL', () => {
    const dataUrl = 'data:;base64,SGVsbG8=';
    const result = dataURLtoFile(dataUrl, 'test.bin');
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success');
    }
    expect(result.value).toBeInstanceOf(File);
    expect(result.value.type).toBe('application/octet-stream');
  });
});
