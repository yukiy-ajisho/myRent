/**
 * Type guard and utility functions for handling API errors
 * that have the structure: { response: { data: { error: string } } }
 */

export interface AxiosErrorResponse {
  response: {
    data: {
      error: string;
    };
  };
}

export interface ErrorWithMessage {
  message: string;
}

/**
 * Type guard to check if error has the Axios-style response.data.error structure
 */
export function isAxiosError(error: unknown): error is AxiosErrorResponse {
  return (
    error !== null &&
    typeof error === "object" &&
    "response" in error &&
    error.response !== null &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data !== null &&
    typeof error.response.data === "object" &&
    "error" in error.response.data &&
    typeof (error.response.data as { error: unknown }).error === "string"
  );
}

/**
 * Type guard to check if error has a message property
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

/**
 * Extract error message from various error types
 * Returns a default message if error structure is unknown
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage = "An error occurred"
): string {
  if (isAxiosError(error)) {
    return error.response.data.error;
  }

  if (isErrorWithMessage(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return defaultMessage;
}
