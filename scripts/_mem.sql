SET NOCOUNT ON;
SELECT 'max_server_memory_MB' AS metric, CAST(value_in_use AS varchar(30)) AS val FROM sys.configurations WHERE name = 'max server memory (MB)'
UNION ALL SELECT 'user_connections', CAST(value_in_use AS varchar(30)) FROM sys.configurations WHERE name = 'user connections'
UNION ALL SELECT 'max_worker_threads', CAST(value_in_use AS varchar(30)) FROM sys.configurations WHERE name = 'max worker threads'
UNION ALL SELECT 'total_sessions', CAST(COUNT(*) AS varchar(30)) FROM sys.dm_exec_sessions
UNION ALL SELECT 'user_sessions', CAST(COUNT(*) AS varchar(30)) FROM sys.dm_exec_sessions WHERE is_user_process = 1
UNION ALL SELECT 'physical_memory_MB', CAST(physical_memory_kb/1024 AS varchar(30)) FROM sys.dm_os_sys_info
UNION ALL SELECT 'available_memory_MB', CAST(available_physical_memory_kb/1024 AS varchar(30)) FROM sys.dm_os_sys_memory
UNION ALL SELECT 'sql_workingset_MB', CAST(physical_memory_in_use_kb/1024 AS varchar(30)) FROM sys.dm_os_process_memory
UNION ALL SELECT 'clerk_total_MB', CAST(SUM(pages_kb)/1024 AS varchar(30)) FROM sys.dm_os_memory_clerks;
