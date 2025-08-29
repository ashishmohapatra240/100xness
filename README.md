# Docker

`docker exec -it 100xness-backend-timescaledb-1 psql -U postgres -d market`
`SELECT * FROM md_trades ORDER BY ts DESC LIMIT 20;`

`
SELECT *
FROM md_candles_5m
WHERE symbol = 'btcusdt'
ORDER BY bucket DESC
LIMIT 100;`
