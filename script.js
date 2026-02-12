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

// ========== АДМИН ДАННЫЕ - ИСПРАВЛЕНО ==========
const ADMIN_EMAIL = 'admin@ilyasigma.com';
const ADMIN_PASSWORD = 'JojoTop1';
const ADMIN_NAME = 'ИльяСигма111';

// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
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
    // Камера и микрофон
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
    
    // Уведомления
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('✅ Уведомления:', permission);
        }
    }
    
    // Service Worker для уведомлений
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker зарегистрирован');
        } catch (error) {
            console.log('❌ Service Worker ошибка:', error);
        }
    }
}

// ========== ПОКАЗ УВЕДОМЛЕНИЯ ==========
function showBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://img.icons8.com/fluency/96/000000/chat.png',
            badge: 'https://img.icons8.com/fluency/96/000000/chat.png'
        });
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('NeoCascade загружен');
    
    // Запрашиваем разрешения
    requestPermissions();
    
    // Слушаем авторизацию
    auth.onAuthStateChanged(handleAuthState);
    
    // Назначаем обработчики
    setupEventListeners();
    setupPresence();
});

// ========== ОБРАБОТЧИКИ ==========
function setupEventListeners() {
    // Вход по email
    document.getElementById('email-login-btn')?.addEventListener('click', handleEmailLogin);
    
    // Google вход
    document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
    
    // Регистрация
    document.getElementById('email-register-btn')?.addEventListener('click', handleEmailRegister);
    
    // Админ вход - ИСПРАВЛЕНО
    document.getElementById('admin-login-btn')?.addEventListener('click', handleAdminLogin);
    
    // Переключение форм
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
    
    // Отправка сообщений
    elements.sendBtn?.addEventListener('click', sendMessage);
    elements.messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Голосовые сообщения
    elements.voiceBtn?.addEventListener('mousedown', startVoiceRecording);
    elements.voiceBtn?.addEventListener('mouseup', stopVoiceRecording);
    elements.voiceBtn?.addEventListener('mouseleave', stopVoiceRecording);
    elements.voiceBtn?.addEventListener('touchstart', startVoiceRecording);
    elements.voiceBtn?.addEventListener('touchend', stopVoiceRecording);
    
    // Выход
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Звонки
    elements.startCallBtn?.addEventListener('click', startCall);
    elements.joinCallBtn?.addEventListener('click', joinCall);
    document.getElementById('end-call')?.addEventListener('click', endCall);
    document.getElementById('toggle-video')?.addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio')?.addEventListener('click', toggleAudio);
    
    // Выбор чата
    elements.chatList?.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem?.dataset.chat) {
            selectChat(chatItem.dataset.chat);
        }
    });
    
    // Поиск чатов
    elements.chatSearch?.addEventListener('input', filterChats);
    
    // Мобильное меню
    setupMobileMenu();
}

// ========== GOOGLE ВХОД ==========
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        await auth.signInWithPopup(googleProvider);
    } catch (error) {
        console.error(error);
        showNotification('Ошибка входа через Google', 'error');
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

// ========== РЕГИСТРАЦИЯ ==========
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
            email: email,
            online: true,
            lastSeen: Date.now(),
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`
        });
        
        showNotification('Регистрация успешна!', 'success');
        showBrowserNotification('Добро пожаловать!', `Привет, ${name}!`);
        
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

// ========== АДМИН ВХОД - ИСПРАВЛЕНО ==========
async function handleAdminLogin() {
    const btn = document.getElementById('admin-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        console.log('Попытка входа как админ...');
        
        // Сначала пробуем войти
        try {
            const result = await auth.signInWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
            console.log('Админ вход успешен');
            
            // Обновляем имя если нужно
            if (result.user.displayName !== ADMIN_NAME) {
                await result.user.updateProfile({ displayName: ADMIN_NAME });
            }
            
            showNotification('Добро пожаловать, Администратор!', 'success');
            showBrowserNotification('👑 Админ', 'Вы вошли как ИльяСигма111');
            
        } catch (loginError) {
            // Если пользователь не найден - создаем
            if (loginError.code === 'auth/user-not-found') {
                console.log('Админ не найден, создаем...');
                
                const result = await auth.createUserWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
                await result.user.updateProfile({ displayName: ADMIN_NAME });
                
                // Сохраняем в базу
                await db.ref(`users/${result.user.uid}`).set({
                    name: ADMIN_NAME,
                    email: ADMIN_EMAIL,
                    online: true,
                    lastSeen: Date.now(),
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(ADMIN_NAME)}&background=10b981&color=fff`,
                    isAdmin: true,
                    createdAt: Date.now()
                });
                
                console.log('Админ создан');
                showNotification('Администратор создан!', 'success');
                showBrowserNotification('👑 Админ создан', 'Добро пожаловать!');
                
            } else {
                throw loginError;
            }
        }
        
    } catch (error) {
        console.error('Админ ошибка:', error);
        showNotification('Ошибка входа администратора', 'error');
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ========== СОСТОЯНИЕ АВТОРИЗАЦИИ ==========
async function handleAuthState(user) {
    if (user) {
        currentUser = user;
        
        // Обновляем статус в БД
        await db.ref(`users/${user.uid}`).update({
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            online: true,
            lastSeen: Date.now(),
            photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=3b82f6&color=fff`
        });
        
        // Обновляем UI
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
    
    const userStatusRef = db.ref(`users/${currentUser.uid}/online`);
    const connectedRef = db.ref('.info/connected');
    
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
            
            html += `
                <div class="chat-item" data-chat="${id}">
                    <div class="chat-icon">
                        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=10b981&color=fff`}" alt="avatar">
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${user.name || 'Пользователь'}</div>
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
                elements.chatTitle.textContent = user.name || 'Пользователь';
                elements.chatStatus.innerHTML = user.online ? 
                    '<span class="online">● в сети</span>' : 
                    '<span class="offline">● не в сети</span>';
                elements.currentChatAvatar.innerHTML = `<img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=3b82f6&color=fff`}" alt="avatar">`;
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
                        <button class="btn-play" onclick="playAudio('${msg.audioUrl}')">
                            <i class="fas fa-play"></i>
                        </button>
                        <span>Голосовое сообщение</span>
                        <span style="font-size: 11px; opacity: 0.7;">${msg.duration || 0} сек</span>
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

// ========== ГОЛОСОВЫЕ ==========
async function startVoiceRecording(e) {
    e.preventDefault();
    if (isRecording || !currentUser) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            await uploadVoiceMessage(blob);
            stream.getTracks().forEach(t => t.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        elements.voiceBtn.classList.add('recording');
        showNotification('🎤 Запись... Отпустите кнопку', 'info');
        
        setTimeout(() => {
            if (isRecording) stopVoiceRecording();
        }, 60000);
        
    } catch (error) {
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
        const filename = `voice_${Date.now()}_${currentUser.uid}.webm`;
        const storageRef = storage.ref(`voice/${currentChat}/${filename}`);
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
        
        showNotification('Голосовое отправлено', 'success');
        
    } catch (error) {
        console.error(error);
        showNotification('Ошибка отправки голосового', 'error');
    }
}

window.playAudio = (url) => {
    const audio = new Audio(url);
    audio.play().catch(() => {});
};

// ========== ЗВОНКИ ==========
async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
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
        showNotification('Звонок начат', 'success');
        
    } catch (error) {
        console.error(error);
        showNotification('Нет доступа к камере/микрофону', 'error');
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
        showNotification('Вы присоединились', 'success');
        
    } catch (error) {
        showNotification('Ошибка подключения', 'error');
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    db.ref(`calls/${currentChat}`).remove();
    elements.videoCall.classList.remove('active');
    activeCall = false;
    showNotification('Звонок завершен', 'info');
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
    showNotification('Вы вышли из системы', 'info');
}

// ========== ПОИСК ЧАТОВ ==========
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

console.log('✅ NeoCascade готов');
