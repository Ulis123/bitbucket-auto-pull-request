export enum AuthTypes {
  TOKEN = "token",
  BASIC = "basic",
}

export interface HTTPError {
  error: {
    error: {
      message: string;
      code: string;
      data: Record<string, unknown>;
    };
  };
}
