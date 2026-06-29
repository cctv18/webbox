export type ApiErrorCode =
  | "PATH_NOT_FOUND"
  | "PATH_OUTSIDE_ROOT"
  | "DUPLICATE_NAME"
  | "INVALID_INPUT"
  | "UNSUPPORTED_OPERATION"
  | "PLUGIN_INCOMPATIBLE"
  | "ARCHIVE_FAILED"
  | "FILESYSTEM_DENIED";

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function fail(code: ApiErrorCode, message: string): ApiResponse<never> {
  return { ok: false, error: { code, message } };
}
