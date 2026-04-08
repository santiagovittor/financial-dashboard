export interface ApiResponse<T> {
  data: T;
  ok: true;
}

export interface ApiError {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
