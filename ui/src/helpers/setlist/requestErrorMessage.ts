import { isAxiosError } from 'axios';

export const PERMISSION_DENIED_MESSAGE = "You don't have permission to do that.";

export const requestErrorMessage = (error: unknown, fallback: string): string =>
  isAxiosError(error) && error.response?.status === 403 ? PERMISSION_DENIED_MESSAGE : fallback;
