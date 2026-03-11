import { describe, expect, it } from 'vitest';
import { filterReferenceSettingsByMode } from './referenceImageFiltering';

describe('referenceImageFiltering', () => {
  it('passes settings through unchanged for undefined and custom modes', () => {
    const settings = {
      style_reference_strength: 0.7,
      subject_strength: 0.9,
      subject_description: 'hero character',
      in_this_scene: true,
      in_this_scene_strength: 0.4,
    };

    expect(filterReferenceSettingsByMode(undefined, settings)).toBe(settings);
    expect(filterReferenceSettingsByMode('custom', settings)).toBe(settings);
  });

  it('keeps only style strength in style mode', () => {
    expect(filterReferenceSettingsByMode('style', {
      style_reference_strength: 0.8,
      subject_strength: 0.6,
      subject_description: 'should be removed',
    })).toEqual({
      style_reference_strength: 0.8,
    });
  });

  it('normalizes subject mode to fixed strengths and only keeps non-blank descriptions', () => {
    expect(filterReferenceSettingsByMode('subject', {
      style_reference_strength: 0.2,
      subject_strength: 0.9,
      subject_description: 'lead actor',
      in_this_scene: true,
    })).toEqual({
      style_reference_strength: 1.1,
      subject_strength: 0.5,
      subject_description: 'lead actor',
    });

    expect(filterReferenceSettingsByMode('subject', {
      subject_description: '   ',
    })).toEqual({
      style_reference_strength: 1.1,
      subject_strength: 0.5,
    });
  });

  it('keeps the relevant mixed fields for style-character mode', () => {
    expect(filterReferenceSettingsByMode('style-character', {
      style_reference_strength: 0.8,
      subject_strength: 0.6,
      subject_description: 'hero character',
      in_this_scene: true,
    })).toEqual({
      style_reference_strength: 0.8,
      subject_strength: 0.6,
      subject_description: 'hero character',
    });
  });

  it('forces scene mode to the in-scene defaults', () => {
    expect(filterReferenceSettingsByMode('scene', {
      style_reference_strength: 0.8,
      subject_strength: 0.6,
      in_this_scene: false,
      in_this_scene_strength: 0.2,
    })).toEqual({
      style_reference_strength: 1.1,
      in_this_scene: true,
      in_this_scene_strength: 0.5,
    });
  });
});
