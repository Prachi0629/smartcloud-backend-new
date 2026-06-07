const express = require('express');

const cors = require('cors');

require('dotenv').config();

const authRoutes = require('./routes/auth');

const bucketRoutes = require('./routes/buckets');

const fileRoutes = require('./routes/files');

const billingRoutes = require('./routes/billing');

const app = express();


console.log('AUTH:', typeof authRoutes);

console.log('BUCKET:', typeof bucketRoutes);

console.log('FILES:', typeof fileRoutes);

console.log('BILLING:', typeof billingRoutes);


app.use(cors());

app.use(express.json());

app.use(
  '/uploads',
  express.static('uploads')
);

app.get('/test-env', (req, res) => {
  res.json({
    db: process.env.DATABASE_URL ? 'FOUND' : 'MISSING',
    jwt: process.env.JWT_SECRET ? 'FOUND' : 'MISSING'
  });
});

app.use('/api/auth', authRoutes);

app.use('/api/buckets', bucketRoutes);

app.use('/api/files', fileRoutes);

app.use('/api/billing', billingRoutes);

app.get('/', (req, res) => {

  res.send('Server Running');

});




module.exports=app;
