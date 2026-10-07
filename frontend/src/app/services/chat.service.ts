import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ChatUser {
  _id: string;
  username: string;
  email: string;
}

export interface Message {
  _id: string;
  sender: string;
  receiver: string;
  type: 'text' | 'audio' | 'video';
  text: string;
  fileUrl: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private api = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getUsers() {
    return this.http.get<ChatUser[]>(`${this.api}/users`);
  }

  getHistory(userId: string) {
    return this.http.get<Message[]>(`${this.api}/messages/${userId}`);
  }

  sendText(receiver: string, text: string) {
    return this.http.post<Message>(`${this.api}/messages`, { receiver, text });
  }

  sendMedia(receiver: string, file: Blob, filename: string) {
    const form = new FormData();
    form.append('receiver', receiver);
    form.append('file', file, filename);
    return this.http.post<Message>(`${this.api}/messages/upload`, form);
  }
}