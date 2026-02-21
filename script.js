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
let currentChannel = null;
let currentTopic = null;
let currentMessageForComment = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let activeCall = false;
let localStream = null;
let messageListener = null;
let notificationsEnabled = false;
let activeListeners = {};

// Яндекс Телемост комнаты
const TELEMOST_ROOMS = [
    { id: 'room1', name: 'Гостиная', url: 'https://telemost.yandex.ru/j/85964605009487', users: 3 },
    { id: 'room2', name: 'Игровая', url: 'https://telemost.yandex.ru/j/85625389138641', users: 5 },
    { id: 'room3', name: 'Музыкальная', url: 'https://telemost.yandex.ru/j/73970146483392', users: 2 },
    { id: 'room4', name: 'Кинотеатр', url: 'https://telemost.yandex.ru/j/07188908901264', users: 4 },
    { id: 'room5', name: 'VIP комната', url: 'https://telemost.yandex.ru/j/28044634885213', users: 1 }
];

// ========== DOM ЭЛЕМЕНТЫ ==========
const el = {
    loginModal: document.getElementById('login-modal'),
    mainContainer: document.getElementById('main-container'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    chatList: document.getElementById('chat-list'),
    topicList: document.getElementById('topic-list'),
    channelsList: document.getElementById('channels-list'),
    voiceChannels: document.getElementById('voice-channels'),
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
    createTopicBtn: document.getElementById('create-topic-btn'),
    createChannelBtn: document.getElementById('create-channel-btn'),
    reactionPanel: document.getElementById('reaction-panel'),
    commentsSection: document.getElementById('comments-section'),
    commentsList: document.getElementById('comments-list'),
    commentInput: document.getElementById('comment-input'),
    sendCommentBtn: document.getElementById('send-comment-btn'),
    closeComments: document.getElementById('close-comments')
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 NeoCascade с каналами и комментариями запущен');
    
    auth.onAuthStateChanged(handleAuthState);
    setupListeners();
    checkNotifications();
    loadVoiceChannels();
    
    window.addEventListener('beforeunload', () => {
        cleanupAllListeners();
    });
});

// ========== ОЧИСТКА ВСЕХ СЛУШАТЕЛЕЙ ==========
function cleanupAllListeners() {
    Object.keys(activeListeners).forEach(key => {
        const [path, event] = key.split('|');
        db.ref(path).off(event, activeListeners[key]);
    });
    activeListeners = {};
    
    if (messageListener) {
        db.ref(`chats/${currentChat}/messages`).off('value', messageListener);
        messageListener = null;
    }
}

// ========== НАСТРОЙКА ОБРАБОТЧИКОВ ==========
function setupListeners() {
    // Авторизация
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
    
    // Создание канала
    el.createChannelBtn?.addEventListener('click', createChannel);
    
    // Реакции
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const emoji = e.currentTarget.dataset.emoji;
            if (currentMessageForComment) {
                addReaction(currentMessageForComment, emoji);
                hideReactionPanel();
            }
        });
    });
    
    // Комментарии
    el.sendCommentBtn?.addEventListener('click', sendComment);
    el.commentInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendComment();
        }
    });
    
    el.closeComments?.addEventListener('click', () => {
        el.commentsSection.style.display = 'none';
        currentMessageForComment = null;
    });
    
    // Мобильное меню
    setupMobileMenu();
}

// ========== ЗАГРУЗКА ГОЛОСОВЫХ КАНАЛОВ ==========
function loadVoiceChannels() {
    if (!el.voiceChannels) return;
    
    let html = '<div style="padding: 8px 16px;"><h4 style="margin-bottom: 12px; color: rgba(255,255,255,0.5);"><i class="fas fa-headphones" style="margin-right: 8px;"></i>ГОЛОСОВЫЕ КАНАЛЫ</h4></div>';
    
    TELEMOST_ROOMS.forEach(room => {
        const userCount = room.users || Math.floor(Math.random() * 8) + 1;
        const status = userCount > 0 ? 
            `<span style="color: #34d399;">● ${userCount} слушают</span>` : 
            `<span style="color: rgba(255,255,255,0.3);">○ пусто</span>`;
        
        html += `
            <div class="voice-item" onclick="window.open('${room.url}', '_blank')">
                <div class="voice-icon">
                    <i class="fas fa-headphones"></i>
                </div>
                <div class="voice-info">
                    <div class="voice-name">🎧 ${room.name}</div>
                    <div class="voice-preview">${status}</div>
                </div>
                <button class="btn-icon" style="width: 32px; height: 32px;" onclick="event.stopPropagation(); window.open('${room.url}', '_blank')">
                    <i class="fas fa-sign-in-alt"></i>
                </button>
            </div>
        `;
    });
    
    el.voiceChannels.innerHTML = html;
}

// ========== СОЗДАНИЕ КАНАЛА ==========
async function createChannel() {
    if (!currentUser) return;
    
    const channelName = prompt('Введите название канала:');
    if (!channelName?.trim()) return;
    
    const channelDesc = prompt('Введите описание канала (необязательно):') || '';
    
    try {
        const channelRef = db.ref('channels').push();
        await channelRef.set({
            name: channelName.trim(),
            description: channelDesc,
            createdBy: currentUser.uid,
            createdAt: Date.now(),
            members: { [currentUser.uid]: true },
            posts: 0,
            subscribers: 1
        });
        
        showNotification('✅ Канал создан!', 'success');
        loadChannels();
    } catch (error) {
        console.error('Channel error:', error);
        showNotification('❌ Ошибка создания канала', 'error');
    }
}

// ========== ЗАГРУЗКА КАНАЛОВ ==========
function loadChannels() {
    if (!currentUser) return;
    
    const channelsKey = 'channels|value';
    if (activeListeners[channelsKey]) {
        db.ref('channels').off('value', activeListeners[channelsKey]);
    }
    
    const channelsListener = db.ref('channels').on('value', (snapshot) => {
        const channels = snapshot.val();
        if (!channels) {
            el.channelsList.innerHTML = '<div style="padding: 16px; text-align: center; color: rgba(255,255,255,0.3);">Нет каналов</div>';
            return;
        }
        
        let html = '';
        
        Object.entries(channels).forEach(([id, channel]) => {
            const isActive = currentChannel === id;
            const activeClass = isActive ? 'active' : '';
            
            html += `
                <div class="channel-item ${activeClass}" data-channel="${id}" onclick="selectChannel('${id}')">
                    <div class="channel-icon">
                        <i class="fas fa-bullhorn"></i>
                    </div>
                    <div class="channel-info">
                        <div class="channel-name">${channel.name}</div>
                        <div class="channel-stats">
                            <span><i class="fas fa-user"></i> ${channel.subscribers || 0}</span>
                            <span><i class="fas fa-file-alt"></i> ${channel.posts || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        if (el.channelsList) {
            el.channelsList.innerHTML = html;
        }
    });
    
    activeListeners[channelsKey] = channelsListener;
}

// ========== ВЫБОР КАНАЛА ==========
window.selectChannel = function(channelId) {
    currentChannel = channelId;
    currentChat = `channel_${channelId}`;
    currentTopic = null;
    
    document.querySelectorAll('.channel-item, .chat-item, .voice-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-channel="${channelId}"]`)?.classList.add('active');
    
    db.ref(`channels/${channelId}`).once('value', (snap) => {
        const channel = snap.val();
        if (channel) {
            el.chatTitle.textContent = `📢 ${channel.name}`;
            el.chatStatus.innerHTML = `<span class="online">● ${channel.subscribers || 0} подписчиков</span>`;
            el.currentChatAvatar.innerHTML = '<i class="fas fa-bullhorn"></i>';
            
            // Подписываемся на канал
            db.ref(`channels/${channelId}/members/${currentUser.uid}`).set(true);
            
            loadMessages();
        }
    });
};

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
        console.error('Topic error:', error);
        showNotification('❌ Ошибка создания темы', 'error');
    }
}

// ========== ЗАГРУЗКА ТЕМ ==========
function loadTopics() {
    if (!currentUser) return;
    
    const topicKey = 'topics|value';
    if (activeListeners[topicKey]) {
        db.ref('topics').off('value', activeListeners[topicKey]);
    }
    
    const topicsListener = db.ref('topics').on('value', (snapshot) => {
        const topics = snapshot.val();
        if (!topics) return;
        
        let html = '<div style="padding: 8px 16px;"><h4 style="margin-bottom: 12px; color: rgba(255,255,255,0.5);"><i class="fas fa-hashtag" style="margin-right: 8px;"></i>ТЕМЫ</h4></div>';
        
        Object.entries(topics).forEach(([id, topic]) => {
            const isActive = currentTopic === id;
            const activeClass = isActive ? 'active' : '';
            
            html += `
                <div class="chat-item ${activeClass}" data-topic="${id}" onclick="selectTopic('${id}')">
                    <div class="chat-icon" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);">
                        <i class="fas fa-hashtag"></i>
                    </div>
                    <div class="chat-info">
                        <div class="chat-name"># ${topic.name}</div>
                        <div class="chat-preview">${topic.members ? Object.keys(topic.members).length : 0} участников</div>
                    </div>
                </div>
            `;
        });
        
        if (el.topicList) {
            el.topicList.innerHTML = html;
        }
    });
    
    activeListeners[topicKey] = topicsListener;
}

// ========== ВЫБОР ТЕМЫ ==========
window.selectTopic = function(topicId) {
    currentTopic = topicId;
    currentChat = `topic_${topicId}`;
    currentChannel = null;
    
    document.querySelectorAll('.chat-item, .channel-item, .voice-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-topic="${topicId}"]`)?.classList.add('active');
    
    db.ref(`topics/${topicId}`).once('value', (snap) => {
        const topic = snap.val();
        if (topic) {
            el.chatTitle.textContent = `# ${topic.name}`;
            el.chatStatus.innerHTML = '<span class="online">● тема</span>';
            el.currentChatAvatar.innerHTML = '<i class="fas fa-hashtag"></i>';
            
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
        
        await auth.signInWithRedirect(googleProvider);
        
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
    cleanupAllListeners();
    
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
        
        const sessionId = Date.now().toString();
        sessionStorage.setItem('sessionId', sessionId);
        
        const connectedRef = db.ref('.info/connected');
        const presenceListener = connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                userRef.child('online').set(true);
                userRef.child('session').set(sessionId);
                userRef.child('online').onDisconnect().set(false);
                userRef.child('session').onDisconnect().remove();
                userRef.child('lastSeen').onDisconnect().set(Date.now());
            }
        });
        
        activeListeners['.info/connected|value'] = presenceListener;
        
        el.username.textContent = user.displayName || user.email.split('@')[0];
        el.userStatus.innerHTML = '<i class="fas fa-circle" style="color: #34d399; font-size: 8px;"></i> в сети';
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
        
        // Загрузка всех данных
        loadMessages();
        loadContacts();
        loadTopics();
        loadChannels();
        
        showNotification(`👋 Привет, ${user.displayName || 'друг'}!`, 'success');
        
    } else {
        currentUser = null;
        el.loginModal.style.display = 'flex';
        el.mainContainer.style.display = 'none';
        
        cleanupAllListeners();
        
        el.messagesContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-water" style="font-size: 64px; color: var(--primary); margin-bottom: 16px; opacity: 0.5;"></i>
                <h3 style="margin-bottom: 8px;">NeoCascade</h3>
                <p style="color: rgba(255,255,255,0.5);">Войдите чтобы начать общение</p>
            </div>
        `;
    }
}

// ========== ЗАГРУЗКА КОНТАКТОВ ==========
function loadContacts() {
    if (!currentUser) return;
    
    const contactsKey = 'users|value';
    if (activeListeners[contactsKey]) {
        db.ref('users').off('value', activeListeners[contactsKey]);
    }
    
    const contactsListener = db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        let html = '<div style="padding: 8px 16px;"><h4 style="margin-bottom: 12px; color: rgba(255,255,255,0.5);"><i class="fas fa-users" style="margin-right: 8px;"></i>КОНТАКТЫ</h4></div>';
        
        Object.entries(users).forEach(([id, u]) => {
            if (id === currentUser.uid) return;
            
            const isActive = currentChat === id && !currentTopic && !currentChannel;
            const activeClass = isActive ? 'active' : '';
            
            const isOnline = u.online && u.session;
            const status = isOnline ? 
                '<span style="color: #34d399;">● в сети</span>' : 
                '<span style="color: rgba(255,255,255,0.3);">○ не в сети</span>';
            
            html += `
                <div class="chat-item ${activeClass}" data-chat="${id}">
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
        
        const generalChat = document.querySelector('.chat-item[data-chat="general"]');
        const generalActive = currentChat === 'general' ? 'active' : '';
        
        if (generalChat) {
            generalChat.className = `chat-item ${generalActive}`;
        }
        
        el.chatList.innerHTML = (generalChat ? generalChat.outerHTML : `<div class="chat-item ${generalActive}" data-chat="general">
            <div class="chat-icon general">
                <i class="fas fa-globe"></i>
            </div>
            <div class="chat-info">
                <div class="chat-name">Общий чат</div>
                <div class="chat-preview">Добро пожаловать!</div>
            </div>
        </div>`) + html;
    });
    
    activeListeners[contactsKey] = contactsListener;
}

// ========== ВЫБОР ЧАТА ==========
function selectChat(chatId) {
    currentChat = chatId;
    currentTopic = null;
    currentChannel = null;
    
    document.querySelectorAll('.chat-item, .channel-item, .voice-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.chat-item[data-chat="${chatId}"]`)?.classList.add('active');
    
    if (chatId === 'general') {
        el.chatTitle.textContent = 'Общий чат';
        el.chatStatus.innerHTML = '<span class="online">● 128 участников</span>';
        el.currentChatAvatar.innerHTML = '<i class="fas fa-globe"></i>';
        
        loadMessages();
    } else {
        db.ref(`users/${chatId}`).once('value', (s) => {
            const u = s.val();
            if (u) {
                el.chatTitle.textContent = u.name || 'Пользователь';
                
                const isOnline = u.online && u.session;
                el.chatStatus.innerHTML = isOnline ? 
                    '<span class="online">● в сети</span>' : 
                    '<span class="offline">○ был(а) ' + formatLastSeen(u.lastSeen) + '</span>';
                
                if (u.avatar) {
                    el.currentChatAvatar.innerHTML = `<img src="${u.avatar}" alt="avatar">`;
                } else {
                    el.currentChatAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                }
                
                loadMessages();
            }
        });
    }
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

// ========== ПОИСК ==========
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.chat-item, .voice-item, .channel-item');
    
    items.forEach(item => {
        const name = item.querySelector('.chat-name, .voice-name, .channel-name')?.textContent.toLowerCase() || '';
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages() {
    if (!currentUser) return;
    
    if (messageListener) {
        db.ref(`chats/${currentChat}/messages`).off('value', messageListener);
        messageListener = null;
    }
    
    const messagesRef = db.ref(`chats/${currentChat}/messages`);
    
    messageListener = messagesRef
        .limitToLast(50)
        .on('value', (snap) => {
            const data = snap.val();
            renderMessages(data);
        }, (error) => {
            console.error('Messages error:', error);
        });
}

// ========== ОТОБРАЖЕНИЕ СООБЩЕНИЙ ==========
function renderMessages(data) {
    el.messagesContainer.innerHTML = '';
    
    if (!data) {
        el.messagesContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-water" style="font-size: 64px; color: var(--primary); margin-bottom: 16px; opacity: 0.5;"></i>
                <h3 style="margin-bottom: 8px;">Нет сообщений</h3>
                <p style="color: rgba(255,255,255,0.5);">Напишите первое сообщение!</p>
            </div>
        `;
        return;
    }
    
    const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
    
    messages.forEach(msg => {
        const isSent = msg.senderId === currentUser?.uid;
        const time = new Date(msg.timestamp).toLocaleTimeString('ru', {
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        messageEl.dataset.messageId = msg.id;
        
        let reactionsHtml = '';
        if (msg.reactions) {
            reactionsHtml = '<div class="message-reactions">';
            Object.entries(msg.reactions).forEach(([emoji, users]) => {
                const count = Object.keys(users).length;
                const userReacted = users[currentUser?.uid];
                const activeClass = userReacted ? 'active' : '';
                
                reactionsHtml += `
                    <span class="reaction-badge ${activeClass}" onclick="addReaction('${msg.id}', '${emoji}')">
                        ${emoji} <span class="reaction-count">${count}</span>
                    </span>
                `;
            });
            reactionsHtml += '</div>';
        }
        
        let commentsCount = 0;
        if (msg.comments) {
            commentsCount = Object.keys(msg.comments).length;
        }
        
        if (msg.type === 'voice') {
            messageEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button onclick="playVoice('${msg.audioUrl}')" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 16px; border-radius: 30px; cursor: pointer;">
                        <i class="fas fa-play"></i> Слушать
                    </button>
                    <span style="font-size: 12px;">🎤 ${msg.duration || 0} сек</span>
                </div>
                <div class="message-footer">
                    <span class="message-time">${time}</span>
                </div>
                ${reactionsHtml}
                <div class="message-actions">
                    <button class="message-action-btn" onclick="showReactionPanel('${msg.id}', event)">
                        <i class="fas fa-smile"></i> Реакция
                    </button>
                    <button class="message-action-btn" onclick="showComments('${msg.id}')">
                        <i class="fas fa-comment"></i> Комментарии ${commentsCount ? `(${commentsCount})` : ''}
                    </button>
                </div>
            `;
        } else {
            messageEl.innerHTML = `
                <div class="message-content">${escapeHtml(msg.text || '')}</div>
                <div class="message-footer">
                    <span class="message-time">${time}</span>
                </div>
                ${reactionsHtml}
                <div class="message-actions">
                    <button class="message-action-btn" onclick="showReactionPanel('${msg.id}', event)">
                        <i class="fas fa-smile"></i> Реакция
                    </button>
                    <button class="message-action-btn" onclick="showComments('${msg.id}')">
                        <i class="fas fa-comment"></i> Комментарии ${commentsCount ? `(${commentsCount})` : ''}
                    </button>
                </div>
            `;
        }
        
        el.messagesContainer.appendChild(messageEl);
    });
    
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
}

// ========== ПОКАЗ ПАНЕЛИ РЕАКЦИЙ ==========
window.showReactionPanel = function(messageId, event) {
    event.stopPropagation();
    currentMessageForComment = messageId;
    
    const rect = event.target.getBoundingClientRect();
    const panel = el.reactionPanel;
    
    panel.style.display = 'flex';
    panel.style.left = rect.left + 'px';
    panel.style.top = (rect.top - 50) + 'px';
    
    setTimeout(() => {
        document.addEventListener('click', hideReactionPanel);
    }, 100);
};

function hideReactionPanel() {
    el.reactionPanel.style.display = 'none';
    document.removeEventListener('click', hideReactionPanel);
}

// ========== ДОБАВЛЕНИЕ РЕАКЦИИ ==========
window.addReaction = async function(messageId, emoji) {
    if (!currentUser || !currentChat) return;
    
    try {
        const reactionRef = db.ref(`chats/${currentChat}/messages/${messageId}/reactions/${emoji}/${currentUser.uid}`);
        const snapshot = await reactionRef.once('value');
        
        if (snapshot.exists()) {
            await reactionRef.remove();
        } else {
            await reactionRef.set(true);
        }
        
        showNotification(`✅ Реакция ${snapshot.exists() ? 'убрана' : 'добавлена'}`, 'success');
    } catch (error) {
        console.error('Reaction error:', error);
        showNotification('❌ Ошибка добавления реакции', 'error');
    }
};

// ========== ПОКАЗ КОММЕНТАРИЕВ ==========
window.showComments = async function(messageId) {
    if (!currentUser) return;
    
    currentMessageForComment = messageId;
    el.commentsSection.style.display = 'flex';
    
    // Загружаем комментарии
    const commentsRef = db.ref(`chats/${currentChat}/messages/${messageId}/comments`);
    
    // Отключаем старый слушатель если есть
    if (activeListeners[`comments_${messageId}`]) {
        commentsRef.off('value', activeListeners[`comments_${messageId}`]);
    }
    
    const commentsListener = commentsRef.on('value', (snap) => {
        const comments = snap.val();
        renderComments(comments);
    });
    
    activeListeners[`comments_${messageId}`] = commentsListener;
    
    el.commentInput.focus();
};

// ========== ОТОБРАЖЕНИЕ КОММЕНТАРИЕВ ==========
function renderComments(comments) {
    if (!el.commentsList) return;
    
    el.commentsList.innerHTML = '';
    
    if (!comments) {
        el.commentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.3);">Нет комментариев</div>';
        return;
    }
    
    const sortedComments = Object.values(comments).sort((a, b) => a.timestamp - b.timestamp);
    
    sortedComments.forEach(comment => {
        const time = new Date(comment.timestamp).toLocaleTimeString('ru', {
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        commentEl.innerHTML = `
            <div class="comment-header">
                <div class="comment-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-time">${time}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
        `;
        
        el.commentsList.appendChild(commentEl);
    });
    
    el.commentsList.scrollTop = el.commentsList.scrollHeight;
}

// ========== ОТПРАВКА КОММЕНТАРИЯ ==========
async function sendComment() {
    if (!currentUser || !currentMessageForComment || !el.commentInput.value.trim()) return;
    
    const text = el.commentInput.value.trim();
    el.commentInput.value = '';
    
    try {
        await db.ref(`chats/${currentChat}/messages/${currentMessageForComment}/comments`).push({
            text: text,
            author: currentUser.displayName || 'User',
            authorId: currentUser.uid,
            timestamp: Date.now()
        });
        
        showNotification('✅ Комментарий добавлен', 'success');
    } catch (error) {
        console.error('Comment error:', error);
        showNotification('❌ Ошибка добавления комментария', 'error');
    }
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
async function sendMessage() {
    if (!currentUser || !el.messageInput.value.trim()) return;
    
    const text = el.messageInput.value.trim();
    el.messageInput.value = '';
    
    try {
        const messageRef = db.ref(`chats/${currentChat}/messages`).push();
        
        await messageRef.set({
            id: messageRef.key,
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'User',
            timestamp: Date.now(),
            type: 'text'
        });
        
        // Обновляем счетчик постов в канале
        if (currentChannel) {
            const channelRef = db.ref(`channels/${currentChannel}`);
            const snap = await channelRef.once('value');
            const channel = snap.val();
            if (channel) {
                await channelRef.update({
                    posts: (channel.posts || 0) + 1,
                    lastPost: Date.now()
                });
            }
        }
    } catch (error) {
        console.error('Send error:', error);
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
                    
                    await storageReference.put(blob, {
                        contentType: 'audio/webm'
                    });
                    
                    const url = await storageReference.getDownloadURL();
                    
                    const messageRef = db.ref(`chats/${currentChat}/messages`).push();
                    
                    await messageRef.set({
                        id: messageRef.key,
                        type: 'voice',
                        audioUrl: url,
                        senderId: currentUser.uid,
                        senderName: currentUser.displayName || 'User',
                        duration: Math.round(blob.size / 16000),
                        timestamp: Date.now()
                    });
                    
                    showNotification('✅ Голосовое отправлено', 'success');
                    
                } catch (error) {
                    console.error('Upload error:', error);
                    showNotification('❌ Ошибка загрузки', 'error');
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
        console.error('Mic error:', error);
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
        
        el.localVideo.srcObject = localStream;
        await db.ref(`calls/${currentChat}/participants/${currentUser.uid}`).set(true);
        
        el.videoCall.classList.add('active');
        activeCall = true;
        showNotification('✅ Присоединились к звонку', 'success');
        
    } catch (error) {
        console.error('Join error:', error);
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
            session: null,
            lastSeen: Date.now()
        });
    }
    
    if (activeCall) endCall();
    
    await auth.signOut();
    currentUser = null;
    
    cleanupAllListeners();
    
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
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${msg}</span>
    `;
    
    if (type === 'error') notification.style.borderLeftColor = '#f87171';
    if (type === 'success') notification.style.borderLeftColor = '#34d399';
    if (type === 'warning') notification.style.borderLeftColor = '#fbbf24';
    
    el.notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    if (notificationsEnabled && type !== 'info') {
        new Notification('NeoCascade', {
            body: msg,
            icon: 'https://img.icons8.com/fluency/96/000000/chat.png'
        });
    }
}

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

// ========== ЭКРАНИРОВАНИЕ ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
