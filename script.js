import { 
    database, ref, push, onValue, set, get, child, update, remove, query, orderByChild, limitToLast, onChildAdded,
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, googleProvider, 
    onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail,
    storage, storageRef, uploadBytes, getDownloadURL
} from './firebase-config.js';

// ==================== КОНСТАНТЫ ====================
const ADMIN_CREDENTIALS = {
    email: 'admin@ilyasigma.com',
    password: 'JojoTop1',
    name: 'ИльяСигма111'
};

// ==================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ====================
let currentUser = null;
let currentChat = 'general';
let contacts = [];
let groups = [];
let feedMessages = [];
let activeCall = false;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isAdmin = false;
let audioPlayers = {};

// ==================== DOM ЭЛЕМЕНТЫ ====================
const elements = {};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initServiceWorker();
    initEventListeners();
    initMobileFeatures();
    initAudioContext();
    
    // Проверка авторизации
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleUserLogin(user);
        } else {
            showLoginModal();
        }
    });
});

// Инициализация DOM
function initElements() {
    elements.loginModal = document.getElementById('login-modal');
    elements.videoCallContainer = document.getElementById('video-call-container');
    elements.messagesContainer = document.getElementById('messages-container');
    elements.messageInput = document.getElementById('message-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.username = document.getElementById('username');
    elements.userStatus = document.getElementById('user-status');
    elements.userAvatar = document.getElementById('user-avatar');
    elements.chatTitle = document.getElementById('chat-title');
    elements.chatStatus = document.getElementById('chat-status');
    elements.chatList = document.getElementById('chat-list');
    elements.joinCallBtn = document.getElementById('join-call-btn');
    elements.feedContainer = document.getElementById('feed-container');
    elements.feedPanel = document.getElementById('feed-panel');
    elements.adminPanel = document.getElementById('admin-panel');
    elements.sidebar = document.getElementById('sidebar');
    
    // Делаем модалку видимой
    if (elements.loginModal) {
        elements.loginModal.classList.add('show');
    }
}

// Service Worker
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ SW зарегистрирован:', reg.scope))
            .catch(err => console.error('❌ SW ошибка:', err));
        
        // Запрос уведомлений
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ====================
function initEventListeners() {
    // === АВТОРИЗАЦИЯ ===
    const emailLoginBtn = document.getElementById('email-login-btn');
    if (emailLoginBtn) emailLoginBtn.addEventListener('click', handleEmailLogin);
    
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
    
    const emailRegisterBtn = document.getElementById('email-register-btn');
    if (emailRegisterBtn) emailRegisterBtn.addEventListener('click', handleEmailRegister);
    
    const adminLoginBtn = document.getElementById('admin-login-btn');
    if (adminLoginBtn) adminLoginBtn.addEventListener('click', handleAdminLogin);
    
    // === ПЕРЕКЛЮЧЕНИЕ ФОРМ ===
    const showRegister = document.getElementById('show-register');
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
        });
    }
    
    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        });
    }
    
    // === СООБЩЕНИЯ ===
    if (elements.sendBtn) elements.sendBtn.addEventListener('click', sendMessage);
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // === ГОЛОСОВЫЕ ===
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) {
        voiceBtn.addEventListener('mousedown', startVoiceRecording);
        voiceBtn.addEventListener('touchstart', startVoiceRecording);
        voiceBtn.addEventListener('mouseup', stopVoiceRecording);
        voiceBtn.addEventListener('touchend', stopVoiceRecording);
        voiceBtn.addEventListener('mouseleave', stopVoiceRecording);
    }
    
    // === ВЫХОД ===
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    // === ЗВОНКИ ===
    const startCallBtn = document.getElementById('start-group-call');
    if (startCallBtn) startCallBtn.addEventListener('click', startCall);
    
    if (elements.joinCallBtn) elements.joinCallBtn.addEventListener('click', joinCall);
    
    const endCallBtn = document.getElementById('end-call');
    if (endCallBtn) endCallBtn.addEventListener('click', endCall);
    
    const toggleVideoBtn = document.getElementById('toggle-video');
    if (toggleVideoBtn) toggleVideoBtn.addEventListener('click', toggleVideo);
    
    const toggleAudioBtn = document.getElementById('toggle-audio');
    if (toggleAudioBtn) toggleAudioBtn.addEventListener('click', toggleAudio);
    
    // === ГРУППЫ ===
    const createGroupBtn = document.getElementById('create-group-btn');
    if (createGroupBtn) createGroupBtn.addEventListener('click', createGroupChat);
    
    // === ЛЕНТА ===
    const feedBtn = document.getElementById('feed-btn');
    if (feedBtn) feedBtn.addEventListener('click', toggleFeed);
    
    const closeFeedBtn = document.getElementById('close-feed');
    if (closeFeedBtn) closeFeedBtn.addEventListener('click', toggleFeed);
    
    // === АДМИН ПАНЕЛЬ ===
    const closeAdminBtn = document.getElementById('close-admin-panel');
    if (closeAdminBtn) closeAdminBtn.addEventListener('click', toggleAdminPanel);
    
    const sendAnnouncementBtn = document.getElementById('send-announcement-btn');
    if (sendAnnouncementBtn) sendAnnouncementBtn.addEventListener('click', sendAdminAnnouncement);
    
    // === ФИЛЬТРЫ ЛЕНТЫ ===
    document.querySelectorAll('.feed-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.feed-filter').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadFeedMessages(e.target.dataset.filter);
        });
    });
    
    // === ТАБЫ ЛЕНТЫ ===
    document.querySelectorAll('.feed-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            loadFeedMessages(null, e.target.dataset.tab);
        });
    });
    
    // === ВЫБОР ЧАТА ===
    if (elements.chatList) {
        elements.chatList.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem && chatItem.dataset.chat) {
                selectChat(chatItem.dataset.chat);
            }
        });
    }
    
    // === ПОИСК ЧАТОВ ===
    const chatSearch = document.getElementById('chat-search');
    if (chatSearch) {
        chatSearch.addEventListener('input', (e) => {
            filterChats(e.target.value);
        });
    }
    
    // === ИНФО О ЧАТЕ ===
    const chatInfoBtn = document.getElementById('chat-info-btn');
    if (chatInfoBtn) {
        chatInfoBtn.addEventListener('click', showChatInfo);
    }
}

// ==================== GOOGLE ЛОГИН (РАБОЧИЙ) ====================
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        console.log('🔄 Запуск Google авторизации...');
        
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        console.log('✅ Google успех:', user.email);
        
        showNotification(`Добро пожаловать, ${user.displayName || user.email}!`, 'success');
        
    } catch (error) {
        console.error('❌ Google ошибка:', error);
        
        let errorMessage = 'Ошибка входа через Google';
        
        switch(error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = '❌ Окно авторизации закрыто';
                break;
            case 'auth/popup-blocked':
                errorMessage = '❌ Браузер заблокировал окно. Разрешите всплывающие окна';
                break;
            case 'auth/unauthorized-domain':
                errorMessage = '❌ Домен не авторизован в Firebase Console';
                break;
            case 'auth/account-exists-with-different-credential':
                errorMessage = '❌ Аккаунт уже существует с другим методом входа';
                break;
            default:
                errorMessage = `❌ Ошибка: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ==================== EMAIL ЛОГИН ====================
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        showNotification('❌ Заполните все поля', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('✅ Вход выполнен успешно!', 'success');
        
    } catch (error) {
        console.error('Email login error:', error);
        
        let message = 'Ошибка входа';
        if (error.code === 'auth/user-not-found') message = '❌ Пользователь не найден';
        if (error.code === 'auth/wrong-password') message = '❌ Неверный пароль';
        if (error.code === 'auth/invalid-email') message = '❌ Неверный формат email';
        
        showNotification(message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ==================== РЕГИСТРАЦИЯ ====================
async function handleEmailRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) {
        showNotification('❌ Заполните все поля', 'error');
        return;
    }
    
    if (name.length < 2) {
        showNotification('❌ Имя должно быть от 2 символов', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('❌ Пароль должен быть от 6 символов', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, {
            displayName: name,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`
        });
        
        await set(ref(database, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            name: name,
            photoURL: user.photoURL,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now(),
            isAdmin: false
        });
        
        showNotification('✅ Регистрация успешна!', 'success');
        
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        
    } catch (error) {
        console.error('Register error:', error);
        
        let message = 'Ошибка регистрации';
        if (error.code === 'auth/email-already-in-use') message = '❌ Email уже используется';
        if (error.code === 'auth/weak-password') message = '❌ Слабый пароль';
        
        showNotification(message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ==================== АДМИН ЛОГИН ====================
async function handleAdminLogin() {
    const btn = document.getElementById('admin-login-btn');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        let userCredential;
        
        try {
            userCredential = await signInWithEmailAndPassword(auth, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                userCredential = await createUserWithEmailAndPassword(auth, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
            } else {
                throw error;
            }
        }
        
        const user = userCredential.user;
        
        await updateProfile(user, {
            displayName: ADMIN_CREDENTIALS.name,
            photoURL: 'https://img.icons8.com/color/96/000000/administrator-male.png'
        });
        
        await set(ref(database, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            name: ADMIN_CREDENTIALS.name,
            photoURL: 'https://img.icons8.com/color/96/000000/administrator-male.png',
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now(),
            isAdmin: true
        });
        
        showNotification('👑 Добро пожаловать, Администратор!', 'success');
        
    } catch (error) {
        console.error('Admin login error:', error);
        showNotification('❌ Ошибка входа администратора', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ==================== ОБРАБОТКА ВХОДА ====================
async function handleUserLogin(firebaseUser) {
    console.log('👤 Пользователь вошел:', firebaseUser.email);
    
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    let userData;
    
    if (snapshot.exists()) {
        userData = snapshot.val();
    } else {
        userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || firebaseUser.email.split('@')[0])}&background=3B82F6&color=fff`,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now(),
            isAdmin: firebaseUser.email === ADMIN_CREDENTIALS.email
        };
        
        await set(userRef, userData);
    }
    
    await update(userRef, {
        online: true,
        lastSeen: Date.now()
    });
    
    currentUser = {
        ...userData,
        firebaseUser
    };
    
    isAdmin = userData.isAdmin === true;
    
    // UI обновление
    hideLoginModal();
    updateUserProfile();
    enableChat();
    setupPresence();
    
    // Загрузка данных
    await loadContacts();
    await loadGroups();
    await loadMessages();
    
    // Админ фичи
    if (isAdmin) {
        setupAdminFeatures();
        setupAdminChannel();
    }
    
    // Лента
    loadFeedMessages();
    
    showNotification(`👋 С возвращением, ${currentUser.name}!`, 'success');
}

// ==================== ОБНОВЛЕНИЕ ПРОФИЛЯ ====================
function updateUserProfile() {
    if (!currentUser) return;
    
    elements.username.textContent = currentUser.name;
    elements.userStatus.textContent = 'в сети';
    elements.userStatus.classList.remove('offline');
    elements.userStatus.classList.add('online');
    
    if (currentUser.photoURL) {
        elements.userAvatar.innerHTML = `<img src="${currentUser.photoURL}" alt="${currentUser.name}">`;
    }
    
    if (isAdmin) {
        elements.username.innerHTML += ' <i class="fas fa-crown" style="color:#FFD700; font-size: 14px;"></i>';
    }
}

// ==================== ВКЛЮЧЕНИЕ ЧАТА ====================
function enableChat() {
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
    elements.joinCallBtn.disabled = false;
    elements.messageInput.placeholder = '💬 Напишите сообщение...';
    
    document.querySelector('.container').classList.add('show');
    hideLoginModal();
}

// ==================== ПОКАЗ/СКРЫТИЕ МОДАЛКИ ====================
function showLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.classList.add('show');
    }
    document.querySelector('.container')?.classList.remove('show');
}

function hideLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.classList.remove('show');
    }
}

// ==================== СИСТЕМА ПРИСУТСТВИЯ ====================
function setupPresence() {
    if (!currentUser) return;
    
    const userStatusRef = ref(database, `users/${currentUser.uid}/online`);
    const userLastSeenRef = ref(database, `users/${currentUser.uid}/lastSeen`);
    
    const connectedRef = ref(database, '.info/connected');
    
    onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            set(userStatusRef, true);
            set(userLastSeenRef, Date.now());
            
            const onDisconnectRef = ref(database, `users/${currentUser.uid}/online`);
            set(onDisconnectRef, false);
        }
    });
}

// ==================== ЗАГРУЗКА КОНТАКТОВ ====================
async function loadContacts() {
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        contacts = [];
        
        if (data) {
            Object.entries(data).forEach(([userId, userData]) => {
                if (userId === currentUser?.uid) return;
                if (!userData.name) return;
                
                contacts.push({
                    id: userId,
                    ...userData
                });
            });
        }
        
        renderContacts();
    });
}

function renderContacts() {
    let contactsHTML = '';
    
    contacts.forEach(contact => {
        const avatar = contact.photoURL || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=10B981&color=fff`;
        
        contactsHTML += `
            <div class="chat-item" data-chat="${contact.id}">
                <div class="chat-icon">
                    <img src="${avatar}" alt="${contact.name}">
                </div>
                <div class="chat-info">
                    <div class="chat-name">${contact.name}</div>
                    <div class="chat-preview ${contact.online ? 'online' : 'offline'}">
                        ${contact.online ? '🟢 в сети' : '⚫ не в сети'}
                    </div>
                </div>
                <button class="btn-call-mini" data-chat="${contact.id}">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        `;
    });
    
    // Сохраняем общий чат
    const generalChat = document.querySelector('.chat-item[data-chat="general"]')?.outerHTML || '';
    
    if (elements.chatList) {
        elements.chatList.innerHTML = generalChat + contactsHTML;
    }
}

// ==================== ЗАГРУЗКА ГРУПП ====================
async function loadGroups() {
    if (!currentUser) return;
    
    const groupsRef = ref(database, 'groups');
    
    onValue(groupsRef, (snapshot) => {
        const data = snapshot.val();
        groups = [];
        
        if (data) {
            Object.entries(data).forEach(([groupId, groupData]) => {
                if (groupData.members && groupData.members[currentUser.uid]) {
                    groups.push({
                        id: groupId,
                        ...groupData
                    });
                }
            });
        }
        
        renderGroups();
    });
}

function renderGroups() {
    let groupsHTML = '';
    
    groups.forEach(group => {
        groupsHTML += `
            <div class="chat-item" data-chat="${group.id}">
                <div class="chat-icon" style="background: linear-gradient(135deg, #8B5CF6, #7C3AED);">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">${group.name}</div>
                    <div class="chat-preview">${Object.keys(group.members || {}).length} участников</div>
                </div>
                <button class="btn-call-mini" data-chat="${group.id}">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        `;
    });
    
    if (elements.chatList) {
        elements.chatList.insertAdjacentHTML('beforeend', groupsHTML);
    }
}

// ==================== СОЗДАНИЕ ГРУППЫ ====================
async function createGroupChat() {
    if (!currentUser) return;
    
    const groupName = prompt('Введите название группы:');
    if (!groupName || groupName.trim().length < 2) return;
    
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        const groupRef = ref(database, `groups/${groupId}`);
        
        await set(groupRef, {
            id: groupId,
            name: groupName.trim(),
            description: 'Групповой чат',
            createdBy: currentUser.uid,
            createdByName: currentUser.name,
            createdAt: Date.now(),
            type: 'group',
            members: {
                [currentUser.uid]: {
                    name: currentUser.name,
                    role: 'admin',
                    joinedAt: Date.now()
                }
            }
        });
        
        const chatRef = ref(database, `chats/${groupId}`);
        await set(chatRef, {
            id: groupId,
            name: groupName.trim(),
            type: 'group',
            createdBy: currentUser.uid,
            createdAt: Date.now()
        });
        
        showNotification(`✅ Группа "${groupName}" создана!`, 'success');
        
    } catch (error) {
        console.error('Group creation error:', error);
        showNotification('❌ Ошибка создания группы', 'error');
    }
}

// ==================== ВЫБОР ЧАТА ====================
function selectChat(chatId) {
    if (!chatId) return;
    
    currentChat = chatId;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedChat = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (selectedChat) {
        selectedChat.classList.add('active');
    }
    
    // Обновляем заголовок
    if (chatId === 'general') {
        elements.chatTitle.textContent = 'Общий чат';
        elements.chatStatus.textContent = '🌐 Глобальный чат';
        document.querySelector('#current-chat-avatar').innerHTML = '<i class="fas fa-globe"></i>';
    } else if (chatId === 'admin_channel') {
        elements.chatTitle.textContent = '📢 Админ-канал';
        elements.chatStatus.textContent = '👑 Только для админов';
        document.querySelector('#current-chat-avatar').innerHTML = '<i class="fas fa-bullhorn" style="color: #FFD700;"></i>';
    } else {
        const contact = contacts.find(c => c.id === chatId);
        if (contact) {
            elements.chatTitle.textContent = contact.name;
            elements.chatStatus.textContent = contact.online ? '🟢 в сети' : '⚫ не в сети';
            document.querySelector('#current-chat-avatar').innerHTML = `<img src="${contact.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=10B981&color=fff`}" alt="${contact.name}">`;
        }
        
        const group = groups.find(g => g.id === chatId);
        if (group) {
            elements.chatTitle.textContent = group.name;
            elements.chatStatus.textContent = `👥 ${Object.keys(group.members || {}).length} участников`;
            document.querySelector('#current-chat-avatar').innerHTML = '<i class="fas fa-users"></i>';
        }
    }
    
    loadMessages();
}

// ==================== ЗАГРУЗКА СООБЩЕНИЙ ====================
function loadMessages() {
    if (!currentUser) return;
    
    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(50));
    
    onValue(messagesQuery, (snapshot) => {
        const data = snapshot.val();
        
        if (elements.messagesContainer) {
            elements.messagesContainer.innerHTML = '';
        }
        
        if (!data) {
            showWelcomeMessage();
            return;
        }
        
        const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
        
        messages.forEach(message => {
            renderMessage(message);
        });
        
        scrollToBottom();
    });
}

function showWelcomeMessage() {
    if (!elements.messagesContainer) return;
    
    elements.messagesContainer.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">
                <i class="fas fa-water"></i>
            </div>
            <h2>Добро пожаловать!</h2>
            <p>Чат "${elements.chatTitle?.textContent || 'NeoCascade'}"</p>
            <p class="hint">Напишите первое сообщение ✨</p>
        </div>
    `;
}

function renderMessage(message) {
    if (!elements.messagesContainer) return;
    
    const welcome = elements.messagesContainer.querySelector('.welcome');
    if (welcome) welcome.remove();
    
    const isSent = message.senderId === currentUser?.uid;
    const time = new Date(message.timestamp).toLocaleTimeString('ru', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    if (message.type === 'voice') {
        messageElement.innerHTML = `
            <div class="voice-message">
                <button class="btn-play" onclick="window.NeoCascade.playVoice('${message.audioUrl}')">
                    <i class="fas fa-play"></i>
                </button>
                <div class="voice-wave"></div>
                <span class="voice-duration">${message.duration || 0} сек</span>
            </div>
            <div class="message-time">${time}</div>
        `;
    } else if (message.type === 'announcement') {
        messageElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-bullhorn" style="color: #FFD700;"></i>
                <div class="message-content" style="font-weight: 600;">${escapeHtml(message.text)}</div>
            </div>
            <div class="message-time">${time}</div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-content">${escapeHtml(message.text || '')}</div>
            <div class="message-time">${time}</div>
        `;
    }
    
    elements.messagesContainer.appendChild(messageElement);
}

// ==================== ОТПРАВКА СООБЩЕНИЯ ====================
async function sendMessage() {
    if (!currentUser || !elements.messageInput) return;
    
    const text = elements.messageInput.value.trim();
    if (!text) return;
    
    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    const newMessageRef = push(messagesRef);
    
    try {
        await set(newMessageRef, {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            timestamp: Date.now(),
            type: 'text'
        });
        
        elements.messageInput.value = '';
        elements.messageInput.focus();
        
    } catch (error) {
        console.error('Send message error:', error);
        showNotification('❌ Ошибка отправки', 'error');
    }
}

// ==================== ГОЛОСОВЫЕ СООБЩЕНИЯ ====================
async function startVoiceRecording(e) {
    e.preventDefault();
    
    if (isRecording || !currentUser || !navigator.mediaDevices) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            await uploadVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start(100);
        isRecording = true;
        
        document.getElementById('voice-btn')?.classList.add('recording');
        showRecordingIndicator();
        
        setTimeout(() => {
            if (isRecording) stopVoiceRecording();
        }, 120000);
        
    } catch (error) {
        console.error('Voice recording error:', error);
        showNotification('❌ Нет доступа к микрофону', 'error');
    }
}

function stopVoiceRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('voice-btn')?.classList.remove('recording');
        hideRecordingIndicator();
    }
}

function showRecordingIndicator() {
    let indicator = document.getElementById('recording-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'recording-indicator';
        document.body.appendChild(indicator);
    }
    indicator.innerHTML = `
        <div class="recording-pulse"></div>
        <span>🎙️ Запись... Отпустите кнопку</span>
    `;
}

function hideRecordingIndicator() {
    const indicator = document.getElementById('recording-indicator');
    if (indicator) indicator.remove();
}

async function uploadVoiceMessage(audioBlob) {
    try {
        const fileName = `voice_${Date.now()}_${currentUser.uid}.webm`;
        const voiceRef = storageRef(storage, `voice_messages/${currentChat}/${fileName}`);
        
        await uploadBytes(voiceRef, audioBlob);
        const downloadURL = await getDownloadURL(voiceRef);
        
        const messagesRef = ref(database, `chats/${currentChat}/messages`);
        const newMessageRef = push(messagesRef);
        
        await set(newMessageRef, {
            type: 'voice',
            audioUrl: downloadURL,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            duration: Math.round(audioBlob.size / 16000),
            timestamp: Date.now()
        });
        
        showNotification('🎤 Голосовое отправлено!', 'success');
        
    } catch (error) {
        console.error('Voice upload error:', error);
        showNotification('❌ Ошибка загрузки', 'error');
    }
}

// ==================== АУДИО КОНТЕКСТ ====================
function initAudioContext() {
    window.NeoCascade = window.NeoCascade || {};
    window.NeoCascade.playVoice = (url) => {
        if (audioPlayers[url]) {
            audioPlayers[url].pause();
            delete audioPlayers[url];
        }
        
        const audio = new Audio(url);
        audioPlayers[url] = audio;
        audio.play().catch(() => {});
    };
}

// ==================== ЛЕНТА АКТИВНОСТИ ====================
function toggleFeed() {
    if (elements.feedPanel) {
        elements.feedPanel.classList.toggle('open');
        if (elements.feedPanel.classList.contains('open')) {
            loadFeedMessages();
        }
    }
}

function loadFeedMessages(filter = 'all', tab = 'latest') {
    if (!elements.feedContainer) return;
    
    elements.feedContainer.innerHTML = `
        <div class="feed-loading">
            <div class="quantum-loader"></div>
            <span>Квантовая загрузка...</span>
        </div>
    `;
    
    const messagesRef = ref(database, 'chats');
    
    onValue(messagesRef, (snapshot) => {
        const chats = snapshot.val();
        feedMessages = [];
        
        if (chats) {
            Object.entries(chats).forEach(([chatId, chat]) => {
                if (chat.messages) {
                    Object.entries(chat.messages).forEach(([msgId, msg]) => {
                        if (msg.type !== 'system' && msg.type !== 'call' && msg.senderId) {
                            feedMessages.push({
                                id: msgId,
                                chatId: chatId,
                                chatName: getChatName(chatId, chat),
                                ...msg,
                                comments: msg.comments || {},
                                reactions: msg.reactions || {}
                            });
                        }
                    });
                }
            });
        }
        
        // Фильтрация
        let filtered = feedMessages;
        
        if (filter === 'trending') {
            filtered = feedMessages.filter(msg => 
                Object.keys(msg.reactions || {}).length > 1 || 
                Object.keys(msg.comments || {}).length > 0
            );
        } else if (filter === 'media') {
            filtered = feedMessages.filter(msg => 
                msg.type === 'voice' || msg.type === 'image' || msg.type === 'video'
            );
        } else if (filter === 'my' && currentUser) {
            filtered = feedMessages.filter(msg => msg.senderId === currentUser.uid);
        }
        
        // Сортировка
        if (tab === 'latest') {
            filtered.sort((a, b) => b.timestamp - a.timestamp);
        } else if (tab === 'popular') {
            filtered.sort((a, b) => {
                const reactionsA = Object.keys(a.reactions || {}).length;
                const reactionsB = Object.keys(b.reactions || {}).length;
                return reactionsB - reactionsA;
            });
        } else if (tab === 'following') {
            filtered = filtered.filter(msg => 
                contacts.some(c => c.id === msg.senderId)
            );
        }
        
        filtered = filtered.slice(0, 30);
        
        renderFeedMessages(filtered);
        
    }, { onlyOnce: true });
}

function getChatName(chatId, chat) {
    if (chatId === 'general') return 'Общий чат';
    if (chatId === 'admin_channel') return 'Админ-канал';
    if (chat && chat.name) return chat.name;
    
    const contact = contacts.find(c => c.id === chatId);
    if (contact) return contact.name;
    
    const group = groups.find(g => g.id === chatId);
    if (group) return group.name;
    
    return 'Чат';
}

function renderFeedMessages(messages) {
    if (!elements.feedContainer) return;
    
    if (messages.length === 0) {
        elements.feedContainer.innerHTML = `
            <div class="feed-empty">
                <div class="feed-empty-icon">
                    <i class="fas fa-rss"></i>
                </div>
                <h4>Лента пуста</h4>
                <p>Напишите что-нибудь, чтобы оно появилось здесь ✨</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    messages.forEach(msg => {
        const time = formatTime(msg.timestamp);
        const reactions = msg.reactions || {};
        const comments = msg.comments || {};
        
        const reactionCounts = {};
        Object.values(reactions).forEach(r => {
            reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
        });
        
        html += `
            <div class="feed-item glass" data-message-id="${msg.id}" data-chat-id="${msg.chatId}">
                <div class="feed-item-header">
                    <div class="feed-avatar">
                        <img src="${getAvatarUrl(msg.senderName, msg.senderId)}" alt="${msg.senderName}">
                    </div>
                    <div class="feed-meta">
                        <span class="feed-author">${msg.senderName}</span>
                        <span class="feed-time">${time}</span>
                        <span class="feed-source">в ${msg.chatName}</span>
                    </div>
                </div>
                
                <div class="feed-content" onclick="window.NeoCascade?.selectChat('${msg.chatId}')">
                    ${formatFeedContent(msg)}
                </div>
                
                <div class="feed-actions">
                    <button class="feed-action-btn" onclick="window.NeoCascade?.toggleReaction('${msg.chatId}', '${msg.id}', 'like')">
                        <i class="fas fa-heart ${reactionCounts['like'] ? 'active' : ''}"></i>
                        <span>${reactionCounts['like'] || 0}</span>
                    </button>
                    
                    <button class="feed-action-btn" onclick="window.NeoCascade?.toggleReaction('${msg.chatId}', '${msg.id}', 'laugh')">
                        <i class="fas fa-face-smile ${reactionCounts['laugh'] ? 'active' : ''}"></i>
                        <span>${reactionCounts['laugh'] || 0}</span>
                    </button>
                    
                    <button class="feed-action-btn" onclick="window.NeoCascade?.toggleReaction('${msg.chatId}', '${msg.id}', 'wow')">
                        <i class="fas fa-face-surprise ${reactionCounts['wow'] ? 'active' : ''}"></i>
                        <span>${reactionCounts['wow'] || 0}</span>
                    </button>
                    
                    <button class="feed-action-btn comment-btn" onclick="window.NeoCascade?.showCommentInput('${msg.chatId}', '${msg.id}', this)">
                        <i class="fas fa-comment"></i>
                        <span>${Object.keys(comments).length || 0}</span>
                    </button>
                    
                    <button class="feed-action-btn share-btn" onclick="window.NeoCascade?.shareMessage('${msg.chatId}', '${msg.id}')">
                        <i class="fas fa-share"></i>
                    </button>
                </div>
                
                <div class="feed-comments" id="comments-${msg.id}">
                    ${renderComments(comments)}
                </div>
                
                <div class="comment-input-container" id="comment-input-${msg.id}" style="display: none;">
                    <input type="text" placeholder="Напишите комментарий..." class="comment-input-field">
                    <button class="comment-send-btn" onclick="window.NeoCascade?.sendComment('${msg.chatId}', '${msg.id}', this)">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    elements.feedContainer.innerHTML = html;
}

function formatFeedContent(msg) {
    if (msg.type === 'voice') {
        return `
            <div class="feed-voice">
                <i class="fas fa-microphone"></i>
                <span>🎤 Голосовое сообщение</span>
                <span class="voice-duration">${msg.duration || 0} сек</span>
                <button class="btn-play-small" onclick="window.NeoCascade?.playVoice('${msg.audioUrl}')">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `;
    }
    
    if (msg.type === 'announcement') {
        return `
            <div class="feed-announcement">
                <i class="fas fa-bullhorn" style="color: #FFD700;"></i>
                <p style="font-weight: 600;">📢 ${escapeHtml(msg.text || '')}</p>
            </div>
        `;
    }
    
    return `<p>${escapeHtml(msg.text || '')}</p>`;
}

function getAvatarUrl(name, id) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=3B82F6&color=fff`;
}

function renderComments(comments) {
    if (!comments || Object.keys(comments).length === 0) return '';
    
    let html = '<div class="comments-list">';
    
    Object.values(comments)
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(comment => {
            const time = formatTime(comment.timestamp, true);
            
            html += `
                <div class="comment-item">
                    <img src="${getAvatarUrl(comment.author, comment.authorId)}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${comment.author}</span>
                            <span class="comment-time">${time}</span>
                        </div>
                        <div class="comment-text">${escapeHtml(comment.text || '')}</div>
                    </div>
                </div>
            `;
        });
    
    html += '</div>';
    return html;
}

// ==================== РЕАКЦИИ ====================
async function toggleReaction(chatId, messageId, reactionType) {
    if (!currentUser) {
        showNotification('❌ Войдите, чтобы ставить реакции', 'error');
        return;
    }
    
    const reactionRef = ref(database, `chats/${chatId}/messages/${messageId}/reactions/${currentUser.uid}`);
    const snapshot = await get(reactionRef);
    
    try {
        if (snapshot.exists()) {
            await remove(reactionRef);
        } else {
            await set(reactionRef, {
                type: reactionType,
                userId: currentUser.uid,
                userName: currentUser.name,
                timestamp: Date.now()
            });
        }
        
        loadFeedMessages();
        
    } catch (error) {
        console.error('Reaction error:', error);
        showNotification('❌ Ошибка', 'error');
    }
}

// ==================== КОММЕНТАРИИ ====================
function showCommentInput(chatId, messageId, btn) {
    const container = document.getElementById(`comment-input-${messageId}`);
    if (!container) return;
    
    document.querySelectorAll('.comment-input-container').forEach(el => {
        if (el.id !== `comment-input-${messageId}`) {
            el.style.display = 'none';
        }
    });
    
    container.style.display = container.style.display === 'none' ? 'flex' : 'none';
    
    if (container.style.display === 'flex') {
        container.querySelector('.comment-input-field')?.focus();
    }
}

async function sendComment(chatId, messageId, btn) {
    if (!currentUser) {
        showNotification('❌ Войдите, чтобы комментировать', 'error');
        return;
    }
    
    const container = btn.closest('.comment-input-container');
    const input = container.querySelector('.comment-input-field');
    const text = input.value.trim();
    
    if (!text) return;
    
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const commentRef = ref(database, `chats/${chatId}/messages/${messageId}/comments/${commentId}`);
    
    try {
        await set(commentRef, {
            id: commentId,
            text: text,
            author: currentUser.name,
            authorId: currentUser.uid,
            timestamp: Date.now()
        });
        
        input.value = '';
        container.style.display = 'none';
        loadFeedMessages();
        
        showNotification('💬 Комментарий добавлен', 'success');
        
    } catch (error) {
        console.error('Comment error:', error);
        showNotification('❌ Ошибка', 'error');
    }
}

// ==================== ШЕРИНГ ====================
async function shareMessage(chatId, messageId) {
    if (!currentUser) return;
    
    const msgRef = ref(database, `chats/${chatId}/messages/${messageId}`);
    const snapshot = await get(msgRef);
    
    if (!snapshot.exists()) return;
    
    const message = snapshot.val();
    const shareText = `"${message.text || 'Голосовое сообщение'}" — ${message.senderName} в NeoCascade`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'NeoCascade',
                text: shareText,
                url: window.location.href
            });
            showNotification('✅ Поделились!', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                copyToClipboard(shareText);
            }
        }
    } else {
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Скопировано!', 'success');
    }).catch(() => {
        showNotification('❌ Ошибка копирования', 'error');
    });
}

// ==================== АДМИН ФИЧИ ====================
function setupAdminFeatures() {
    const adminPanelBtn = document.createElement('button');
    adminPanelBtn.className = 'btn-icon';
    adminPanelBtn.id = 'admin-panel-btn';
    adminPanelBtn.innerHTML = '<i class="fas fa-crown" style="color: #FFD700;"></i>';
    adminPanelBtn.title = 'Админ панель';
    adminPanelBtn.addEventListener('click', toggleAdminPanel);
    
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
        userProfile.appendChild(adminPanelBtn);
    }
}

function setupAdminChannel() {
    const adminChannelHTML = `
        <div class="chat-item" data-chat="admin_channel">
            <div class="chat-icon" style="background: linear-gradient(135deg, #FFD700, #FFA500);">
                <i class="fas fa-bullhorn"></i>
            </div>
            <div class="chat-info">
                <div class="chat-name">📢 Админ-канал</div>
                <div class="chat-preview">Важные объявления</div>
            </div>
        </div>
    `;
    
    if (elements.chatList) {
        elements.chatList.insertAdjacentHTML('afterbegin', adminChannelHTML);
    }
    
    const adminChannelRef = ref(database, 'chats/admin_channel');
    get(adminChannelRef).then(snapshot => {
        if (!snapshot.exists()) {
            set(adminChannelRef, {
                name: '📢 Админ-канал',
                description: 'Канал для важных объявлений',
                type: 'admin',
                createdBy: currentUser?.uid,
                createdAt: Date.now()
            });
        }
    });
}

function toggleAdminPanel() {
    if (elements.adminPanel) {
        elements.adminPanel.classList.toggle('open');
        
        if (elements.adminPanel.classList.contains('open')) {
            loadAdminStats();
        }
    }
}

async function sendAdminAnnouncement() {
    const text = document.getElementById('admin-announcement')?.value.trim();
    if (!text) return;
    
    try {
        // В админ канал
        const adminMessagesRef = ref(database, 'chats/admin_channel/messages');
        const adminMsgRef = push(adminMessagesRef);
        
        await set(adminMsgRef, {
            type: 'announcement',
            text: text,
            senderId: currentUser?.uid,
            senderName: '📢 АДМИНИСТРАЦИЯ',
            isImportant: true,
            timestamp: Date.now()
        });
        
        // В общий чат
        const generalMessagesRef = ref(database, 'chats/general/messages');
        const generalMsgRef = push(generalMessagesRef);
        
        await set(generalMsgRef, {
            type: 'announcement',
            text: `📢 ВАЖНО: ${text}`,
            senderId: currentUser?.uid,
            senderName: '📢 АДМИНИСТРАЦИЯ',
            isImportant: true,
            timestamp: Date.now()
        });
        
        document.getElementById('admin-announcement').value = '';
        showNotification('📢 Объявление отправлено!', 'success');
        
        // Уведомление
        if (Notification.permission === 'granted') {
            new Notification('📢 NeoCascade', {
                body: text,
                icon: 'https://img.icons8.com/fluency/96/000000/chat.png'
            });
        }
        
    } catch (error) {
        console.error('Announcement error:', error);
        showNotification('❌ Ошибка отправки', 'error');
    }
}

function loadAdminStats() {
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        const totalUsers = users ? Object.keys(users).length : 0;
        
        const totalEl = document.getElementById('total-users');
        if (totalEl) totalEl.textContent = totalUsers;
        
        const onlineList = document.getElementById('online-users-list');
        if (onlineList && users) {
            onlineList.innerHTML = '';
            
            Object.values(users).forEach(user => {
                if (user.online) {
                    const userEl = document.createElement('div');
                    userEl.className = 'user-item';
                    userEl.innerHTML = `
                        <span>${user.name || 'User'}</span>
                        <span style="color: #10B981;">🟢 онлайн</span>
                    `;
                    onlineList.appendChild(userEl);
                }
            });
        }
    });
    
    // Сообщения сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const messagesRef = ref(database, 'chats');
    onValue(messagesRef, (snapshot) => {
        const chats = snapshot.val();
        let messagesToday = 0;
        
        if (chats) {
            Object.values(chats).forEach(chat => {
                if (chat.messages) {
                    Object.values(chat.messages).forEach(msg => {
                        if (msg.timestamp >= today.getTime()) {
                            messagesToday++;
                        }
                    });
                }
            });
        }
        
        const messagesEl = document.getElementById('messages-today');
        if (messagesEl) messagesEl.textContent = messagesToday;
    });
}

// ==================== ВИДЕОЗВОНКИ ====================
async function startCall() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = stream;
        }
        
        await set(ref(database, `calls/${currentChat}`), {
            active: true,
            startedBy: currentUser?.uid,
            startedAt: Date.now(),
            participants: {
                [currentUser?.uid]: true
            }
        });
        
        elements.videoCallContainer?.classList.add('active');
        activeCall = true;
        
        showNotification('🎥 Звонок начат', 'success');
        
    } catch (error) {
        console.error('Call error:', error);
        showNotification('❌ Нет доступа к камере/микрофону', 'error');
    }
}

async function joinCall() {
    if (activeCall) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = stream;
        }
        
        await set(ref(database, `calls/${currentChat}/participants/${currentUser?.uid}`), true);
        
        elements.videoCallContainer?.classList.add('active');
        activeCall = true;
        
        showNotification('🔊 Вы присоединились', 'success');
        
    } catch (error) {
        console.error('Join call error:', error);
        showNotification('❌ Ошибка подключения', 'error');
    }
}

function endCall() {
    const localVideo = document.getElementById('local-video');
    if (localVideo && localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(track => track.stop());
    }
    
    set(ref(database, `calls/${currentChat}`), null);
    
    elements.videoCallContainer?.classList.remove('active');
    activeCall = false;
    
    showNotification('📴 Звонок завершен', 'info');
}

function toggleVideo() {
    const localVideo = document.getElementById('local-video');
    if (localVideo && localVideo.srcObject) {
        const videoTrack = localVideo.srcObject.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('toggle-video');
            if (btn) {
                btn.innerHTML = videoTrack.enabled ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
            }
        }
    }
}

function toggleAudio() {
    const localVideo = document.getElementById('local-video');
    if (localVideo && localVideo.srcObject) {
        const audioTrack = localVideo.srcObject.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('toggle-audio');
            if (btn) {
                btn.innerHTML = audioTrack.enabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
            }
        }
    }
}

// ==================== ВЫХОД ====================
async function handleLogout() {
    try {
        if (currentUser) {
            await set(ref(database, `users/${currentUser.uid}/online`), false);
            await set(ref(database, `users/${currentUser.uid}/lastSeen`), Date.now());
        }
        
        if (activeCall) {
            endCall();
        }
        
        await signOut(auth);
        
        currentUser = null;
        isAdmin = false;
        
        resetUI();
        showLoginModal();
        
        showNotification('👋 До свидания!', 'success');
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('❌ Ошибка выхода', 'error');
    }
}

function resetUI() {
    elements.username.textContent = 'Гость';
    elements.userStatus.textContent = 'не в сети';
    elements.userStatus.classList.remove('online');
    elements.userStatus.classList.add('offline');
    elements.userAvatar.innerHTML = '<i class="fas fa-user"></i>';
    elements.chatTitle.textContent = 'Общий чат';
    elements.chatStatus.textContent = 'войдите в систему';
    
    if (elements.messagesContainer) {
        elements.messagesContainer.innerHTML = `
            <div class="welcome">
                <div class="welcome-icon">
                    <i class="fas fa-water"></i>
                </div>
                <h2>NeoCascade Messenger</h2>
                <p>Квантовое пространство общения</p>
                <p class="hint">Войдите, чтобы начать</p>
            </div>
        `;
    }
    
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;
    elements.joinCallBtn.disabled = true;
    elements.messageInput.placeholder = 'Войдите, чтобы отправлять сообщения';
    elements.messageInput.value = '';
    
    document.querySelector('.container')?.classList.remove('show');
    
    if (elements.chatList) {
        elements.chatList.innerHTML = `
            <div class="chat-item active" data-chat="general">
                <div class="chat-icon" style="background: linear-gradient(135deg, #3B82F6, #1E40AF);">
                    <i class="fas fa-globe"></i>
                </div>
                <div class="chat-info">
                    <div class="chat-name">Общий чат</div>
                    <div class="chat-preview">Добро пожаловать!</div>
                </div>
                <button class="btn-call-mini" data-chat="general">
                    <i class="fas fa-phone"></i>
                </button>
            </div>
        `;
    }
}

// ==================== МОБИЛЬНЫЕ ФИЧИ ====================
function initMobileFeatures() {
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const threshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > threshold) {
            if (diff < 0 && window.innerWidth <= 768) {
                // Свайп вправо - открыть сайдбар
                elements.sidebar?.classList.add('mobile-open');
            } else if (diff > 0 && window.innerWidth <= 768) {
                // Свайп влево - закрыть сайдбар
                elements.sidebar?.classList.remove('mobile-open');
            }
        }
    }
    
    // Закрыть сайдбар при клике вне его
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.sidebar') && !e.target.closest('.btn-icon')) {
                elements.sidebar?.classList.remove('mobile-open');
            }
        }
    });
}

function filterChats(searchTerm) {
    if (!searchTerm) {
        document.querySelectorAll('.chat-item').forEach(item => {
            item.style.display = 'flex';
        });
        return;
    }
    
    const term = searchTerm.toLowerCase();
    
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
        if (name.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function showChatInfo() {
    showNotification(`💬 Текущий чат: ${elements.chatTitle?.textContent}`, 'info');
}

// ==================== УТИЛИТЫ ====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification glass';
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    notification.innerHTML = `${icon} ${message}`;
    
    if (type === 'error') {
        notification.style.borderLeft = '4px solid var(--danger)';
    } else if (type === 'success') {
        notification.style.borderLeft = '4px solid var(--secondary)';
    } else {
        notification.style.borderLeft = '4px solid var(--primary)';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function scrollToBottom() {
    if (elements.messagesContainer) {
        elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
    }
}

function formatTime(timestamp, short = false) {
    const date = new Date(timestamp);
    
    if (short) {
        return date.toLocaleTimeString('ru', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    
    return date.toLocaleDateString('ru', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== ЭКСПОРТ В WINDOW ====================
window.NeoCascade = {
    selectChat,
    toggleReaction,
    showCommentInput,
    sendComment,
    shareMessage,
    playVoice: (url) => {
        const audio = new Audio(url);
        audio.play().catch(() => {});
    }
};

console.log('✅ NeoCascade полностью загружен!');
