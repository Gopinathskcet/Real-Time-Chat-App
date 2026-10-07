require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/message'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.get('/', (req, res) => {
  res.send('Hello! My chat server is alive ');
});

// Socket.IO needs the raw HTTP server underneath Express
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:4200' },
});

// Guard for the phone line: check the JWT wristband
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join(socket.user.id); // personal mailbox room
  console.log(`🔌 ${socket.user.username} connected`);

  socket.on('disconnect', () => {
    console.log(`❌ ${socket.user.username} disconnected`);
  });
});

// Let our routes reach the phone system
app.set('io', io);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected ✅');
    server.listen(3000, () => {
      console.log('Server running on http://localhost:3000');
    });
  })
  .catch((err) => {
    console.log('MongoDB connection failed ❌', err.message);
  });