// ========== ИНИЦИАЛИЗАЦИЯ FIREBASE ==========
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
let currentTopic = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let activeCall = false;
let localStream = null;
let messageListener = null;
let notificationsEnabled = false;

// ========== DOM ЭЛЕМЕНТЫ ==========
const el = {
    loginModal: document.getElementById('login-modal'),
    mainContainer: document.getElementById('main-container'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    chatList: document.getElementById('chat-list'),
    topicList: document.getElementById('topic-list'),
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
    currentChatAvatar: document.getElementById('current-chat-avatar'),
    chatSearch: document.getElementById('chat-search'),
    createTopicBtn: document.getElementById('create-topic-btn')
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 NeoCascade Mega Glass запущен');
    auth.onAuthStateChanged(handleAuthState);
    setupListeners();
    checkNotifications();
});

// ========== ПРОВЕРКА УВЕДОМЛЕНИЙ ==========
function checkNotifications() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            notificationsEnabled = true;
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                notificationsEnabled = permission === 'granted';
            });
        }
    }
}

// ========== НАСТРОЙКА ОБРАБОТЧИКОВ ==========
function setupListeners() {
    // Авторизация
    document.getElementById('email-login-btn')?.addEventListener('click', handleEmailLogin);
    document.getElementById('google-login-btn')?.addEventListener('click', handleGoogleLogin);
    document.getElementById('email-register-btn')?.addEventListener('click', handleEmailRegister);
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
    el.sendBtn?.addEventListener('click', sendMessage);
    el.messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Голосовые сообщения
    el.voiceBtn?.addEventListener('mousedown', startVoiceRecording);
    el.voiceBtn?.addEventListener('mouseup', stopVoiceRecording);
    el.voiceBtn?.addEventListener('mouseleave', stopVoiceRecording);
    el.voiceBtn?.addEventListener('touchstart', startVoiceRecording);
    el.voiceBtn?.addEventListener('touchend', stopVoiceRecording);
    
    // Выход
    el.logoutBtn?.addEventListener('click', handleLogout);
    
    // Звонки
    el.startCallBtn?.addEventListener('click', startCall);
    el.joinCallBtn?.addEventListener('click', joinCall);
    document.getElementById('end-call')?.addEventListener('click', endCall);
    document.getElementById('toggle-video')?.addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio')?.addEventListener('click', toggleAudio);
    
    // Выбор чата
    el.chatList?.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem?.dataset.chat) {
            selectChat(chatItem.dataset.chat);
        }
    });
    
    // Поиск
    el.chatSearch?.addEventListener('input', handleSearch);
    
    // Создание темы
    el.createTopicBtn?.addEventListener('click', createTopic);
    
    // Мобильное меню
    setupMobileMenu();
}

// ========== ПОИСК ==========
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.chat-item');
    
    items.forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ========== СОЗДАНИЕ ТЕМЫ ==========
async function createTopic() {
    if (!currentUser) return;
    
    const topicName = prompt('Введите название темы:');
    if (!topicName?.trim()) return;
    
    try {
        const topicRef = db.ref('topics').push();
        await topicRef.set({
            name: topicName.trim(),
            createdBy: currentUser.uid,
            createdAt: Date.now(),
            members: { [currentUser.uid]: true }
        });
        
        showNotification('✅ Тема создана!', 'success');
        loadTopics();
    } catch (error) {
        showNotification('❌ Ошибка создания темы', 'error');
    }
}

// ========== ЗАГРУЗКА ТЕМ ==========
function loadTopics() {
    if (!currentUser) return;
    
    db.ref('topics').on('value', (snapshot) => {
        const topics = snapshot.val();
        if (!topics) return;
        
        let html = '<div style="padding: 8px 16px;"><h4 style="margin-bottom: 12px; color: rgba(255,255,255,0.5);">📌 ТЕМЫ</h4></div>';
        
        Object.entries(topics).forEach(([id, topic]) => {
            html += `
                <div class="chat-item" data-topic="${id}" onclick="selectTopic('${id}')">
                    <div class="chat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                        <i class="fas fa-hashtag"></i>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${topic.name}</div>
                        <div class="chat-preview">${topic.members ? Object.keys(topic.members).length : 0} участников</div>
                    </div>
                </div>
            `;
        });
        
        if (el.topicList) {
            el.topicList.innerHTML = html;
        }
    });
}

// ========== ВЫБОР ТЕМЫ ==========
window.selectTopic = function(topicId) {
    currentTopic = topicId;
    currentChat = `topic_${topicId}`;
    
    db.ref(`topics/${topicId}`).once('value', (snap) => {
        const topic = snap.val();
        if (topic) {
            el.chatTitle.textContent = `# ${topic.name}`;
            el.chatStatus.innerHTML = '<span class="online">тема</span>';
            el.currentChatAvatar.innerHTML = '<i class="fas fa-hashtag"></i>';
            
            // Обновляем активный класс
            document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
            document.querySelector(`[data-topic="${topicId}"]`)?.classList.add('active');
            
            loadMessages();
        }
    });
};

// ========== GOOGLE ВХОД ==========
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    const original = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
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
            lastSeen: Date.now(),
            avatar: user.photoURL || null
        });
        
        showNotification('👋 Добро пожаловать!', 'success');
        
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
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
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
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        showNotification('❌ Неверный email или пароль', 'error');
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
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
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
        
        // Presence система
        const connectedRef = db.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                userRef.child('online').set(true);
                userRef.child('online').onDisconnect().set(false);
                userRef.child('lastSeen').onDisconnect().set(Date.now());
            }
        });
        
        // Обновление UI
        el.username.textContent = user.displayName || user.email.split('@')[0];
        el.userStatus.textContent = 'в сети';
        el.userStatus.className = 'online';
        
        if (user.photoURL) {
            el.userAvatar.innerHTML = `<img src="${user.photoURL}" alt="avatar">`;
        } else {
            el.userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
        }
        
        el.messageInput.disabled = false;
        el.sendBtn.disabled = false;
        el.joinCallBtn.disabled = false;
        
        el.loginModal.style.display = 'none';
        el.mainContainer.style.display = 'flex';
        
        // Загрузка данных
        loadMessages();
        loadContacts();
        loadTopics();
        
        showNotification(`👋 Привет, ${user.displayName || 'друг'}!`, 'success');
        
    } else {
        currentUser = null;
        el.loginModal.style.display = 'flex';
        el.mainContainer.style.display = 'none';
        
        // Очистка слушателей
        if (messageListener) {
            db.ref(`chats/${currentChat}/messages`).off('value', messageListener);
        }
    }
}

// ========== ЗАГРУЗКА КОНТАКТОВ ==========
function loadContacts() {
    if (!currentUser) return;
    
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        let html = '<div style="padding: 8px 16px;"><h4 style="margin-bottom: 12px; color: rgba(255,255,255,0.5);">👥 КОНТАКТЫ</h4></div>';
        
        Object.entries(users).forEach(([id, u]) => {
            if (id === currentUser.uid) return;
            
            const status = u.online ? 
                '<span class="online">● в сети</span>' : 
                '<span class="offline">○ не в сети</span>';
            
            html += `
                <div class="chat-item" data-chat="${id}">
                    <div class="chat-icon">
                        ${u.avatar ? 
                            `<img src="${u.avatar}" style="width:100%; height:100%; object-fit:cover;">` : 
                            `<i class="fas fa-user"></i>`
                        }
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${u.name || 'Пользователь'}</div>
                        <div class="chat-preview">${status}</div>
                    </div>
                </div>
            `;
        });
        
        // Сохраняем общий чат и добавляем контакты
        const generalChat = document.querySelector('.chat-item[data-chat="general"]');
        el.chatList.innerHTML = (generalChat ? generalChat.outerHTML : '') + html;
    });
}

// ========== ВЫБОР ЧАТА ==========
function selectChat(chatId) {
    currentChat = chatId;
    currentTopic = null;
    
    // Обновление активного класса
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.chat-item[data-chat="${chatId}"]`)?.classList.add('active');
    
    if (chatId === 'general') {
        el.chatTitle.textContent = 'Общий чат';
        el.chatStatus.innerHTML = '<span class="online">● 128 участников</span>';
        el.currentChatAvatar.innerHTML = '<i class="fas fa-globe"></i>';
    } else {
        db.ref(`users/${chatId}`).once('value', (s) => {
            const u = s.val();
            if (u) {
                el.chatTitle.textContent = u.name || 'Пользователь';
                el.chatStatus.innerHTML = u.online ? 
                    '<span class="online">● в сети</span>' : 
                    '<span class="offline">○ был(а) ' + formatLastSeen(u.lastSeen) + '</span>';
                
                if (u.avatar) {
                    el.currentChatAvatar.innerHTML = `<img src="${u.avatar}" alt="avatar">`;
                } else {
                    el.currentChatAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                }
            }
        });
    }
    
    loadMessages();
}

// ========== ФОРМАТ ДАТЫ ==========
function formatLastSeen(timestamp) {
    if (!timestamp) return 'давно';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} дн назад`;
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages() {
    if (!currentUser) return;
    
    // Отключаем старый слушатель
    if (messageListener) {
        db.ref(`chats/${currentChat}/messages`).off('value', messageListener);
    }
    
    messageListener = db.ref(`chats/${currentChat}/messages`)
        .limitToLast(50)
        .on('value', (snap) => {
            const data = snap.val();
            renderMessages(data);
        });
}

// ========== ОТОБРАЖЕНИЕ СООБЩЕНИЙ ==========
function renderMessages(data) {
    el.messagesContainer.innerHTML = '';
    
    if (!data) {
        el.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-water" style="font-size: 64px; color: var(--primary); margin-bottom: 16px;"></i>
                <h3>Нет сообщений</h3>
                <p style="color: rgba(255,255,255,0.5);">Напишите первое сообщение!</p>
            </div>
        `;
        return;
    }
    
    const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
    
    messages.forEach(msg => {
        const isSent = msg.senderId === currentUser.uid;
        const time = new Date(msg.timestamp).toLocaleTimeString('ru', {
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        
        if (msg.type === 'voice') {
            messageEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button onclick="playVoice('${msg.audioUrl}')" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 16px; border-radius: 30px; cursor: pointer;">
                        <i class="fas fa-play"></i> Слушать
                    </button>
                    <span style="font-size: 12px;">🎤 ${msg.duration || 0} сек</span>
                </div>
                <div class="message-time">${time}</div>
            `;
        } else {
            messageEl.innerHTML = `
                <div class="message-content">${escapeHtml(msg.text || '')}</div>
                <div class="message-time">${time}</div>
            `;
        }
        
        // Добавляем реакции (новый функционал)
        if (msg.reactions) {
            const reactionsDiv = document.createElement('div');
            reactionsDiv.style.marginTop = '8px';
            reactionsDiv.style.display = 'flex';
            reactionsDiv.style.gap = '4px';
            
            Object.entries(msg.reactions).forEach(([emoji, users]) => {
                const count = Object.keys(users).length;
                reactionsDiv.innerHTML += `
                    <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 20px; font-size: 12px;">
                        ${emoji} ${count}
                    </span>
                `;
            });
            
            messageEl.appendChild(reactionsDiv);
        }
        
        el.messagesContainer.appendChild(messageEl);
    });
    
    // Скролл вниз
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
async function sendMessage() {
    if (!currentUser || !el.messageInput.value.trim()) return;
    
    const text = el.messageInput.value.trim();
    el.messageInput.value = '';
    
    try {
        await db.ref(`chats/${currentChat}/messages`).push({
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'User',
            timestamp: Date.now(),
            type: 'text'
        });
    } catch (error) {
        showNotification('❌ Ошибка отправки', 'error');
    }
}

// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ ==========
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
                    showNotification('⏳ Отправка голосового...', 'info');
                    
                    const filename = `voice_${Date.now()}_${currentUser.uid}.webm`;
                    const storageReference = storage.ref(`voice/${currentChat}/${filename}`);
                    await storageReference.put(blob);
                    const url = await storageReference.getDownloadURL();
                    
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
        
        // Автостоп через 30 секунд
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

// ========== ВОСПРОИЗВЕДЕНИЕ ГОЛОСОВОГО ==========
window.playVoice = function(url) {
    const audio = new Audio(url);
    audio.play().catch(() => {
        showNotification('❌ Ошибка воспроизведения', 'error');
    });
};

// ========== ВИДЕОЗВОНКИ ==========
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
        showNotification('✅ Присоединились к звонку', 'success');
        
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
        const sidebar = document.querySelector('.sidebar');
        
        if (diff > 50 && window.innerWidth <= 768) {
            sidebar?.classList.add('open');
        } else if (diff < -50 && window.innerWidth <= 768) {
            sidebar?.classList.remove('open');
        }
    }, { passive: true });
    
    // Закрытие по клику вне сайдбара
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const isClickInside = sidebar?.contains(e.target);
        
        if (!isClickInside && window.innerWidth <= 768 && sidebar?.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(msg, type = 'info') {
    if (!el.notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let icon = '📢';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `
        <i class="fas ${getIconForType(type)}"></i>
        <span>${msg}</span>
    `;
    
    // Цветовая индикация
    if (type === 'error') notification.style.borderLeftColor = '#ef4444';
    if (type === 'success') notification.style.borderLeftColor = '#10b981';
    if (type === 'warning') notification.style.borderLeftColor = '#f59e0b';
    
    el.notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // Системное уведомление
    if (notificationsEnabled && type !== 'info') {
        new Notification('NeoCascade', {
            body: msg,
            icon: 'https://img.icons8.com/fluency/96/000000/chat.png'
        });
    }
}

function getIconForType(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// ========== ЭКРАНИРОВАНИЕ ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
