const Sequelize = require("sequelize");

const sequelize = new Sequelize(process.env.DATABASE_URL);

const Product = sequelize.define("product", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  image: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  // other fields
});

module.exports = { sequelize, Product };
