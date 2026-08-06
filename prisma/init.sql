-- init.sql for 3-tier
-- Run on container init
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS timescaledb; -- requires custom image, enable in prod

-- Example hypertable setup (run after timescaledb enabled)
-- SELECT create_hypertable('public.listing_price_history', 'recorded_at', if_not_exists => true, chunk_time_interval => INTERVAL '7 days');

-- Materialized view for daily prices
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.daily_price_mv AS
SELECT listing_id, DATE(recorded_at) as day, AVG(price)::decimal(12,2) as avg_price, MIN(price) as min_price, MAX(price) as max_price, COUNT(*) as samples
FROM public.listing_price_history GROUP BY 1,2;

CREATE UNIQUE INDEX IF NOT EXISTS daily_price_mv_uidx ON analytics.daily_price_mv (listing_id, day);

-- Leaderboard MV
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.leaderboard_mv AS
SELECT user_id, SUM(total_xp) as total_xp, MAX(level) as level, RANK() OVER (ORDER BY SUM(total_xp) DESC) as rank
FROM public.user_xp GROUP BY user_id;

-- pg_cron jobs (if pg_cron installed)
-- SELECT cron.schedule('refresh-daily-price', '0 2 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_price_mv');
-- SELECT cron.schedule('refresh-leaderboard', '0 3 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.leaderboard_mv');

-- Vector index placeholder (HNSW better for prod)
-- CREATE INDEX listings_embedding_idx ON public.listings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
