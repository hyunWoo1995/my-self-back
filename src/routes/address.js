const express = require("express");
const addressController = require("../controller/addressController");
const router = express.Router();

router.get("/search", addressController.getAddress);
router.post("/createAddress", addressController.createAddress);

module.exports = router;
