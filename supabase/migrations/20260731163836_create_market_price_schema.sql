create table public.market_items (
  item_id text primary key,
  item_name text not null,
  variant_level smallint not null unique,
  is_enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint market_items_item_id_format_check
    check (item_id ~ '^[0-9a-f]{32}$'),
  constraint market_items_item_name_check
    check (length(btrim(item_name)) > 0),
  constraint market_items_variant_level_check
    check (variant_level between 1 and 15)
);

comment on table public.market_items is
  '수집 대상 골고라이언 아이템과 +1부터 +15까지의 확장 가능한 변형 정보';
comment on column public.market_items.item_id is '네오플 API itemId';
comment on column public.market_items.variant_level is '골고라이언 증폭권의 +1부터 +15까지 단계';

create table public.market_collection_runs (
  id bigint generated always as identity primary key,
  item_id text not null references public.market_items (item_id),
  collection_type text not null,
  status text not null default 'running',
  continuity_status text not null default 'not-checked',
  requested_row_limit smallint not null,
  fetched_row_count smallint not null default 0,
  oldest_sold_at timestamptz,
  newest_sold_at timestamptz,
  failure_code text,
  started_at timestamptz not null default statement_timestamp(),
  finished_at timestamptz,
  constraint market_collection_runs_trade_source_key
    unique (id, item_id, collection_type, status),
  constraint market_collection_runs_fetched_row_count_key
    unique (id, fetched_row_count),
  constraint market_collection_runs_collection_type_check
    check (collection_type in ('trade-history', 'auction-listings')),
  constraint market_collection_runs_status_check
    check (status in ('running', 'succeeded', 'failed')),
  constraint market_collection_runs_continuity_status_check
    check (continuity_status in ('not-checked', 'continuous', 'broken')),
  constraint market_collection_runs_requested_row_limit_check
    check (
      (collection_type = 'trade-history' and requested_row_limit between 1 and 100)
      or
      (collection_type = 'auction-listings' and requested_row_limit between 1 and 400)
    ),
  constraint market_collection_runs_fetched_row_count_check
    check (fetched_row_count between 0 and requested_row_limit),
  constraint market_collection_runs_failure_code_check
    check (
      failure_code is null
      or failure_code ~ '^[a-z][a-z0-9_]{0,63}$'
    ),
  constraint market_collection_runs_sold_at_range_check
    check (
      (oldest_sold_at is null and newest_sold_at is null)
      or
      (oldest_sold_at is not null and newest_sold_at is not null and oldest_sold_at <= newest_sold_at)
    ),
  constraint market_collection_runs_listing_boundary_check
    check (
      collection_type = 'trade-history'
      or (
        continuity_status = 'not-checked'
        and oldest_sold_at is null
        and newest_sold_at is null
      )
    ),
  constraint market_collection_runs_continuity_lifecycle_check
    check (
      continuity_status = 'not-checked'
      or (collection_type = 'trade-history' and status = 'succeeded')
    ),
  constraint market_collection_runs_trade_response_check
    check (
      collection_type <> 'trade-history'
      or status <> 'succeeded'
      or (
        fetched_row_count = 0
        and oldest_sold_at is null
        and newest_sold_at is null
      )
      or (
        fetched_row_count > 0
        and oldest_sold_at is not null
        and newest_sold_at is not null
      )
    ),
  constraint market_collection_runs_lifecycle_check
    check (
      (status = 'running' and finished_at is null and failure_code is null)
      or
      (status = 'succeeded' and finished_at is not null and failure_code is null)
      or
      (
        status = 'failed'
        and finished_at is not null
        and failure_code is not null
        and length(btrim(failure_code)) > 0
      )
    ),
  constraint market_collection_runs_finished_at_check
    check (finished_at is null or finished_at >= started_at)
);

comment on table public.market_collection_runs is
  '무거래 성공과 수집 실패를 구분하고 체결 연속성 판정 근거를 보존하는 실행 이력';
comment on column public.market_collection_runs.failure_code is
  '소문자 영문으로 시작하고 소문자·숫자·밑줄만 사용하는 최대 64자의 내부 오류 코드';
comment on column public.market_collection_runs.oldest_sold_at is
  '체결 응답에서 가장 오래된 시각이며 등록 매물 수집에는 사용하지 않음';
comment on column public.market_collection_runs.newest_sold_at is
  '체결 응답에서 가장 최신 시각이며 등록 매물 수집에는 사용하지 않음';

create index market_collection_runs_item_type_started_at_idx
  on public.market_collection_runs (item_id, collection_type, started_at desc);

create table public.market_trades (
  id bigint generated always as identity primary key,
  item_id text not null references public.market_items (item_id),
  sold_at timestamptz not null,
  unit_price bigint not null,
  quantity integer not null,
  total_price bigint not null,
  fingerprint text not null,
  occurrence_count smallint not null,
  first_seen_collection_id bigint not null,
  last_seen_collection_id bigint not null,
  source_collection_type text generated always as ('trade-history') stored,
  source_collection_status text generated always as ('succeeded') stored,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint market_trades_id_item_key unique (id, item_id),
  constraint market_trades_fingerprint_key unique (fingerprint),
  constraint market_trades_source_key
    unique (item_id, sold_at, unit_price, quantity),
  constraint market_trades_first_seen_collection_fk
    foreign key (
      first_seen_collection_id,
      item_id,
      source_collection_type,
      source_collection_status
    )
    references public.market_collection_runs (id, item_id, collection_type, status)
    deferrable initially immediate,
  constraint market_trades_last_seen_collection_fk
    foreign key (
      last_seen_collection_id,
      item_id,
      source_collection_type,
      source_collection_status
    )
    references public.market_collection_runs (id, item_id, collection_type, status)
    deferrable initially immediate,
  constraint market_trades_unit_price_check
    check (unit_price > 0),
  constraint market_trades_quantity_check
    check (quantity > 0),
  constraint market_trades_total_price_check
    check (total_price > 0 and total_price = unit_price * quantity),
  constraint market_trades_fingerprint_check
    check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint market_trades_occurrence_count_check
    check (occurrence_count between 1 and 100)
);

comment on table public.market_trades is
  '90일 보존 대상인 원시 체결. 동일 fingerprint의 실제 복수 거래는 occurrence_count로 보존';
comment on column public.market_trades.sold_at is
  '네오플 soldDate를 Asia/Seoul로 해석한 절대 시각';
comment on column public.market_trades.fingerprint is
  'soldDate, itemId, unitPrice, count의 정규화 값으로 계산한 소문자 SHA-256';
comment on column public.market_trades.occurrence_count is
  '동일 API 응답 안에서 같은 fingerprint가 나타난 횟수';
comment on column public.market_trades.last_seen_collection_id is
  '직전 성공 응답의 multiset을 다음 실행에서 복원하기 위한 마지막 관측 실행';

create index market_trades_item_sold_at_idx
  on public.market_trades (item_id, sold_at desc);
create index market_trades_sold_at_idx
  on public.market_trades (sold_at);
create index market_trades_first_seen_collection_id_idx
  on public.market_trades (first_seen_collection_id);
create index market_trades_last_seen_collection_id_idx
  on public.market_trades (last_seen_collection_id);

create table public.market_daily_candles (
  item_id text not null references public.market_items (item_id),
  market_date date not null,
  open_price bigint,
  high_price bigint,
  low_price bigint,
  close_price bigint,
  trade_count integer not null default 0,
  volume bigint not null default 0,
  status text not null,
  calculated_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (item_id, market_date),
  constraint market_daily_candles_status_check
    check (status in ('pending', 'recovering', 'complete', 'incomplete')),
  constraint market_daily_candles_trade_count_check
    check (trade_count >= 0),
  constraint market_daily_candles_volume_check
    check (volume >= 0),
  constraint market_daily_candles_values_check
    check (
      (
        trade_count = 0
        and volume = 0
        and open_price is null
        and high_price is null
        and low_price is null
        and close_price is null
      )
      or
      (
        trade_count > 0
        and volume >= trade_count
        and open_price is not null
        and high_price is not null
        and low_price is not null
        and close_price is not null
        and open_price > 0
        and high_price > 0
        and low_price > 0
        and close_price > 0
        and high_price >= open_price
        and high_price >= close_price
        and low_price <= open_price
        and low_price <= close_price
        and low_price <= high_price
      )
    )
);

comment on table public.market_daily_candles is
  'Asia/Seoul 날짜 기준 OHLC, 거래 건수, 거래량과 수집 상태';
comment on column public.market_daily_candles.market_date is 'Asia/Seoul 기준 경매장 날짜';
comment on column public.market_daily_candles.trade_count is
  '원시 체결 occurrence_count의 합';
comment on column public.market_daily_candles.volume is
  '원시 체결 quantity와 occurrence_count 곱의 합';
comment on constraint market_daily_candles_values_check on public.market_daily_candles is
  '확인된 무거래일은 0건, 0수량, NULL OHLC로 저장하고 이전 종가를 채우지 않음';

create table public.market_current_prices (
  item_id text primary key references public.market_items (item_id),
  price bigint,
  status text not null,
  listing_count smallint not null,
  unique_unit_price_count smallint not null,
  candidate_price_count smallint not null,
  representative_price_count smallint not null,
  source_collection_id bigint not null,
  source_collection_type text generated always as ('auction-listings') stored,
  source_collection_status text generated always as ('succeeded') stored,
  calculated_at timestamptz not null,
  updated_at timestamptz not null default statement_timestamp(),
  constraint market_current_prices_status_check
    check (status in ('available', 'no-listings')),
  constraint market_current_prices_source_collection_fk
    foreign key (
      source_collection_id,
      item_id,
      source_collection_type,
      source_collection_status
    )
    references public.market_collection_runs (id, item_id, collection_type, status)
    deferrable initially immediate,
  constraint market_current_prices_source_row_count_fk
    foreign key (source_collection_id, listing_count)
    references public.market_collection_runs (id, fetched_row_count)
    deferrable initially immediate,
  constraint market_current_prices_counts_check
    check (
      listing_count >= 0
      and unique_unit_price_count >= 0
      and candidate_price_count between 0 and 5
      and representative_price_count between 0 and candidate_price_count
    ),
  constraint market_current_prices_values_check
    check (
      (
        status = 'no-listings'
        and price is null
        and listing_count = 0
        and unique_unit_price_count = 0
        and candidate_price_count = 0
        and representative_price_count = 0
      )
      or
      (
        status = 'available'
        and price is not null
        and price > 0
        and listing_count >= unique_unit_price_count
        and unique_unit_price_count >= candidate_price_count
        and candidate_price_count = least(5, unique_unit_price_count)
        and representative_price_count between 1 and candidate_price_count
      )
    )
);

comment on table public.market_current_prices is
  '1시간마다 교체되는 아이템별 최신 현재가와 계산 근거 수량';
comment on column public.market_current_prices.candidate_price_count is
  '최저 5개 고유 단가 중 실제 계산 후보로 사용한 수';
comment on column public.market_current_prices.representative_price_count is
  '후보 중앙값의 10% 이내에 있어 산술 평균에 포함한 고유 단가 수';

create function public.set_market_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger set_market_items_updated_at
before update on public.market_items
for each row execute function public.set_market_updated_at();

create trigger set_market_trades_updated_at
before update on public.market_trades
for each row execute function public.set_market_updated_at();

create trigger set_market_daily_candles_updated_at
before update on public.market_daily_candles
for each row execute function public.set_market_updated_at();

create trigger set_market_current_prices_updated_at
before update on public.market_current_prices
for each row execute function public.set_market_updated_at();

alter table public.market_items enable row level security;
alter table public.market_collection_runs enable row level security;
alter table public.market_trades enable row level security;
alter table public.market_daily_candles enable row level security;
alter table public.market_current_prices enable row level security;

revoke all on table
  public.market_items,
  public.market_collection_runs,
  public.market_trades,
  public.market_daily_candles,
  public.market_current_prices
from public, anon, authenticated;

revoke all on sequence
  public.market_collection_runs_id_seq,
  public.market_trades_id_seq
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.market_items,
  public.market_collection_runs,
  public.market_trades,
  public.market_daily_candles,
  public.market_current_prices
to service_role;

grant usage, select on sequence
  public.market_collection_runs_id_seq,
  public.market_trades_id_seq
to service_role;

revoke all on function public.set_market_updated_at() from public, anon, authenticated;
grant execute on function public.set_market_updated_at() to service_role;

insert into public.market_items (item_id, item_name, variant_level)
values (
  '4a737b2ae337a57260ca4663ce6a9bb0',
  '+10 장비 증폭권[골고라이언]',
  10
);
