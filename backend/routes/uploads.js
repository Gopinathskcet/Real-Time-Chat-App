const path = require('path');
const express = require('express');
const Message = require('../models/message');
const { allowQueryToken } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');

// Serve an uploaded file only to the two people in that conversation
router.get('/:file', allowQueryToken, async (req, res) => {
  try {
    const file = path.basename(req.params.file); // no "../" tricks
    const message = await Message.exists({
      fileUrl: `/uploads/${file}`,
      $or: [{ sender: req.user.id }, { receiver: req.user.id }],
    });

    if (!message) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(file, { root: uploadDir }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  } catch (err) {
    console.error('Serve upload failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
