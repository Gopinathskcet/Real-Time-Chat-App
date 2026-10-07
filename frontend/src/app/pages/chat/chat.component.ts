import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatService, ChatUser, Message } from '../../services/chat.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './chat.component.html',
})
export class ChatComponent implements OnInit, OnDestroy {
  me: any;
  users = signal<ChatUser[]>([]);
  selected = signal<ChatUser | null>(null);
  messages = signal<Message[]>([]);
  unread = signal<Record<string, number>>({});
  lastMessages = signal<Record<string, Message>>({});
  newText = '';

  search = signal('');
  tab = signal<'all' | 'unread'>('all');
  darkMode = signal(localStorage.getItem('theme') === 'dark');
  infoOpen = signal(false);
  emojiOpen = signal(false);
  attachOpen = signal(false);
  tabClass = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  activeTabClass = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400';
  emojis = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '✨', '🚀', '👏', '😎', '💡', '🙏'];

  totalUnread = computed(() => Object.values(this.unread()).reduce((sum, n) => sum + n, 0));
  filteredUsers = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.users().filter((u) => {
      if (this.tab() === 'unread' && !this.unread()[u._id]) return false;
      return !q || u.username.toLowerCase().includes(q);
    });
  });

  recording = signal<'audio' | 'video' | null>(null);
  uploading = signal(false);
  errorMsg = signal('');

  @ViewChild('preview') preview?: ElementRef<HTMLVideoElement>;
  @ViewChild('msgBox') msgBox?: ElementRef<HTMLDivElement>;
  @ViewChild('textInput') textInput?: ElementRef<HTMLInputElement>;

  private mediaRecorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private saveOnStop = true;
  private sub?: Subscription;
  private serverUrl = 'http://localhost:3000';

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private socket: SocketService,
    private router: Router
  ) {
    this.me = this.auth.getUser();
    this.applyTheme();
    effect(() => {
      this.messages(); // re-run whenever the message list changes
      setTimeout(() => {
        const el = this.msgBox?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }
  

  ngOnInit() {
    this.chat.getUsers().subscribe((list) => this.users.set(list));

    this.socket.connect();
    this.sub = this.socket.newMessage$.subscribe((msg) => {
      this.rememberLast(msg.sender, msg);
      if (this.selected()?._id === msg.sender) {
        this.messages.update((list) => [...list, msg]);
      } else {
        this.unread.update((u) => ({ ...u, [msg.sender]: (u[msg.sender] || 0) + 1 }));
      }
    });
  }

  ngOnDestroy() {
    this.stopRecording(false);
    this.releaseDevices();
    this.sub?.unsubscribe();
    this.socket.disconnect();
  }

  selectUser(user: ChatUser) {
    this.stopRecording(false);
    this.errorMsg.set('');
    this.emojiOpen.set(false);
    this.attachOpen.set(false);
    this.selected.set(user);
    this.messages.set([]);
    this.unread.update((u) => ({ ...u, [user._id]: 0 }));
    this.chat.getHistory(user._id).subscribe((list) => {
      this.messages.set(list);
      if (list.length) this.rememberLast(user._id, list[list.length - 1]);
    });
  }

  send() {
    const to = this.selected();
    const text = this.newText.trim();
    if (!to || !text) return;

    this.emojiOpen.set(false);
    this.chat.sendText(to._id, text).subscribe((msg) => {
      this.messages.update((list) => [...list, msg]);
      this.rememberLast(to._id, msg);
      this.newText = '';
    });
  }

  // ---------- Recording ----------
  async startRecording(kind: 'audio' | 'video') {
    this.errorMsg.set('');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { audio: true, video: true } : { audio: true }
      );
    } catch {
      this.errorMsg.set('Could not access the microphone/camera. Please allow permission and try again.');
      return;
    }

    this.chunks = [];
    this.saveOnStop = true;
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const mime = this.mediaRecorder?.mimeType || `${kind}/webm`;
      const blob = new Blob(this.chunks, { type: mime });
      this.releaseDevices();
      this.recording.set(null);

      if (this.saveOnStop && blob.size > 0) {
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        this.uploadFile(blob, `${kind}-message.${ext}`);
      }
    };

    this.mediaRecorder.start();
    this.recording.set(kind);

    if (kind === 'video' && this.preview) {
      const v = this.preview.nativeElement;
      v.srcObject = this.stream;
      v.muted = true;
      v.play().catch(() => {});
    }
  }

  stopRecording(save: boolean) {
    this.saveOnStop = save;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  private releaseDevices() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    if (this.preview) this.preview.nativeElement.srcObject = null;
  }

  // ---------- Uploading ----------
  onFilePicked(event: Event) {
    this.attachOpen.set(false);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadFile(file, file.name);
    input.value = '';
  }

  private uploadFile(file: Blob, filename: string) {
    const to = this.selected();
    if (!to) return;

    this.errorMsg.set('');
    this.uploading.set(true);

    this.chat.sendMedia(to._id, file, filename).subscribe({
      next: (msg) => {
        this.messages.update((list) => [...list, msg]);
        this.rememberLast(to._id, msg);
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploading.set(false);
        this.errorMsg.set(err.error?.message || 'Upload failed');
      },
    });
  }

  fixDuration(event: Event) {
    const el = event.target as HTMLMediaElement;
    if (el.duration === Infinity || isNaN(el.duration)) {
      el.currentTime = 1e101; // jump to a huge time so the browser measures the real end
      el.addEventListener('timeupdate', () => { el.currentTime = 0; }, { once: true });
    }
  }

  fileSrc(m: Message) {
    return this.serverUrl + m.fileUrl;
  }

  isMine(m: Message) {
    return m.sender === this.me.id;
  }

  back() {
    this.stopRecording(false);
    this.errorMsg.set('');
    this.infoOpen.set(false);
    this.selected.set(null);
  }

  // ---------- UI helpers ----------
  insertEmoji(emoji: string) {
    this.newText += emoji;
    this.emojiOpen.set(false);
    this.textInput?.nativeElement.focus();
  }

  toggleDarkMode() {
    this.darkMode.update((d) => !d);
    localStorage.setItem('theme', this.darkMode() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.classList.toggle('dark', this.darkMode());
  }

  private rememberLast(userId: string, msg: Message) {
    this.lastMessages.update((m) => ({ ...m, [userId]: msg }));
  }

  lastMessagePreview(u: ChatUser) {
    const last = this.lastMessages()[u._id];
    if (!last) return u.email;
    const prefix = this.isMine(last) ? 'You: ' : '';
    if (last.type === 'audio') return prefix + '🎤 Voice note';
    if (last.type === 'video') return prefix + '🎥 Video';
    return prefix + last.text;
  }

  initials(name = '') {
    return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  }

  avatarColor(name = '') {
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444'];
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return colors[Math.abs(hash) % colors.length];
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}