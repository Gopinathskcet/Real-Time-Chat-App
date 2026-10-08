# Real-Time Chat App

A real-time one-to-one chat app with text, audio and video messages.

## Features
- Registration (unique email, password min 6 characters) and JWT login
- One-to-one chat with full history and timestamps
- Real-time messaging with Socket.IO
- Record or upload audio and video messages, played inside the chat
- Responsive layout (desktop and mobile)

## Tech Stack
Angular, RxJS, Socket.IO client | Node.js, Express, Socket.IO, MongoDB, JWT, Multer

Test accounts: demo1@test.com / 123456 and demo2@test.com / 123456

## Run locally
  ## Run the backend
  ```
  cd backend
  npm install
  copy .env.example .env      (then open .env and fill in the values)
  npm start
  ```
  
  ## Run the frontend (in a second terminal)
  ```
  cd frontend
  npm install
  npm start
  ```
  
  Open http://localhost:4200

## Screenshots
<img width="1896" height="867" alt="Screenshot 2026-10-08 004806" src="https://github.com/user-attachments/assets/565155d7-b40d-48fe-9f90-07a70eea8fe9" />
