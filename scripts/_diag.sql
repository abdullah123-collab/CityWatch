SET NOCOUNT ON;
DECLARE @d datetime = DATEADD(minute, -30, GETDATE());
SELECT CONVERT(varchar(19), LogDate, 120) AS LogDate, ProcessInfo, LEFT(Text, 120) AS Text
FROM sys.dm_os_server_diagnostics_log_configurations
WHERE 1 = 0;

SELECT 'err_17300_last_30min' AS metric, CAST(COUNT(*) AS varchar(20)) AS val
FROM (SELECT 1 AS x) dummy WHERE 1 = 0;

-- recent resource pool / memory broker state
SELECT 'broker_current_MB' AS metric, CAST(current_committed_kb/1024 AS varchar(20)) AS val FROM sys.dm_os_memory_broker_clerks
UNION ALL SELECT 'broker_max_MB', CAST(max_committed_kb/1024 AS varchar(20)) FROM sys.dm_os_memory_broker_clerks
UNION ALL SELECT 'broker_ideal_MB', CAST(ideal_committed_kb/1024 AS varchar(20)) FROM sys.dm_os_memory_broker_clerks
UNION ALL SELECT 'broker_avg_free_MB', CAST(average_free_kb/1024 AS varchar(20)) FROM sys.dm_os_memory_broker_clerks
UNION ALL SELECT 'stolen_pct', CAST(stolen_kb AS varchar(20)) FROM sys.dm_os_memory_broker_clerks;

SELECT 'pool:' + [name] AS metric, CAST(target_kb/1024 AS varchar(20)) AS targetMB, CAST(current_kb/1024 AS varchar(20)) AS currentMB, CAST(used_kb/1024 AS varchar(20)) AS usedMB
FROM sys.dm_os_memory_pools ORDER BY target_kb DESC;

SELECT 'workers:' + [state_desc] AS metric, CAST(COUNT(*) AS varchar(20)) AS n FROM sys.dm_os_workers GROUP BY [state_desc];
SELECT 'max_curr_workers' AS metric, CAST(MAX(current_workers_count) AS varchar(20)) AS val FROM sys.dm_os_schedulers
UNION ALL SELECT 'active_requests', CAST(SUM(running_tasks_count) AS varchar(20)) FROM sys.dm_os_schedulers WHERE status = 'VISIBLE ONLINE';
