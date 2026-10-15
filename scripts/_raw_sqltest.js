const sql = require('msnodesqlv8');
const cs = 'Driver={ODBC Driver 18 for SQL Server};Server=' + process.env.SRV + ';Database=' + process.env.DB + ';Trusted_Connection=Yes;Encrypt=Yes;TrustServerCertificate=Yes;';
console.log('conn str:', cs);
sql.open(cs, (err) => {
  if (err) { console.log('OPEN ERR', JSON.stringify(err)); process.exit(1); }
  console.log('OPEN OK');
  sql.query(cs, "SELECT DB_NAME() AS db, @@VERSION AS v", (e, r) => {
    if (e) { console.log('QUERY ERR', JSON.stringify(e)); process.exit(1); }
    console.log('QUERY OK', JSON.stringify(r));
    process.exit(0);
  });
});
