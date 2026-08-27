require("dotenv").config();
const express = require("express");
const path = require("path");

const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");

const app = express();
app.set("trust proxy", 1); // necesario en Render para que req.protocol refleje https
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api", apiRoutes);
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RelateReady escuchando en el puerto ${PORT}`);
});
