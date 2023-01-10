const express = require("express");
const bodyParser = require("body-parser");
// var bcrypt = require("bcryptjs");
const cors = require("cors");
const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://itnepal.org"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());
const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  "xxxxx",
  "xxxxx",
  "xxxxx",
  {
    host: "xxxxxx",
    dialect: "postgres",
    port: 5432,
  }
);

sequelize
  .sync()
  .then(() => {
    console.log("Models synced with database");
  })
  .catch((err) => {
    console.error(err);
  });

// Start the server
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});