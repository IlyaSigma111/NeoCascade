// ========== FIREBASE КОНФИГ ==========
const firebaseConfig = {
    apiKey: "AIzaSyDxGOGD6Oooo1CILrmrTpzy5Sq_MPuGiKM",
    authDomain: "messenger-4a3ab.firebaseapp.com",
    databaseURL: "https://messenger-4a3ab-default-rtdb.firebaseio.com",
    projectId: "messenger-4a3ab",
    storageBucket: "messenger-4a3ab.firebasestorage.app",
    messagingSenderId: "684785124123",
    appId: "1:684785124123:web:15efc74d7bb49259b789be"
};

// ИНИЦИАЛИЗАЦИЯ
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

// ========== DOM ЭЛЕМЕНТЫ ==========
const elements = {
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
    chatSearch: document.getElementById('chat-search'),
    notificationContainer: document.getElementById('notification-container'),
    currentChatAvatar: document.getElementById('current-chat-avatar')
};

// ========== ЗАПРОС РАЗРЕШЕНИЙ ==========
async function requestPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        stream.getTracks().forEach(track => track.stop());
        console.log('✅ Камера и микрофон разрешены');
    } catch (error) {
        console.log('❌ Нет доступа к камере/микрофону:', error);
    }
    
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker зарегистрирован');
        } catch (error) {
            console.log('❌ Service Worker ошибка:', error);
        }
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('NeoCascade загружен');
    requestPermissions();
    auth.onAuthStateChanged(handleAuthState);
    setupEventListeners();
    setupPresence();
});

// ========== ОБРАБОТЧИКИ ==========
function setupEventListeners() {
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
    
    elements.sendBtn?.addEventListener('click', sendMessage);
    elements.messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    elements.voiceBtn?.addEventListener('mousedown', startVoiceRecording);
    elements.voiceBtn?.addEventListener('mouseup', stopVoiceRecording);
    elements.voiceBtn?.addEventListener('mouseleave', stopVoiceRecording);
    elements.voiceBtn?.addEventListener('touchstart', startVoiceRecording);
    elements.voiceBtn?.addEventListener('touchend', stopVoiceRecording);
    
    elements.logoutBtn?.addEventListener('click', handleLogout);
    elements.startCallBtn?.addEventListener('click', startCall);
    elements.joinCallBtn?.addEventListener('click', joinCall);
    document.getElementById('end-call')?.addEventListener('click', endCall);
    document.getElementById('toggle-video')?.addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio')?.addEventListener('click', toggleAudio);
    
    elements.chatList?.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem?.dataset.chat) selectChat(chatItem.dataset.chat);
    });
    
    elements.chatSearch?.addEventListener('input', filterChats);
    setupMobileMenu();
}

// ========== GOOGLE ВХОД С ЗАПРОСОМ НИКА ==========
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        // Проверяем, есть ли ник в базе
        const snapshot = await db.ref(`users/${user.uid}/nickname`).once('value');
        
        if (!snapshot.exists()) {
            // Запрашиваем ник
            const nickname = prompt('Введите ваш никнейм для отображения в чате:', user.displayName || 'Пользователь');
            
            if (nickname && nickname.trim()) {
                await user.updateProfile({ displayName: nickname.trim() });
                await db.ref(`users/${user.uid}`).update({
                    name: nickname.trim(),
                    nickname: nickname.trim(),
                    email: user.email,
                    photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname.trim())}&background=3b82f6&color=fff`
                });
            }
        }
        
    } catch (error) {
        console.error('Google ошибка:', error);
        showNotification('Ошибка входа через Google', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== EMAIL РЕГИСТРАЦИЯ ==========
async function handleEmailRegister() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const pass = document.getElementById('register-password').value;
    
    if (!name || !email || !pass) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (pass.length < 6) {
        showNotification('Пароль должен быть от 6 символов', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        const result = await auth.createUserWithEmailAndPassword(email, pass);
        await result.user.updateProfile({ displayName: name });
        
        await db.ref(`users/${result.user.uid}`).set({
            name: name,
            nickname: name,
            email: email,
            online: true,
            lastSeen: Date.now(),
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`
        });
        
        showNotification('Регистрация успешна!', 'success');
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showNotification('Email уже используется', 'error');
        } else {
            showNotification('Ошибка регистрации', 'error');
        }
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== EMAIL ВХОД ==========
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    if (!email || !pass) {
        showNotification('Введите email и пароль', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        showNotification('Неверный email или пароль', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== АДМИН ВХОД ==========
async function handleAdminLogin() {
    const btn = document.getElementById('admin-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        try {
            await auth.signInWithEmailAndPassword('admin@ilyasigma.com', 'JojoTop1');
        } catch (loginError) {
            if (loginError.code === 'auth/user-not-found') {
                const result = await auth.createUserWithEmailAndPassword('admin@ilyasigma.com', 'JojoTop1');
                await result.user.updateProfile({ displayName: 'ИльяСигма111' });
                
                await db.ref(`users/${result.user.uid}`).set({
                    name: 'ИльяСигма111',
                    nickname: 'ИльяСигма111',
                    email: 'admin@ilyasigma.com',
                    online: true,
                    lastSeen: Date.now(),
                    photoURL: 'https://ui-avatars.com/api/?name=ИльяСигма111&background=10b981&color=fff',
                    isAdmin: true
                });
            } else {
                throw loginError;
            }
        }
        
        showNotification('👑 Добро пожаловать, Администратор!', 'success');
        
    } catch (error) {
        console.error('Админ ошибка:', error);
        showNotification('Ошибка входа', 'error');
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
                nickname: user.displayName || user.email.split('@')[0],
                email: user.email,
                online: true,
                lastSeen: Date.now(),
                photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=3b82f6&color=fff`
            });
        } else {
            await userRef.update({
                online: true,
                lastSeen: Date.now()
            });
        }
        
        updateUI();
        hideLoginModal();
        loadMessages();
        loadContacts();
        showNotification(`Привет, ${user.displayName || 'друг'}!`, 'success');
        
    } else {
        currentUser = null;
        showLoginModal();
    }
}

// ========== UI ==========
function updateUI() {
    if (!currentUser) return;
    
    elements.username.textContent = currentUser.displayName || currentUser.email.split('@')[0];
    elements.userStatus.textContent = 'в сети';
    elements.userStatus.className = 'online';
    
    if (currentUser.photoURL) {
        elements.userAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="avatar">`;
    }
    
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.joinCallBtn.disabled = false;
    elements.messageInput.placeholder = 'Напишите сообщение...';
}

function showLoginModal() {
    elements.loginModal.style.display = 'flex';
    elements.mainContainer.style.display = 'none';
}

function hideLoginModal() {
    elements.loginModal.style.display = 'none';
    elements.mainContainer.style.display = 'flex';
}

// ========== ПРИСУТСТВИЕ ==========
function setupPresence() {
    if (!currentUser) return;
    
    const connectedRef = db.ref('.info/connected');
    const userStatusRef = db.ref(`users/${currentUser.uid}/online`);
    
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            userStatusRef.set(true);
            userStatusRef.onDisconnect().set(false);
            db.ref(`users/${currentUser.uid}/lastSeen`).onDisconnect().set(Date.now());
        }
    });
}

// ========== КОНТАКТЫ ==========
function loadContacts() {
    if (!currentUser) return;
    
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        const generalChat = document.querySelector('.chat-item[data-chat="general"]');
        let html = generalChat ? generalChat.outerHTML : '';
        
        Object.entries(users).forEach(([id, user]) => {
            if (id === currentUser.uid) return;
            
            const displayName = user.nickname || user.name || 'Пользователь';
            
            html += `
                <div class="chat-item" data-chat="${id}">
                    <div class="chat-icon">
                        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`}" alt="avatar">
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${displayName}</div>
                        <div class="chat-preview" style="color: ${user.online ? '#10b981' : 'rgba(255,255,255,0.5)'}">
                            ${user.online ? 'в сети' : 'не в сети'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        elements.chatList.innerHTML = html;
    });
}

// ========== ВЫБОР ЧАТА ==========
function selectChat(chatId) {
    currentChat = chatId;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selected = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (selected) selected.classList.add('active');
    
    if (chatId === 'general') {
        elements.chatTitle.textContent = 'Общий чат';
        elements.chatStatus.innerHTML = '<span class="online">● онлайн</span>';
        elements.currentChatAvatar.innerHTML = '<i class="fas fa-globe"></i>';
    } else {
        db.ref(`users/${chatId}`).once('value', (snap) => {
            const user = snap.val();
            if (user) {
                const displayName = user.nickname || user.name || 'Пользователь';
                elements.chatTitle.textContent = displayName;
                elements.chatStatus.innerHTML = user.online ? 
                    '<span class="online">● в сети</span>' : 
                    '<span class="offline">● не в сети</span>';
                elements.currentChatAvatar.innerHTML = `<img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`}" alt="avatar">`;
            }
        });
    }
    
    loadMessages();
    
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar')?.classList.remove('open');
    }
}

// ========== СООБЩЕНИЯ ==========
function loadMessages() {
    if (!currentUser) return;
    
    const messagesRef = db.ref(`chats/${currentChat}/messages`).limitToLast(50);
    
    messagesRef.off();
    messagesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        elements.messagesContainer.innerHTML = '';
        
        if (!data) {
            elements.messagesContainer.innerHTML = `
                <div class="welcome">
                    <i class="fas fa-comments"></i>
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
            
            const messageEl = document.createElement('div');
            messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
            
            if (msg.type === 'voice') {
                messageEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button onclick="playAudio('${msg.audioUrl}')" style="background: none; border: none; color: white; cursor: pointer;">
                            <i class="fas fa-play"></i>
                        </button>
                        <span style="color: rgba(255,255,255,0.9);">🎤 Голосовое сообщение</span>
                        <span style="font-size: 11px; color: rgba(255,255,255,0.5);">${msg.duration || 0} сек</span>
                    </div>
                    <div class="message-time">${time}</div>
                `;
            } else {
                messageEl.innerHTML = `
                    <div class="message-content">${escapeHtml(msg.text || '')}</div>
                    <div class="message-time">${time}</div>
                `;
            }
            
            elements.messagesContainer.appendChild(messageEl);
        });
        
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    });
}

// ========== ОТПРАВКА ==========
async function sendMessage() {
    if (!currentUser || !elements.messageInput.value.trim()) return;
    
    const text = elements.messageInput.value.trim();
    elements.messageInput.value = '';
    
    const messagesRef = db.ref(`chats/${currentChat}/messages`).push();
    
    await messagesRef.set({
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        timestamp: Date.now(),
        type: 'text'
    });
}

// ========== ГОЛОСОВЫЕ - ИСПРАВЛЕНО! ==========
async function startVoiceRecording(e) {
    e.preventDefault();
    if (isRecording || !currentUser) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 48000,
                channelCount: 1
            } 
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { 
                type: 'audio/webm;codecs=opus' 
            });
            
            if (blob.size > 0) {
                await uploadVoiceMessage(blob);
            }
            
            stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorder.start(1000);
        isRecording = true;
        elements.voiceBtn.classList.add('recording');
        showNotification('🎤 Запись... Отпустите кнопку', 'info');
        
        setTimeout(() => {
            if (isRecording) stopVoiceRecording();
        }, 30000);
        
    } catch (error) {
        console.error('Microphone error:', error);
        showNotification('Нет доступа к микрофону', 'error');
    }
}

function stopVoiceRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        elements.voiceBtn.classList.remove('recording');
    }
}

async function uploadVoiceMessage(blob) {
    try {
        showNotification('⏳ Отправка голосового...', 'info');
        
        const filename = `voice_${Date.now()}_${currentUser.uid}.webm`;
        const storageRef = storage.ref(`voice/${currentChat}/${filename}`);
        
        // Простая загрузка без metadata
        await storageRef.put(blob);
        const url = await storageRef.getDownloadURL();
        
        const msgRef = db.ref(`chats/${currentChat}/messages`).push();
        await msgRef.set({
            type: 'voice',
            audioUrl: url,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'User',
            duration: Math.round(blob.size / 16000),
            timestamp: Date.now()
        });
        
        showNotification('✅ Голосовое отправлено!', 'success');
        
    } catch (error) {
        console.error('Voice upload error:', error);
        showNotification('❌ Ошибка загрузки. Попробуйте еще раз.', 'error');
    }
}

window.playAudio = (url) => {
    const audio = new Audio(url);
    audio.play().catch(e => console.error('Play error:', e));
};

// ========== ЗВОНКИ - ИСПРАВЛЕНО! ==========
async function startCall() {
    try {
        showNotification('⏳ Запрос доступа к камере...', 'info');
        
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        elements.localVideo.srcObject = localStream;
        
        await db.ref(`calls/${currentChat}`).set({
            active: true,
            startedBy: currentUser.uid,
            startedAt: Date.now(),
            participants: { [currentUser.uid]: true }
        });
        
        elements.videoCall.classList.add('active');
        activeCall = true;
        showNotification('📹 Звонок начат!', 'success');
        
    } catch (error) {
        console.error('Call error:', error);
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
        
        elements.localVideo.srcObject = localStream;
        await db.ref(`calls/${currentChat}/participants/${currentUser.uid}`).set(true);
        
        elements.videoCall.classList.add('active');
        activeCall = true;
        showNotification('✅ Вы присоединились к звонку', 'success');
        
    } catch (error) {
        showNotification('❌ Ошибка подключения', 'error');
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
    }
    
    db.ref(`calls/${currentChat}`).remove();
    elements.videoCall.classList.remove('active');
    activeCall = false;
    showNotification('📴 Звонок завершен', 'info');
}

function toggleVideo() {
    if (localStream) {
        const track = localStream.getVideoTracks()[0];
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
}

function toggleAudio() {
    if (localStream) {
        const track = localStream.getAudioTracks()[0];
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
    showLoginModal();
    showNotification('👋 Вы вышли из системы', 'info');
}

// ========== ПОИСК ==========
function filterChats() {
    const search = elements.chatSearch.value.toLowerCase();
    
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(search) ? 'flex' : 'none';
    });
}

// ========== МОБИЛЬНОЕ МЕНЮ ==========
function setupMobileMenu() {
    let touchStartX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchEndX - touchStartX;
        
        if (diff > 50 && window.innerWidth <= 768) {
            document.querySelector('.sidebar')?.classList.add('open');
        } else if (diff < -50 && window.innerWidth <= 768) {
            document.querySelector('.sidebar')?.classList.remove('open');
        }
    }, { passive: true });
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.sidebar') && !e.target.closest('.user-profile')) {
                document.querySelector('.sidebar')?.classList.remove('open');
            }
        }
    });
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, type = 'info') {
    if (!elements.notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let icon = '📢';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `${icon} ${message}`;
    
    if (type === 'error') notification.style.borderLeftColor = '#ef4444';
    if (type === 'success') notification.style.borderLeftColor = '#10b981';
    if (type === 'info') notification.style.borderLeftColor = '#3b82f6';
    
    elements.notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ========== ЭКРАНИРОВАНИЕ ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('✅ NeoCascade полностью готов!');
