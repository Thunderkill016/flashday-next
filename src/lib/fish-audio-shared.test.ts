import { describe, expect, it } from 'vitest';
import { resolveTTSSource } from '@/lib/fish-audio-shared';

describe('resolveTTSSource', () => {
  it('keeps Google selected when API key and voice are configured', () => {
    expect(
      resolveTTSSource({
        requestedSource: 'google',
        hasFishCredentials: false,
        hasFishVoice: false,
        hasGoogleCredentials: true,
        hasGoogleVoice: true,
      }),
    ).toEqual({
      source: 'google',
    });
  });

  it('falls back to browser when Google API key is missing', () => {
    expect(
      resolveTTSSource({
        requestedSource: 'google',
        hasFishCredentials: false,
        hasFishVoice: false,
        hasGoogleCredentials: false,
        hasGoogleVoice: true,
      }),
    ).toEqual({
      source: 'browser',
      reason: 'Google Cloud TTS is selected but no API key is configured.',
    });
  });

  it('falls back to browser when Google voice is missing', () => {
    expect(
      resolveTTSSource({
        requestedSource: 'google',
        hasFishCredentials: false,
        hasFishVoice: false,
        hasGoogleCredentials: true,
        hasGoogleVoice: false,
      }),
    ).toEqual({
      source: 'browser',
      reason: 'Google Cloud TTS is selected but no voice is chosen yet.',
    });
  });

  it('keeps OpenAI selected when API key and voice are configured', () => {
    expect(
      resolveTTSSource({
        requestedSource: 'openai',
        hasFishCredentials: false,
        hasFishVoice: false,
        hasOpenAICredentials: true,
        hasOpenAIVoice: true,
      }),
    ).toEqual({
      source: 'openai',
    });
  });

  it('falls back to browser when OpenAI API key is missing', () => {
    expect(
      resolveTTSSource({
        requestedSource: 'openai',
        hasFishCredentials: false,
        hasFishVoice: false,
        hasOpenAICredentials: false,
        hasOpenAIVoice: true,
      }),
    ).toEqual({
      source: 'browser',
      reason: 'OpenAI TTS is selected but no API key is configured.',
    });
  });
});
