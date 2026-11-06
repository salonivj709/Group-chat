const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

router.get("/search", authMiddleware, userController.findByEmail);

module.exports = router;
