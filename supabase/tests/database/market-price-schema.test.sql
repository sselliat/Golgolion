begin;

select plan(31);

select has_table('public', 'market_items', '수집 대상 아이템 테이블이 존재한다');
select has_table('public', 'market_collection_runs', '수집 실행 이력 테이블이 존재한다');
select has_table('public', 'market_trades', '원시 체결 테이블이 존재한다');
select has_table('public', 'market_daily_candles', '일봉 테이블이 존재한다');
select has_table('public', 'market_current_prices', '최신 현재가 테이블이 존재한다');

select ok(
  to_regclass('public.market_trades_first_seen_collection_id_idx') is not null,
  '최초 관측 수집 실행 외래 키에 인덱스가 존재한다'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'public.market_items'::regclass,
      'public.market_collection_runs'::regclass,
      'public.market_trades'::regclass,
      'public.market_daily_candles'::regclass,
      'public.market_current_prices'::regclass
    )
  ),
  '모든 공개 스키마 테이블에 RLS가 활성화된다'
);

select is(
  (
    select count(*)::integer
    from public.market_items
    where item_id = '4a737b2ae337a57260ca4663ce6a9bb0'
      and variant_level = 10
      and is_enabled
  ),
  1,
  'MVP +10 아이템이 마이그레이션에 포함된다'
);

select ok(
  not has_table_privilege('anon', 'public.market_items', 'select')
    and not has_table_privilege('anon', 'public.market_trades', 'insert'),
  '익명 역할은 내부 시세 테이블에 접근할 수 없다'
);

select ok(
  not has_table_privilege('authenticated', 'public.market_daily_candles', 'select')
    and not has_table_privilege('authenticated', 'public.market_current_prices', 'update'),
  '인증 역할은 내부 시세 테이블에 접근할 수 없다'
);

select ok(
  has_table_privilege('service_role', 'public.market_collection_runs', 'insert')
    and has_table_privilege('service_role', 'public.market_trades', 'update')
    and has_table_privilege('service_role', 'public.market_daily_candles', 'delete')
    and has_table_privilege('service_role', 'public.market_current_prices', 'select'),
  '서비스 역할은 수집과 집계에 필요한 권한을 가진다'
);

select lives_ok(
  $$
    insert into public.market_items (item_id, item_name, variant_level)
    values ('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '+11 장비 증폭권[골고라이언]', 11)
  $$,
  '+1부터 +15까지 다른 골고라이언 변형을 추가할 수 있다'
);

select is(
  (
    select is_enabled
    from public.market_items
    where item_id = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  ),
  false,
  '새로 등록한 변형은 검증 후 활성화할 때까지 수집하지 않는다'
);

select throws_ok(
  $$
    insert into public.market_items (item_id, item_name, variant_level)
    values ('cccccccccccccccccccccccccccccccc', '잘못된 변형', 16)
  $$,
  '23514',
  null,
  '+15를 넘는 변형은 거부한다'
);

select lives_ok(
  $$
    insert into public.market_collection_runs (
      item_id,
      collection_type,
      status,
      requested_row_limit,
      fetched_row_count,
      finished_at
    )
    values (
      '4a737b2ae337a57260ca4663ce6a9bb0',
      'trade-history',
      'succeeded',
      100,
      0,
      statement_timestamp()
    )
  $$,
  '0건 수집 성공은 실패와 구분해 저장할 수 있다'
);

select throws_ok(
  $$
    insert into public.market_collection_runs (
      item_id,
      collection_type,
      status,
      requested_row_limit
    )
    values (
      '4a737b2ae337a57260ca4663ce6a9bb0',
      'trade-history',
      'succeeded',
      100
    )
  $$,
  '23514',
  null,
  '종료 시각 없는 성공 실행은 거부한다'
);

select throws_ok(
  $$
    insert into public.market_collection_runs (
      item_id,
      collection_type,
      status,
      requested_row_limit,
      failure_code,
      finished_at
    )
    values (
      '4a737b2ae337a57260ca4663ce6a9bb0',
      'trade-history',
      'failed',
      100,
      '{"payload":"' || repeat('x', 80) || '"}',
      statement_timestamp()
    )
  $$,
  '23514',
  null,
  '외부 응답 payload 형태의 실패 코드는 거부한다'
);

insert into public.market_collection_runs (
  item_id,
  collection_type,
  status,
  requested_row_limit,
  fetched_row_count,
  oldest_sold_at,
  newest_sold_at,
  finished_at
)
values (
  '4a737b2ae337a57260ca4663ce6a9bb0',
  'trade-history',
  'succeeded',
  100,
  2::smallint,
  '2026-07-30 13:50:19+00',
  '2026-07-30 13:50:19+00',
  statement_timestamp()
);

select lives_ok(
  format(
    $$
      insert into public.market_trades (
        item_id,
        sold_at,
        unit_price,
        quantity,
        fingerprint,
        occurrence_count,
        first_seen_collection_id,
        last_seen_collection_id
      )
      values (
        '4a737b2ae337a57260ca4663ce6a9bb0',
        '2026-07-30 13:50:19+00',
        54400000,
        1,
        repeat('a', 64),
        1,
        %s,
        %s
      )
    $$,
    currval('public.market_collection_runs_id_seq'),
    currval('public.market_collection_runs_id_seq')
  ),
  '첫 번째 fingerprint 발생을 저장할 수 있다'
);

select lives_ok(
  $$
    update public.market_trades
    set occurrence_count = 2
    where fingerprint = repeat('a', 64)
  $$,
  '같은 fingerprint의 실제 발생 횟수를 늘려 보존한다'
);

select throws_ok(
  format(
    $$
      insert into public.market_trades (
        item_id,
        sold_at,
        unit_price,
        quantity,
        fingerprint,
        occurrence_count,
        first_seen_collection_id,
        last_seen_collection_id
      )
      values (
        '4a737b2ae337a57260ca4663ce6a9bb0',
        '2026-07-30 13:50:19+00',
        54400000,
        1,
        repeat('a', 64),
        1,
        %s,
        %s
      )
    $$,
    currval('public.market_collection_runs_id_seq'),
    currval('public.market_collection_runs_id_seq')
  ),
  '23505',
  null,
  '같은 fingerprint의 재수집은 중복 저장하지 않는다'
);

insert into public.market_collection_runs (
  item_id,
  collection_type,
  status,
  requested_row_limit,
  fetched_row_count,
  finished_at
)
values (
  '4a737b2ae337a57260ca4663ce6a9bb0',
  'auction-listings',
  'succeeded',
  400,
  0,
  statement_timestamp()
);

select lives_ok(
  $$
    insert into public.market_daily_candles (
      item_id,
      market_date,
      status
    )
    values (
      '4a737b2ae337a57260ca4663ce6a9bb0',
      '2026-07-29',
      'complete'
    )
  $$,
  '무거래일은 이전 종가 없이 NULL OHLC로 저장할 수 있다'
);

select lives_ok(
  $$
    insert into public.market_daily_candles (
      item_id,
      market_date,
      open_price,
      high_price,
      low_price,
      close_price,
      trade_count,
      volume,
      status
    )
    values (
      '4a737b2ae337a57260ca4663ce6a9bb0',
      '2026-07-30',
      54000000,
      55000000,
      53000000,
      54500000,
      3,
      5,
      'pending'
    )
  $$,
  'OHLC와 거래 건수 및 아이템 수량 합을 저장할 수 있다'
);

select throws_ok(
  $$
    insert into public.market_daily_candles (
      item_id,
      market_date,
      open_price,
      trade_count,
      volume,
      status
    )
    values (
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '2026-07-30',
      54000000,
      1,
      1,
      'complete'
    )
  $$,
  '23514',
  null,
  '일부만 있는 OHLC는 거부한다'
);

select lives_ok(
  $$
    insert into public.market_current_prices (
      item_id,
      status,
      listing_count,
      unique_unit_price_count,
      candidate_price_count,
      representative_price_count,
      source_collection_id,
      calculated_at
    )
    values (
      '4a737b2ae337a57260ca4663ce6a9bb0',
      'no-listings',
      0,
      0,
      0,
      0,
      (
        select id
        from public.market_collection_runs
        where collection_type = 'auction-listings'
          and status = 'succeeded'
          and fetched_row_count = 0
      ),
      statement_timestamp()
    )
  $$,
  '매물이 없으면 가격 없이 no-listings 상태를 저장한다'
);

insert into public.market_collection_runs (
  item_id,
  collection_type,
  status,
  requested_row_limit,
  fetched_row_count,
  finished_at
)
values (
  '4a737b2ae337a57260ca4663ce6a9bb0',
  'auction-listings',
  'succeeded',
  400,
  8,
  statement_timestamp()
);

select lives_ok(
  $$
    update public.market_current_prices
    set
      price = 54400000,
      status = 'available',
      listing_count = 8,
      unique_unit_price_count = 6,
      candidate_price_count = 5,
      representative_price_count = 4,
      source_collection_id = (
        select id
        from public.market_collection_runs
        where collection_type = 'auction-listings'
          and status = 'succeeded'
          and fetched_row_count = 8
      ),
      calculated_at = statement_timestamp()
    where item_id = '4a737b2ae337a57260ca4663ce6a9bb0'
  $$,
  '최저 5개 고유 단가 기반 현재가 계산 결과를 저장한다'
);

insert into public.market_collection_runs (
  item_id,
  collection_type,
  status,
  requested_row_limit,
  fetched_row_count,
  finished_at
)
values (
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'auction-listings',
  'succeeded',
  400,
  0,
  statement_timestamp()
);

select throws_ok(
  $$
    insert into public.market_current_prices (
      item_id,
      price,
      status,
      listing_count,
      unique_unit_price_count,
      candidate_price_count,
      representative_price_count,
      source_collection_id,
      calculated_at
    )
    values (
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      123,
      'no-listings',
      0,
      0,
      0,
      0,
      (
        select id
        from public.market_collection_runs
        where item_id = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
          and collection_type = 'auction-listings'
          and status = 'succeeded'
          and fetched_row_count = 0
      ),
      statement_timestamp()
    )
  $$,
  '23514',
  null,
  'no-listings 상태에 이전 가격을 남길 수 없다'
);

select is(
  (
    select open_price
    from public.market_daily_candles
    where item_id = '4a737b2ae337a57260ca4663ce6a9bb0'
      and market_date = '2026-07-29'
  ),
  null::bigint,
  '확인된 무거래일의 시가는 NULL이다'
);

select is(
  (
    select volume
    from public.market_daily_candles
    where item_id = '4a737b2ae337a57260ca4663ce6a9bb0'
      and market_date = '2026-07-30'
  ),
  5::bigint,
  '일봉 거래량은 아이템 수량 합을 유지한다'
);

select is(
  (
    select occurrence_count
    from public.market_trades
    where fingerprint = repeat('a', 64)
  ),
  2::smallint,
  '같은 fingerprint의 발생 횟수를 값으로 보존한다'
);

select is(
  (
    select status
    from public.market_current_prices
    where item_id = '4a737b2ae337a57260ca4663ce6a9bb0'
  ),
  'available',
  '현재가 상태를 no-listings에서 available로 교체할 수 있다'
);

select is(
  (
    select price
    from public.market_current_prices
    where item_id = '4a737b2ae337a57260ca4663ce6a9bb0'
  ),
  54400000::bigint,
  '현재가를 정수 골드로 저장한다'
);

select * from finish();
rollback;
