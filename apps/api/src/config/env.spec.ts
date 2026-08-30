import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

describe('parseEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(parseEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('coerces PORT to a number, since process.env is always strings', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a PORT that is not a number', () => {
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('names every invalid variable at once, not just the first', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging', PORT: 'nope' })).toThrow(
      /NODE_ENV[\s\S]*PORT|PORT[\s\S]*NODE_ENV/,
    );
  });
});
