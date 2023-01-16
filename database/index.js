const config = require("./config");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,

  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.acquire,
    idle: config.pool.idle,
    idleTimeoutMillis: 10000,
  },
});
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.products = require("./database/product.model")(sequelize, Sequelize);

sequelize.query = async function () {
  return Sequelize.prototype.query.apply(this, arguments).catch(function (err) {
    console.log(err);
    throw err;
  });
};
module.exports = db;
