const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

console.log("SERVER STARTED");

try {
  const authRoutes = require("./routes/auth");
  console.log("AUTH ROUTES LOADED");
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
