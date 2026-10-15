SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (LogDate datetime, ProcessInfo varchar(20), Text varchar(8000));
INSERT INTO #t EXEC master.sys.xp_readerrorlog 0, 1;
SELECT TOP 60 CONVERT(varchar(19), LogDate, 120) AS LogDate, ProcessInfo, Text
FROM #t
WHERE Text LIKE '%error%' OR Text LIKE '%severity%' OR Text LIKE '%memory%' OR Text LIKE '%worker thread%' OR Text LIKE '%accept%'
ORDER BY LogDate DESC;
