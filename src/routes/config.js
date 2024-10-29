const express = require("express");

const router = express.Router();

const configController = require("../controller/configController");

router.get("/", configController.test);

module.exports = router;
