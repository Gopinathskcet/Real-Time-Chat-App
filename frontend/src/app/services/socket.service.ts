import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { Message } from './chat.service';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private messageSubject = new Subject<Message>();

  newMessage$ = this.messageSubject.asObservable();

  connect() {
    if (this.socket) return;

    this.socket = io('http://localhost:3000', {
      auth: { token: localStorage.getItem('token') },
    });

    this.socket.on('new_message', (msg: Message) => {
      this.messageSubject.next(msg);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}