const express = require("express");
const bodyParser = require("body-parser");
// var bcrypt = require("bcryptjs");
const cors = require("cors");
const sequelize = require("./database/config");
const { sequelize, Product } = require("./models");

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://itnepal.org"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());

const cv = require("opencv4nodejs");

// Function to extract features from an image
function extractFeatures(image) {
  // Convert image to grayscale
  const grayImage = cv.cvtColor(image, cv.COLOR_BGR2GRAY);

  // Create ORB detector
  //   const detector = new cv.ORBDetector();

  //   // Detect features in the image
  //   const keyPoints = detector.detect(grayImage);

  //   // Compute descriptors for the keypoints
  //   const descriptors = detector.compute(grayImage, keyPoints);

  // Create ORB detector
  const detector = new cv.ORBDetector({ nFeatures: 100 });

  // Detect features in the image
  const keyPoints = detector.detect(grayImage);

  // Compute descriptors for the keypoints
  const descriptors = detector.compute(grayImage, keyPoints);

  return { keyPoints, descriptors };
}

async function compareImages(userProvidedImage) {
  // Read the user-provided image
  const image = cv.imread(userProvidedImage);

  // Extract features from the user-provided image
  const userFeatures = extractFeatures(image);

  // Fetch all products from DB
  const products = await Product.findAll();

  // Compare the user-provided image to the images associated with each product
  const similarities = products.map((product) => {
    // Read the product image
    const productImage = cv.imread(product.image);

    // Extract features from the product image
    const productFeatures = extractFeatures(productImage);

    // Compute the cosine similarity between the user-provided image and the product image
    const similarity = cv.matchShapes(
      userFeatures.descriptors,
      productFeatures.descriptors,
      cv.CONTOURS_MATCH_I1,
      0
    );

    return {
      productId: product.id,
      similarity: similarity,
    };
  });

  // Sort the products by similarity
  similarities.sort((a, b) => a.similarity - b.similarity);

  // Return the top k most similar products
  const k = 10;
  return similarities.slice(0, k);
}

// Start the server
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
