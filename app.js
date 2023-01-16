require("dotenv").config();
const express = require("express");
const Sequelize = require("sequelize");
const tf = require("@tensorflow/tfjs-node");
const app = express();
app.use("/images", express.static("images"));
const { imageHash } = require("image-hash");
const path = require("path");
const compare = require( "./hamming");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const fs = require("fs");
const axios = require("axios");
const bodyParser = require("body-parser");
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Connect to the PostgreSQL database using Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    port: process.env.DB_PORT,
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

// Define the Image model for the database
const Image = sequelize.define('image', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fileName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  hash: {
    type: Sequelize.STRING,
    allowNull: false
  }
});

app.post("/api/upload", upload.single("image"), async (req, res) => {
  const image = req.file;
  // Get the base name of the file and replace spaces with an underscore
  const fileName = path.basename(image.originalname).replace(/ /g, "_");
  // Save the file to a temporary location
  const tempFilePath = `images/${fileName}`;
  fs.writeFileSync(tempFilePath, req.file.buffer);

const imageHashPromise = async (tempFilePath) => {
  return new Promise((resolve, reject) => {
    imageHash(tempFilePath, 16, true, (error, data) => {
      if (error) reject(error);
      resolve(data);
    });
  });
};

const myData = await imageHashPromise(tempFilePath); 
console.log(myData, "myData");
 
    await Image.create({
      fileName: fileName,
      hash: myData,
    })
      .then(() => {
        res.status(200).send("Image saved to database.");
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }); 
app.post("/api/similar-images", upload.single("image"), async (req, res) => { 
  const image = req.file;
  // Get the base name of the file and replace spaces with an underscore
  const fileName = path.basename(image.originalname).replace(/ /g, "_");

  // Save the file to a temporary location
  const tempFilePath = `images/${fileName}`;
  fs.writeFileSync(tempFilePath, req.file.buffer); 
  const imageHashPromise = async (tempFilePath) => {
    return new Promise((resolve, reject) => {
      imageHash(tempFilePath, 16, true, (error, data) => {
        if (error) reject(error);
        resolve(data);
      });
    });
  };

  const myData = await imageHashPromise(tempFilePath); 
  console.log(myData, "myData");

  function GetSortOrder(prop) {
    return function (a, b) {
      if (a[prop] > b[prop]) {
        return 1;
      } else if (a[prop] < b[prop]) {
        return -1;
      }
      return 0;
    };
  }  
let newHashings=[];
    Image.findAll({
      attributes: [
        "id",
        "hash" ]
    })
      .then((images) => {
        images.map((image) => {
         hash = compare(image.hash, myData);
         id = image.id;

         const Obj = {
                        id, hash
                     }
         newHashings.push(Obj);
        });
           const sorted = newHashings.sort(function (x, y) {
             return x["hash"] - y["hash"];
           });
        console.log(sorted, "sorted");
        res.status(200).json({
          sorted,
          // images,
        });
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  });

app.post("/api/check", upload.single("image"), async (req, res) => {
  const image = req.file;
  let inputImage = tf.node.decodeImage(image.buffer);
  if (inputImage.shape[2] === 4) {
    inputImage = inputImage.slice([0, 0, 0], [-1, -1, 3]);
  }
  const resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
  const mobilenet = await model();
  const imgBatch = resizedImage.expandDims(0);
  const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
  const featureVectorsArray = featureVectors.arraySync();
  const similarImages = await Image.findAll({
    attributes: [
      "id",
      "url",
      [
        Sequelize.fn(
          "cosine_similarity",
          Sequelize.col("feature_vectors"),
          Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
        ),
        "similarity",
      ],
    ],
    group: ["id"],
    order: [
      [
        Sequelize.fn(
          "cosine_similarity",
          Sequelize.col("feature_vectors"),
          Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
        ),
        "DESC",
      ],
    ],
  });
  // Send the similar images as a response
  res.json(similarImages);
});
 
app.listen(8000, () => {
  console.log("Server listening on port 3000");
});