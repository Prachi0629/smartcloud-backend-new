const express = require("express");
const pool = require('./db');
const app = express();

const cors = require("cors");

app.use(
  cors({
    origin: "https://smart-cloud-new-project.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);

app.use(express.json());

console.log("SERVER STARTED");

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json(err.message);
  }
});




try {
  const authRoutes = require("./routes/auth");
 console.log("ENV CHECK:", process.env.DATABASE_URL ? "DB OK" : "DB MISSING");
  app.use("/api/auth", authRoutes);
} catch (err) {
  console.error("AUTH ERROR:", err);
}

try {
  const bucketRoutes = require("./routes/buckets");
  console.log("BUCKET ROUTES LOADED");
  app.use("/api/buckets", bucketRoutes);
} catch (err) {
  console.error("BUCKET ERROR:", err);
}

try {
  const fileRoutes = require("./routes/files");
  console.log("FILE ROUTES LOADED");
  app.use("/api/files", fileRoutes);
} catch (err) {
  console.error("FILE ERROR:", err);
}

try {
  const billingRoutes = require("./routes/billing");
  console.log("BILLING ROUTES LOADED");
  app.use("/api/billing", billingRoutes);
} catch (err) {
  console.error("BILLING ERROR:", err);
}

app.get("/", (req, res) => {
  res.send("Server Running");
});

module.exports = app;
