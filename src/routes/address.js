const express = require("express");
const addressController = require("../controller/addressController");
const router = express.Router();

router.get("/search", addressController.getAddress);

module.exports = router;
