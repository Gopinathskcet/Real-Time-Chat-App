const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/message');
const auth = require('../middleware/auth');

const router = express.Router();

// Get the full conversation between me and another user
router.get('/:userId', auth, async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!mongoose.isValidObjectId(otherId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: otherId },
        { sender: otherId, receiver: req.user.id },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a text message
router.post('/', auth, async (req, res) => {
  try {
    const { receiver, text } = req.body;

    if (!mongoose.isValidObjectId(receiver) || !text || !text.trim()) {
      return res.status(400).json({ message: 'Receiver and text are required' });
    }

    const message = await Message.create({
      sender: req.user.id,
      receiver,
      type: 'text',
      text: text.trim(),
    });

    req.app.get('io').to(String(receiver)).emit('new_message', message);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- Audio / video upload ----------
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

// const upload = multer({
//   storage,
//   limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only audio and video files are allowed'));
//     }
//   },
// });

const allowedExt = ['.webm', '.mp4', '.mkv', '.ogg', '.mp3', '.wav', '.m4a', '.aac', '.mov'];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okMime = file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/');
    if (okMime || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and video files are allowed'));
    }
  },
});

router.post('/upload', auth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 50 MB)' : err.message;
      return res.status(400).json({ message: msg });
    }

    try {
      const { receiver } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: 'No file received' });
      }
      if (!mongoose.isValidObjectId(receiver)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'Invalid receiver' });
      }

    //   const type = req.file.mimetype.startsWith('audio/') ? 'audio' : 'video';

      const kind = req.body.kind;
      const type =
        kind === 'audio' || kind === 'video'
          ? kind
          : req.file.mimetype.startsWith('audio/') ? 'audio' : 'video';

      const message = await Message.create({
        sender: req.user.id,
        receiver,
        type,
        fileUrl: `/uploads/${req.file.filename}`,
      });

      req.app.get('io').to(String(receiver)).emit('new_message', message);

      res.status(201).json(message);
    } catch (e) {
      res.status(500).json({ message: 'Server error' });
    }
  });
});

module.exports = router;