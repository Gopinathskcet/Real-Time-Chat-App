const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'audio', 'video'], default: 'text' },
    text: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);