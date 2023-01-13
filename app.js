require("dotenv").config();
const express = require("express");
const Sequelize = require("sequelize");
const tf = require("@tensorflow/tfjs-node");
const app = express();
app.use("images", express.static("images"));


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

// Define the Image model for the images table in the database
const Image = sequelize.define("image", {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  url: {
    type: Sequelize.STRING,
  },
  feature_vectors: {
    type: Sequelize.ARRAY(Sequelize.ARRAY(Sequelize.FLOAT)),
  },
});

// Load the pre-trained MobileNet model
const model = async () => {
  const mobilenet = await tf.loadLayersModel(
    "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json"
  );
  return mobilenet;
}


app.post("/api/upload", upload.single("image"), async (req, res) => {
  // Extract the feature vector of the input image
  const image = req.file;
  let inputImage = tf.node.decodeImage(image.buffer);
  if (inputImage.shape[2] === 4) {
    inputImage = inputImage.slice([0, 0, 0], [-1, -1, 3]);
  }
  const resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
  const mobilenet = await model();
  const imgBatch = resizedImage.expandDims(0);
  const featureVectors = tf.tidy(() => mobilenet.predict(imgBatch));
  const featureVectorsArray = featureVectors.arraySync();

  //Move the file to a directory
  // Store the file on the server
  // const filePath = `/images/${image.originalname}`;
  // // fs.writeFileSync(filePath, image.buffer);
  //   fs.writeFileSync(`${process.env.IMAGE_URL}${filePath}`, image.buffer);

   const filePath = `images/${image.originalname}`;
  //  fs.writeFileSync(filePath, image.buffer);
   fs.writeFileSync(filePath, image.buffer);

  // fs.renameSync(image.path, newPath);
  // Store the feature vectors and the image URL in the database
  await Image.create({
    url: filePath,
    feature_vectors: featureVectorsArray,
  });
  res.json({ Image, status: "success" });
});


app.post("/api/similar-images", upload.single("image"), async (req, res) => {

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

  // Find the most similar images in the database
  const images = await Image.findAll({
    attributes: [
      "id",
      "url",
      [
        Sequelize.fn(
          "AVG",
          Sequelize.fn(
            "COS",
            Sequelize.col("feature_vectors"),
            Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
          )
        ),
        "similarity",
      ],
    ],
    group: ["id"],
    order: [
      [
        Sequelize.fn(
          "AVG",
          Sequelize.fn(
            "COS",
            Sequelize.col("feature_vectors"),
            Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
          )
        ),
        "DESC",
      ],
    ],
  });

  // Return the URLs of the similar images
  const imageUrls = images.map((image) => image.url);
  res.json({ similarImages: imageUrls });
});

app.post("/api/check", upload.single("image"), async (req, res) => {
  // Extract the feature vector of the input image
  // const image = req.file;
  // const inputImage = tf.node.decodeImage(image.buffer);
  // const featureVector = await model.predict(inputImage);
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

  //  console.log(featureVectorsArray, "featureVectorsArray");


  // const getImages = async () => {

  //  const images = await Image.findAll({
  //     // where: { post_status: "publish", post_type: "post" },
  //     // order: [["updatedAt", "DESC"]],
  //     // raw: true,
  //     attributes: [
  //       "id",
  //       "url",
  //       "feature_vectors",
  //       "createdAt",
  //       "updatedAt",
  //      ],
  //   });
  //   console.log(images, "images");


  //   return images.feature_vectors;
  // };


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


  // const similarImages = await Image.findAll({
  //   attributes: [
  //     "id",
  //     "url",
  //     [
  //       Sequelize.fn(
  //         "COSINE_SIMILARITY",
  //         Sequelize.col("feature_vectors"),
  //         Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
  //       ),
  //       "similarity",
  //     ],
  //   ],
  //   group: ["id"],
  //   order: [["similarity", "DESC"]],
  // });

  // console.log(getImages, "getImages");

  //  return;

  // Find the most similar images in the database
  // const similarImages = await Image.findAll({
  //   order: Sequelize.fn(
  //     "ST_Distance",
  //     Sequelize.col("feature_vectors"),
  //     featureVectorsArray
  //   ),
  //   limit: 5,
  // });


  // const similarImages = await Image.findAll({
  //   attributes: [
  //     "id",
  //     "url",
  //     [
  //       Sequelize.fn(
  //         "AVG",
  //         Sequelize.fn(
  //           "COS",
  //           Sequelize.col("feature_vectors"),
  //           Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
  //         )
  //       ),
  //       "similarity",
  //     ],
  //   ],
  //   group: ["id"],
  //   order: [
  //     [
  //       Sequelize.fn(
  //         "AVG",
  //         Sequelize.fn(
  //           "COS",
  //           Sequelize.col("feature_vectors"),
  //           Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
  //         )
  //       ),
  //       "DESC",
  //     ],
  //   ],
  // });


  // Send the similar images as a response
  res.json(similarImages);
});

 

// app.get("/api/similar-images", async (req, res) => {
//   // Load the image URL from the request body
//   const imageUrl = req.body.imageUrl;

//   // Load the image from the URL
//   const imageData = await axios.get(imageUrl, { responseType: "arraybuffer" });
//   const inputImageTensor = tf.node.decodeImage(imageData.data);
//   const inputFeatureVectors = await model.predict(inputImageTensor);
//   const inputFeatureVectorsArray = inputFeatureVectors.arraySync();

//   // Find the most similar images in the database
//   const images = await Image.findAll({
//     attributes: [
//       "id",
//       "url",
//       [
//         Sequelize.fn(
//           "AVG",
//           Sequelize.fn(
//             "COS",
//             Sequelize.col("feature_vectors"),
//             Sequelize.literal(`ARRAY[${inputFeatureVectorsArray}]`)
//           )
//         ),
//         "similarity",
//       ],
//     ],
//     group: ["id"],
//     order: [
//       [
//         Sequelize.fn(
//           "AVG",
//           Sequelize.fn(
//             "COS",
//             Sequelize.col("feature_vectors"),
//             Sequelize.literal(`ARRAY[${inputFeatureVectorsArray}]`)
//           )
//         ),
//         "DESC",
//       ],
//     ],
//   });

//   // Return the URLs of the similar images
//   const imageUrls = images.map((image) => image.url);
//   res.json({ similarImages: imageUrls });
// });


// app.get("/api/similar-images", async (req, res) => {
//   // Load the image that the user wants to find similar images for
//   const inputImageUrl = req.query.imageUrl;
//   // Download the image from the URL
//   const inputImageBuffer = await axios.get(inputImageUrl, {
//     responseType: "arraybuffer",
//   });
//   const inputImageTensor = tf.node.decodeImage(inputImageBuffer.data);
//   // Resize the image if needed
//   const resizedImage = tf.image.resizeBilinear(inputImageTensor, [224, 224]);
//   // Get the feature vectors of the input image
//   const mobilenet = await model();
//   const imgBatch = resizedImage.expandDims(0);
//   const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
//   const featureVectorsArray = featureVectors.arraySync();

//   // Find the most similar images in the database
//   const images = await Image.findAll({
//     attributes: [
//       "id",
//       "url",
//       [
//         Sequelize.fn(
//           "AVG",
//           Sequelize.fn(
//             "COS",
//             Sequelize.col("feature_vectors"),
//             Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
//           )
//         ),
//         "similarity",
//       ],
//     ],
//     group: ["id"],
//     order: [
//       [
//         Sequelize.fn(
//           "AVG",
//           Sequelize.fn(
//             "COS",
//             Sequelize.col("feature_vectors"),
//             Sequelize.literal(`ARRAY[${featureVectorsArray}]`)
//           )
//         ),
//         "DESC",
//       ],
//     ],
//   });

//   // Return the URLs of the similar images
//   const imageUrls = images.map((image) => image.url);
//   res.json({ similarImages: imageUrls });
// });



// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   // Extract the feature vector of the input image
//   const image = req.file;
//   let inputImage = tf.node.decodeImage(image.buffer);
//   if (inputImage.shape[2] !== 3) {
//     inputImage = tf.image.grayscaleToRgb(inputImage);
//   }
//   const resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
//   const mobilenet = await model();
//   const imgBatch = resizedImage.expandDims(0);
//   const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
//   const featureVectorsArray = featureVectors.arraySync();

//   // Store the feature vectors and the image URL in the database
//   await Image.create({
//     url: image.url,
//     feature_vectors: featureVectorsArray,
//   });
//   res.json({ status: "success" });
// });




// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   // Extract the feature vector of the input image
//   const image = req.file;
//   const inputImage = tf.node.decodeImage(image.buffer);
//   let resizedImage;
//   if (inputImage.shape[0] != 224 || inputImage.shape[1] != 224) {
//     resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
//   } else {
//     resizedImage = inputImage;
//   }
//   const mobilenet = await model();
//   const imgBatch = resizedImage.expandDims(0);
//   const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
//   const featureVectorsArray = featureVectors.arraySync();

//   // Store the feature vectors and the image URL in the database
//   await Image.create({
//     url: image.url,
//     feature_vectors: featureVectorsArray,
//   });
//   res.json({ status: "success" });
// });




// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   // Extract the feature vector of the input image
//   const image = req.file;
//   const inputImage = tf.node.decodeImage(image.buffer);
//   let resizedImage = inputImage;
//   if (inputImage.shape[0] !== 224 || inputImage.shape[1] !== 224) {
//     resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
//   }
//   const mobilenet = await model();
//   const imgBatch = resizedImage.expandDims(0);
//   const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
//   const featureVectorsArray = featureVectors.arraySync();

//   // Store the feature vectors and the image URL in the database
//   await Image.create({
//     url: image.url,
//     feature_vectors: featureVectorsArray,
//   });
//   res.json({ status: "success" });
// });



// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   // Extract the feature vector of the input image
//   const image = req.file;
//   const inputImage = tf.node.decodeImage(image.buffer);

//   const [height, width, channels] = inputImage.shape;

//   // if (height !== 224 || width !== 224) {
//   //   const resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
//   //   // ... rest of the code
//   // }
  
//   // Resize the input image to 224x224
//   const resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
//   const mobilenet = await model();
//   const imgBatch = resizedImage.expandDims(0);
//   const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
//   const featureVectorsArray = featureVectors.arraySync();

//   // Store the feature vectors and the image URL in the database
//   await Image.create({
//     url: image.url,
//     feature_vectors: featureVectorsArray,
//   });
//   res.json({ status: "success" });
// });


// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   // Extract the feature vector of the input image
//   const image = req.file;
//   const inputImage = tf.node.decodeImage(image.buffer);
//   const resizedImage = tf.image.resizeBilinear(inputImage, [224, 224]);
//   const mobilenet = await model();
//   const imgBatch = resizedImage.expandDims(0);
//   const featureVectors = await tf.tidy(() => mobilenet.predict(imgBatch));
//   const featureVectorsArray = featureVectors.arraySync();

//   // Store the feature vectors and the image URL in the database
//   await Image.create({
//     url: image.url,
//     feature_vectors: featureVectorsArray,
//   });
//   res.json({ status: "success" });
// });



// app.get("/api/similar-images", async (req, res) => {
//   // Load the image that the user wants to find similar images for
//   // const inputImage = req.query.image;
//     const inputImage = req.query.image;

//   const inputImageTensor = tf.node.decodeImage(inputImage);
//   const inputFeatureVectors = await model.predict(inputImageTensor);
//   const inputFeatureVectorsArray = inputFeatureVectors.arraySync();

//   // Find the most similar images in the database
//   const images = await Image.findAll({
//     attributes: [
//       "id",
//       "url",
//       [
//         Sequelize.fn(
//           "AVG",
//           Sequelize.fn(
//             "COS",
//             Sequelize.col("feature_vectors"),
//             Sequelize.literal(`ARRAY[${inputFeatureVectorsArray}]`)
//           )
//         ),
//         "similarity",
//       ],
//     ],
//     group: ["id"],
//     order: [
//       [
//         Sequelize.fn(
//           "AVG",
//           Sequelize.fn(
//             "COS",
//             Sequelize.col("feature_vectors"),
//             Sequelize.literal(`ARRAY[${inputFeatureVectorsArray}]`)
//           )
//         ),
//         "DESC",
//       ],
//     ],
//   });

//   // Return the URLs of the similar images
//   const imageUrls = images.map((image) => image.url);
//   res.json({ similarImages: imageUrls });
// });


// app.get("/api/similar-images", async (req, res) => {
//   // Load the image that the user wants to find similar images for
//   const inputImage = req.query.image;
//   const inputImageTensor = tf.node.decodeImage(inputImage);
//   const inputFeatureVectors = await model.predict(inputImageTensor);

//   // Find the most similar images in the database
//   const images = await Image.findAll({
//     where: {
//       feature_vectors: {
//         [Sequelize.fn(
//           "ST_Distance_Sphere",
//           Sequelize.col("feature_vectors"),
//           inputFeatureVectors
//         )]: {
//           [Sequelize.Op.lte]: 0.5,
//         },
//       },
//     },
//   });

//   // Return the URLs of the similar images
//   const imageUrls = images.map((image) => image.url);
//   res.json({ similarImages: imageUrls });
// });

app.listen(8000, () => {
  console.log("Server listening on port 3000");
});


// require("dotenv").config();
// const express = require("express");
// const Sequelize = require("sequelize");
// const tf = require("@tensorflow/tfjs-node");
// const app = express();
// const multer = require("multer");
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// // Connect to the PostgreSQL database using Sequelize
// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASS,
//   {
//     host: process.env.DB_HOST,
//     dialect: process.env.DB_DIALECT,
//     port: process.env.DB_PORT,
//   }
// );

// sequelize
//   .sync()
//   .then(() => {
//     console.log("Models synced with database");
//   })
//   .catch((err) => {
//     console.error(err);
//   });

// // Define the Image model for the images table in the database
// const Image = sequelize.define("image", {
//   id: {
//     type: Sequelize.INTEGER,
//     primaryKey: true,
//     autoIncrement: true,
//   },
//   url: {
//     type: Sequelize.STRING,
//   },
//   feature_vectors: {
//     type: Sequelize.ARRAY(Sequelize.ARRAY(Sequelize.FLOAT)),
//   },
// });

// // Load the pre-trained MobileNet model

// const model = async () =>
//   await tf.loadLayersModel(
//     "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json"
//   );

// // const model = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json');

// app.post("/api/upload", upload.single("image"), async (req, res) => {
//   // Extract the feature vector of the input image
//   const image = req.file;
//   const inputImage = tf.node.decodeImage(image.buffer);
//   // const featureVectors = await model.predict(inputImage);

//   const featureVectors = async () =>await tf.tidy(() => {
//     const mobilenet =  async () =>
//       await tf.loadLayersModel(
//         "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json"
//       );
//     const imgBatch = inputImage.expandDims(0)
//     return mobilenet.predict(imgBatch)
// })

// const featureVectorsArray = featureVectors.array();


//   // Store the feature vectors and the image URL in the database
//   await Image.create({
//     url: image.url,
//     feature_vectors: featureVectorsArray,
//   });
//   res.json({ status: "success" });
// });

// app.get("/api/similar-images", async (req, res) => {
//   // Load the image that the user wants to find similar images for
//   const inputImage = req.query.image;
//   const inputImageTensor = tf.node.decodeImage(inputImage);
//   const inputFeatureVectors = await model.predict(inputImageTensor);

//   // Find the most similar images in the database
//   const images = await Image.findAll({
//     where: {
//       feature_vectors: {
//         [Sequelize.fn(
//           "ST_Distance_Sphere",
//           Sequelize.col("feature_vectors"),
//           inputFeatureVectors
//         )]: {
//           [Sequelize.Op.lte]: 0.5,
//         },
//       },
//     },
//   });

//   // Return the URLs of the similar images
//   const imageUrls = images.map((image) => image.url);
//   res.json({ similarImages: imageUrls });
// });

// app.listen(8000, () => {
//   console.log("Server listening on port 3000");
// });
