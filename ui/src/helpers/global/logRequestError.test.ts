import { AxiosError, AxiosHeaders } from 'axios';
import { logRequestError } from './logRequestError';

// CRA's Jest does not transform node_modules, so load axios's CommonJS build.
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));

describe('logRequestError', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  const buildAxiosError = (status?: number, code?: string) => {
    const config = { headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }) };
    const response = status ? { status, statusText: '', data: {}, headers: {}, config } : undefined;
    return new AxiosError('Request failed', code, config, undefined, response);
  };

  it('logs the response status of an axios error', () => {
    logRequestError('Error fetching setlist:', buildAxiosError(404, 'ERR_BAD_REQUEST'));
    expect(consoleError).toHaveBeenCalledWith('Error fetching setlist:', 404);
  });

  it('falls back to the axios error code when there is no response', () => {
    logRequestError('Error fetching setlist:', buildAxiosError(undefined, 'ERR_NETWORK'));
    expect(consoleError).toHaveBeenCalledWith('Error fetching setlist:', 'ERR_NETWORK');
  });

  it('never logs the request headers of an axios error', () => {
    logRequestError('Error fetching setlist:', buildAxiosError(500));
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-token');
  });

  it('logs the message of a plain error', () => {
    logRequestError('Error saving folder:', new Error('boom'));
    expect(consoleError).toHaveBeenCalledWith('Error saving folder:', 'boom');
  });

  it('stringifies a non-error value', () => {
    logRequestError('Error saving folder:', 'offline');
    expect(consoleError).toHaveBeenCalledWith('Error saving folder:', 'offline');
  });
});
