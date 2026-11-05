const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { getMessages, createMessage } = require("../controllers/messageController");

router.get("/", auth, getMessages);
router.post("/", auth, createMessage);

module.exports = router;
