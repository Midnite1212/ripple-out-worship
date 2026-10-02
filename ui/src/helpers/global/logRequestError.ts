import type { AxiosError } from 'axios';

// Mirrors axios.isAxiosError without a runtime axios import, which CRA's Jest cannot load.
const isAxiosError = (error: unknown): error is AxiosError =>
  typeof error === 'object' &&
  error !== null &&
  'isAxiosError' in error &&
  error.isAxiosError === true;

const describeError = (error: unknown) => {
  if (isAxiosError(error)) return error.response?.status ?? error.code;
  if (error instanceof Error) return error.message;
  return String(error);
};

export const logRequestError = (context: string, error: unknown) => {
  console.error(context, describeError(error));
};
