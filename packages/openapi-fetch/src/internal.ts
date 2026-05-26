export type HttpMethod =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";

export type OkStatus = 200 | 201 | 202 | 203 | 204 | 206 | 207 | "2XX";

export type ErrorStatus =
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511
  | "5XX"
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 420
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 427
  | 428
  | 429
  | 430
  | 431
  | 444
  | 450
  | 451
  | 497
  | 498
  | 499
  | "4XX"
  | "default";

export type OpenApiStatusToHttpStatus<Status, AllStatuses> =
  Status extends number
    ? Status
    : Status extends "default"
      ? Exclude<Exclude<OkStatus | ErrorStatus, string>, AllStatuses>
      : Status extends "2XX"
        ? Exclude<OkStatus, string>
        : Status extends "4XX" | "5XX"
          ? Exclude<ErrorStatus, string>
          : never;

export type PathsWithMethod<
  Paths extends {},
  PathnameMethod extends HttpMethod,
> = {
  [Pathname in keyof Paths]: Paths[Pathname] extends {
    [K in PathnameMethod]: any;
  }
    ? Pathname
    : never;
}[keyof Paths];

export type ResponseObjectMap<T> = T extends { responses: any }
  ? T["responses"]
  : unknown;

export type MediaType = `${string}/${string}`;

export type FilterKeys<Obj, Matchers> = Obj[keyof Obj & Matchers];

type RequiredKeysOfHelper<T> = {
  [K in keyof T]: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type RequiredKeysOf<T> = RequiredKeysOfHelper<T> extends undefined
  ? never
  : RequiredKeysOfHelper<T>;

export type GetResponseContent<
  T extends Record<string | number, any>,
  Media extends MediaType = MediaType,
  ResponseCode extends keyof T = keyof T,
> = {
  [K in ResponseCode]: T[K]["content"] extends Record<string, any>
    ? FilterKeys<T[K]["content"], Media> extends never
      ? T[K]["content"]
      : FilterKeys<T[K]["content"], Media>
    : K extends keyof T
      ? T[K]["content"]
      : never;
}[ResponseCode];

type $Read<T> = { readonly $read: T };

type $Write<T> = { readonly $write: T };

export type Writable<T> = T extends $Read<any>
  ? never
  : T extends $Write<infer U>
    ? Writable<U>
    : T extends (infer E)[]
      ? Writable<E>[]
      : T extends object
        ? {
            [K in keyof T as NonNullable<T[K]> extends $Read<any>
              ? never
              : K]: Writable<T[K]>;
          } & {
            [K in keyof T as NonNullable<T[K]> extends $Read<any>
              ? K
              : never]?: never;
          }
        : T;

export type OperationRequestBody<T> = "requestBody" extends keyof T
  ? T["requestBody"]
  : never;

type PickRequestBody<T> = "requestBody" extends keyof T
  ? Pick<T, "requestBody">
  : never;

export type IsOperationRequestBodyOptional<T> = RequiredKeysOf<
  PickRequestBody<T>
> extends never
  ? true
  : false;

export type ResponseContent<T> = T extends { content: any }
  ? T["content"]
  : unknown;

type OperationRequestBodyMediaContent<T> =
  IsOperationRequestBodyOptional<T> extends true
    ? ResponseContent<NonNullable<OperationRequestBody<T>>> | undefined
    : ResponseContent<OperationRequestBody<T>>;

export type OperationRequestBodyContent<T> = FilterKeys<
  OperationRequestBodyMediaContent<T>,
  MediaType
> extends never
  ?
      | FilterKeys<NonNullable<OperationRequestBodyMediaContent<T>>, MediaType>
      | undefined
  : FilterKeys<OperationRequestBodyMediaContent<T>, MediaType>;
