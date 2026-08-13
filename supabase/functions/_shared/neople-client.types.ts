export type FetchImpl = typeof fetch;

export interface NeopleClientInput {
  apiKey: string;
  itemId: string;
  fetchImpl?: FetchImpl;
}

export interface CompletedTrade {
  soldAt: string;
  itemId: string;
  unitPrice: number;
  quantity: number;
}

export interface AuctionListing {
  itemId: string;
  unitPrice: number;
}

export type SoldResult = CompletedTrade;
export type ListingResult = AuctionListing;

export interface NeopleRequest {
  url: URL;
  init: RequestInit;
}

export type NeopleRequestBuilder = (input: NeopleClientInput) => NeopleRequest;
export type NeopleTransport = (fetchImpl: FetchImpl, request: NeopleRequest) => Promise<Response>;
export type NeopleAttempt<T> = () => Promise<T>;
export type NeopleRetry = <T>(attempt: NeopleAttempt<T>) => Promise<T>;

export interface NeopleEnvelope {
  rows: unknown[];
}

export type NeopleEnvelopeParser = (payload: unknown, maxRows: number) => NeopleEnvelope;
export type SoldParser = (rows: readonly unknown[], itemId: string) => CompletedTrade[];
export type ListingParser = (rows: readonly unknown[], itemId: string) => AuctionListing[];

export type FetchCompletedTrades = (input: NeopleClientInput) => Promise<CompletedTrade[]>;
export type FetchAuctionListings = (input: NeopleClientInput) => Promise<AuctionListing[]>;

export interface NeopleClient {
  fetchCompletedTrades: FetchCompletedTrades;
  fetchAuctionListings: FetchAuctionListings;
}

export const NEOPLE_CLIENT_ERROR_CODE = {
  INVALID_API_KEY: 'invalid_api_key',
  INVALID_ITEM_ID: 'invalid_item_id',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  RATE_LIMIT: 'rate_limit',
  UPSTREAM_HTTP: 'upstream_http',
  NON_RETRYABLE_HTTP: 'non_retryable_http',
  INVALID_JSON: 'invalid_json',
  INVALID_RESPONSE: 'invalid_response',
} as const;

export type NeopleClientErrorCode =
  (typeof NEOPLE_CLIENT_ERROR_CODE)[keyof typeof NEOPLE_CLIENT_ERROR_CODE];

export class NeopleClientError extends Error {
  readonly code: NeopleClientErrorCode;

  constructor(code: NeopleClientErrorCode, message = code, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NeopleClientError';
    this.code = code;
  }
}
