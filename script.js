// ========== FIREBASE ==========
const firebaseConfig = {
    apiKey: "AIzaSyDxGOGD6Oooo1CILrmrTpzy5Sq_MPuGiKM",
    authDomain: "messenger-4a3ab.firebaseapp.com",
    databaseURL: "https://messenger-4a3ab-default-rtdb.firebaseio.com",
    projectId: "messenger-4a3ab",
    storageBucket: "messenger-4a3ab.firebasestorage.app",
    messagingSenderId: "684785124123",
    appId: "1:684785124123:web:15efc74d7bb49259b789be"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ========== ПЕРЕМЕННЫЕ ==========
let currentUser = null;
let currentChat = 'general';
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let activeCall = false;
let localStream = null;

// ========== DOM ==========
const el = {
    loginModal: document.getElementById('login-modal'),
    mainContainer: document.getElementById('main-container'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    chatList: document.getElementById('chat-list'),
    username: document.getElementById('username'),
    userStatus: document.getElementById('user-status'),
    userAvatar: document.getElementById('user-avatar'),
    chatTitle: document.getElementById('chat-title'),
    chatStatus: document.getElementById('chat-status'),
    logoutBtn: document.getElementById('logout-btn'),
    joinCallBtn: document.getElementById('join-call-btn'),
    startCallBtn: document.getElementById('start-group-call'),
    videoCall: document.getElementById('video-call-container'),
    localVideo: document.getElementById('local-video'),
    voiceBtn: document.getElementById('voice-btn'),
    notificationContainer: document.getElementById('notification-container'),
    currentChatAvatar: document.getElementById('current-chat-avatar')
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('NeoCascade загружен');
    auth.onAuthStateChanged(handleAuthState);
    setupListeners();
});

// ========== ОБРАБОТЧИКИ ==========
function setupListeners() {
    document.getElementById('email-login-btn')?.addEventListener('click', handleEmailLogin);
    document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
    document.getElementById('email-register-btn')?.addEventListener('click', handleEmailRegister);
    document.getElementById('admin-login-btn')?.addEventListener('click', handleAdminLogin);
    
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    
    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });
    
    el.sendBtn?.addEventListener('click', sendMessage);
    el.messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    el.voiceBtn?.addEventListener('mousedown', startVoiceRecording);
    el.voiceBtn?.addEventListener('mouseup', stopVoiceRecording);
    el.voiceBtn?.addEventListener('mouseleave', stopVoiceRecording);
    el.voiceBtn?.addEventListener('touchstart', startVoiceRecording);
    el.voiceBtn?.addEventListener('touchend', stopVoiceRecording);
    
    el.logoutBtn?.addEventListener('click', handleLogout);
    el.startCallBtn?.addEventListener('click', startCall);
    el.joinCallBtn?.addEventListener('click', joinCall);
    document.getElementById('end-call')?.addEventListener('click', endCall);
    document.getElementById('toggle-video')?.addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio')?.addEventListener('click', toggleAudio);
    
    el.chatList?.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem?.dataset.chat) {
            selectChat(chatItem.dataset.chat);
        }
    });
    
    setupMobileMenu();
}

// ========== GOOGLE ВХОД ==========
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⏳';
        
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        // Запрашиваем ник
        const nickname = prompt('Введите ваш никнейм:', user.displayName || user.email.split('@')[0]);
        const finalName = nickname?.trim() || user.email.split('@')[0];
        
        await user.updateProfile({ displayName: finalName });
        
        await db.ref(`users/${user.uid}`).set({
            name: finalName,
            email: user.email,
            online: true,
            lastSeen: Date.now()
        });
        
    } catch (error) {
        console.error(error);
        showNotification('❌ Ошибка входа', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== EMAIL РЕГИСТРАЦИЯ ==========
async function handleEmailRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const pass = document.getElementById('register-password').value;
    
    if (!name || !email || !pass) {
        showNotification('❌ Заполните все поля', 'error');
        return;
    }
    
    if (pass.length < 6) {
        showNotification('❌ Пароль от 6 символов', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⏳';
        
        const result = await auth.createUserWithEmailAndPassword(email, pass);
        await result.user.updateProfile({ displayName: name });
        
        await db.ref(`users/${result.user.uid}`).set({
            name: name,
            email: email,
            online: true,
            lastSeen: Date.now()
        });
        
        showNotification('✅ Регистрация успешна!', 'success');
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        
    } catch (error) {
        showNotification('❌ Ошибка регистрации', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== EMAIL ВХОД ==========
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    
    if (!email || !pass) {
        showNotification('❌ Введите email и пароль', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⏳';
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        showNotification('❌ Неверный email или пароль', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== АДМИН ==========
async function handleAdminLogin() {
    const btn = document.getElementById('admin-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '⏳';
        
        try {
            await auth.signInWithEmailAndPassword('admin@ilyasigma.com', 'JojoTop1');
        } catch (loginError) {
            if (loginError.code === 'auth/user-not-found') {
                const result = await auth.createUserWithEmailAndPassword('admin@ilyasigma.com', 'JojoTop1');
                await result.user.updateProfile({ displayName: 'ИльяСигма111' });
                await db.ref(`users/${result.user.uid}`).set({
                    name: 'ИльяСигма111',
                    email: 'admin@ilyasigma.com',
                    online: true,
                    lastSeen: Date.now(),
                    isAdmin: true
                });
            } else throw loginError;
        }
        
        showNotification('👑 Добро пожаловать, Админ!', 'success');
        
    } catch (error) {
        showNotification('❌ Ошибка входа', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== СОСТОЯНИЕ АВТОРИЗАЦИИ ==========
async function handleAuthState(user) {
    if (user) {
        currentUser = user;
        
        const userRef = db.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            await userRef.set({
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                online: true,
                lastSeen: Date.now()
            });
        } else {
            await userRef.update({ online: true, lastSeen: Date.now() });
        }
        
        // Presence
        const connectedRef = db.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                userRef.child('online').set(true);
                userRef.child('online').onDisconnect().set(false);
                userRef.child('lastSeen').onDisconnect().set(Date.now());
            }
        });
        
        // UI
        el.username.textContent = user.displayName || user.email.split('@')[0];
        el.userStatus.textContent = 'в сети';
        el.userStatus.className = 'online';
        
        if (user.photoURL) {
            el.userAvatar.innerHTML = `<img src="${user.photoURL}">`;
        }
        
        el.messageInput.disabled = false;
        el.sendBtn.disabled = false;
        el.joinCallBtn.disabled = false;
        
        el.loginModal.style.display = 'none';
        el.mainContainer.style.display = 'flex';
        
        loadMessages();
        loadContacts();
        
        showNotification(`👋 Привет, ${user.displayName || 'друг'}!`, 'success');
        
    } else {
        currentUser = null;
        el.loginModal.style.display = 'flex';
        el.mainContainer.style.display = 'none';
    }
}

// ========== КОНТАКТЫ ==========
function loadContacts() {
    if (!currentUser) return;
    
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        let html = '';
        
        Object.entries(users).forEach(([id, u]) => {
            if (id === currentUser.uid) return;
            
            html += `
                <div class="chat-item" data-chat="${id}">
                    <div class="chat-icon">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=10b981&color=fff">
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${u.name || 'Пользователь'}</div>
                        <div class="chat-preview ${u.online ? 'online' : 'offline'}">
                            ${u.online ? 'в сети' : 'не в сети'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        const generalChat = document.querySelector('.chat-item[data-chat="general"]');
        el.chatList.innerHTML = (generalChat ? generalChat.outerHTML : '') + html;
    });
}

// ========== ВЫБОР ЧАТА ==========
function selectChat(chatId) {
    currentChat = chatId;
    
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.chat-item[data-chat="${chatId}"]`)?.classList.add('active');
    
    if (chatId === 'general') {
        el.chatTitle.textContent = 'Общий чат';
        el.chatStatus.innerHTML = '<span class="online">в сети</span>';
        el.currentChatAvatar.innerHTML = '<i class="fas fa-globe"></i>';
    } else {
        db.ref(`users/${chatId}`).once('value', (s) => {
            const u = s.val();
            if (u) {
                el.chatTitle.textContent = u.name || 'Пользователь';
                el.chatStatus.innerHTML = u.online ? 
                    '<span class="online">в сети</span>' : 
                    '<span class="offline">не в сети</span>';
                el.currentChatAvatar.innerHTML = `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=3b82f6&color=fff">`;
            }
        });
    }
    
    loadMessages();
}

// ========== СООБЩЕНИЯ ==========
function loadMessages() {
    if (!currentUser) return;
    
    db.ref(`chats/${currentChat}/messages`).limitToLast(50).off();
    db.ref(`chats/${currentChat}/messages`).limitToLast(50).on('value', (snap) => {
        const data = snap.val();
        el.messagesContainer.innerHTML = '';
        
        if (!data) {
            el.messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
                    <i class="fas fa-comments" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <h3>Нет сообщений</h3>
                    <p>Напишите первое сообщение!</p>
                </div>
            `;
            return;
        }
        
        const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
        
        messages.forEach(msg => {
            const isSent = msg.senderId === currentUser.uid;
            const time = new Date(msg.timestamp).toLocaleTimeString('ru', {
                hour: '2-digit', minute: '2-digit'
            });
            
            const div = document.createElement('div');
            div.className = `message ${isSent ? 'sent' : 'received'}`;
            
            if (msg.type === 'voice') {
                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button onclick="new Audio('${msg.audioUrl}').play()" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 6px 12px; border-radius: 20px; cursor: pointer;">
                            <i class="fas fa-play"></i>
                        </button>
                        <span>🎤 Голосовое</span>
                        <span style="font-size: 11px;">${msg.duration || 0} сек</span>
                    </div>
                    <div class="message-time">${time}</div>
                `;
            } else {
                div.innerHTML = `
                    <div class="message-content">${escapeHtml(msg.text || '')}</div>
                    <div class="message-time">${time}</div>
                `;
            }
            
            el.messagesContainer.appendChild(div);
        });
        
        el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
    });
}

// ========== ОТПРАВКА ==========
async function sendMessage() {
    if (!currentUser || !el.messageInput.value.trim()) return;
    
    const text = el.messageInput.value.trim();
    el.messageInput.value = '';
    
    await db.ref(`chats/${currentChat}/messages`).push({
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        timestamp: Date.now(),
        type: 'text'
    });
}

// ========== ГОЛОСОВЫЕ ==========
async function startVoiceRecording(e) {
    e.preventDefault();
    if (isRecording || !currentUser) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            
            if (blob.size > 1000) {
                try {
                    const filename = `voice_${Date.now()}_${currentUser.uid}.webm`;
                    const ref = storage.ref(`voice/${currentChat}/${filename}`);
                    await ref.put(blob);
                    const url = await ref.getDownloadURL();
                    
                    await db.ref(`chats/${currentChat}/messages`).push({
                        type: 'voice',
                        audioUrl: url,
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || 'User',
                        duration: Math.round(blob.size / 16000),
                        timestamp: Date.now()
                    });
                    
                    showNotification('✅ Голосовое отправлено', 'success');
                    
                } catch (error) {
                    console.error(error);
                    showNotification('❌ Ошибка отправки', 'error');
                }
            }
            
            stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        el.voiceBtn.classList.add('recording');
        showNotification('🎤 Запись... Отпустите кнопку', 'info');
        
        setTimeout(() => {
            if (isRecording) stopVoiceRecording();
        }, 30000);
        
    } catch (error) {
        showNotification('❌ Нет доступа к микрофону', 'error');
    }
}

function stopVoiceRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        el.voiceBtn.classList.remove('recording');
    }
}

// ========== ЗВОНКИ ==========
async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        el.localVideo.srcObject = localStream;
        
        await db.ref(`calls/${currentChat}`).set({
            active: true,
            startedBy: currentUser.uid,
            startedAt: Date.now(),
            participants: { [currentUser.uid]: true }
        });
        
        el.videoCall.classList.add('active');
        activeCall = true;
        showNotification('📹 Звонок начат', 'success');
        
    } catch (error) {
        showNotification('❌ Нет доступа к камере/микрофону', 'error');
    }
}

async function joinCall() {
    if (activeCall) return;
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        el.localVideo.srcObject = localStream;
        await db.ref(`calls/${currentChat}/participants/${currentUser.uid}`).set(true);
        
        el.videoCall.classList.add('active');
        activeCall = true;
        showNotification('✅ Присоединились', 'success');
        
    } catch (error) {
        showNotification('❌ Ошибка подключения', 'error');
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    
    db.ref(`calls/${currentChat}`).remove();
    el.videoCall.classList.remove('active');
    activeCall = false;
    showNotification('📴 Звонок завершен', 'info');
}

function toggleVideo() {
    const track = localStream?.getVideoTracks()[0];
    if (track) {
        track.enabled = !track.enabled;
        const btn = document.getElementById('toggle-video');
        if (btn) {
            btn.innerHTML = track.enabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
        }
    }
}

function toggleAudio() {
    const track = localStream?.getAudioTracks()[0];
    if (track) {
        track.enabled = !track.enabled;
        const btn = document.getElementById('toggle-audio');
        if (btn) {
            btn.innerHTML = track.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

// ========== ВЫХОД ==========
async function handleLogout() {
    if (currentUser) {
        await db.ref(`users/${currentUser.uid}`).update({
            online: false,
            lastSeen: Date.now()
        });
    }
    
    if (activeCall) endCall();
    
    await auth.signOut();
    currentUser = null;
    el.loginModal.style.display = 'flex';
    el.mainContainer.style.display = 'none';
    showNotification('👋 Пока!', 'info');
}

// ========== МОБИЛЬНОЕ МЕНЮ ==========
function setupMobileMenu() {
    let startX = 0;
    
    document.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        const diff = e.changedTouches[0].clientX - startX;
        if (diff > 50 && window.innerWidth <= 768) {
            document.querySelector('.sidebar')?.classList.add('open');
        } else if (diff < -50 && window.innerWidth <= 768) {
            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }, { passive: true });
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(msg, type = 'info') {
    if (!el.notificationContainer) return;
    
    const n = document.createElement('div');
    n.className = 'notification';
    
    let icon = '📢';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    
    n.innerHTML = `${icon} ${msg}`;
    
    if (type === 'error') n.style.borderLeftColor = '#ef4444';
    if (type === 'success') n.style.borderLeftColor = '#10b981';
    
    el.notificationContainer.appendChild(n);
    
    setTimeout(() => n.remove(), 3000);
}

// ========== ЭКРАНИРОВАНИЕ ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
