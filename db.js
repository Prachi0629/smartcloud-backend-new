const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'smartcloud',
  password: 'Krish@0629',
  port: 5432
});

pool.connect((err) => {
  if (err) {
    console.log('Database Connection Error:', err);
  } else {
    console.log('PostgreSQL Connected Successfully');
  }
});

module.exports = pool;