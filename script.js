import { 
    database, ref, push, onValue, set, get, child, 
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPopup, googleProvider, onAuthStateChanged, signOut, updateProfile 
} from './firebase-config.js';

// Глобальные переменные
let currentUser = null;
let currentChat = 'general';
let contacts = [];
let videoCallActive = false;
let callTimer = null;
let callStartTime = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Проверяем состояние аутентификации
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await handleUserLogin(user);
        } else {
            showAuthModal();
        }
    });
}

function setupEventListeners() {
    // Навигация по формам
    document.getElementById('switch-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthForm('register');
    });
    
    document.getElementById('switch-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthForm('login');
    });
    
    // Кнопки входа
    document.getElementById('email-login-btn').addEventListener('click', handleEmailLogin);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    document.getElementById('google-register-btn').addEventListener('click', handleGoogleLogin);
    
    // Кнопки регистрации
    document.getElementById('email-register-btn').addEventListener('click', handleEmailRegister);
    
    // Отправка сообщения
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Кнопка выхода
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Меню пользователя
    document.getElementById('user-menu-btn').addEventListener('click', toggleUserMenu);
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-menu') && !e.target.closest('.menu-btn')) {
            hideAllMenus();
        }
    });
    
    // Выбор чата
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', selectChat);
    });
    
    // Видеозвонок
    document.getElementById('video-call-btn').addEventListener('click', initVideoCall);
    document.getElementById('start-video-call').addEventListener('click', initVideoCall);
    document.getElementById('end-call').addEventListener('click', endVideoCall);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
    
    // Новый чат
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
    
    // Поиск
    document.getElementById('search-contacts').addEventListener('input', searchContacts);
}

// Переключение форм аутентификации
function switchAuthForm(form) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${form}-form`).classList.add('active');
}

// Показать/скрыть модальное окно
function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function hideAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

// Вход по email
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        showToast('Заполните все поля', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    btn.classList.add('loading');
    btn.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Вход выполнен успешно', 'success');
    } catch (error) {
        console.error('Ошибка входа:', error);
        showToast('Ошибка входа. Проверьте данные', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Вход через Google
async function handleGoogleLogin() {
    try {
        await signInWithPopup(auth, googleProvider);
        showToast('Вход через Google выполнен', 'success');
    } catch (error) {
        console.error('Ошибка Google входа:', error);
        showToast('Ошибка входа через Google', 'error');
    }
}

// Регистрация
async function handleEmailRegister() {
    const nickname = document.getElementById('register-nickname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    // Валидация
    if (!nickname || !email || !password || !confirmPassword) {
        showToast('Заполните все поля', 'error');
        return;
    }
    
    if (nickname.length < 3) {
        showToast('Никнейм должен содержать минимум 3 символа', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Пароль должен содержать минимум 6 символов', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Пароли не совпадают', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    btn.classList.add('loading');
    btn.disabled = true;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, {
            displayName: nickname
        });
        
        await set(ref(database, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            nickname: nickname,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now()
        });
        
        showToast('Регистрация успешна! Выполняется вход...', 'success');
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showToast('Ошибка регистрации. Попробуйте другой email', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// Обработка входа пользователя
async function handleUserLogin(firebaseUser) {
    const userData = await checkAndUpdateUserInDatabase(firebaseUser);
    
    currentUser = {
        uid: firebaseUser.uid,
        displayName: userData.nickname || firebaseUser.displayName || firebaseUser.email,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
    };
    
    hideAuthModal();
    updateUserProfile();
    loadContacts();
    setupPresence();
    enableUI();
    loadMessages();
}

// Проверка и обновление пользователя в БД
async function checkAndUpdateUserInDatabase(firebaseUser) {
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        return snapshot.val();
    } else {
        const userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nickname: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            photoURL: firebaseUser.photoURL,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now()
        };
        
        await set(userRef, userData);
        return userData;
    }
}

// Обновление профиля в UI
function updateUserProfile() {
    if (!currentUser) return;
    
    document.getElementById('username').textContent = currentUser.displayName;
    document.getElementById('user-status').textContent = 'в сети';
    document.getElementById('user-status').className = 'online';
    
    const avatarUrl = currentUser.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=64FFDA&color=0A192F`;
    
    document.getElementById('user-avatar').src = avatarUrl;
}

// Активация интерфейса
function enableUI() {
    if (!currentUser) return;
    
    // Активируем элементы
    document.getElementById('search-contacts').disabled = false;
    document.getElementById('new-chat-btn').disabled = false;
    document.getElementById('video-call-btn').disabled = false;
    document.getElementById('voice-call-btn').disabled = false;
    document.getElementById('start-video-call').disabled = false;
    document.getElementById('chat-menu-btn').disabled = false;
    document.getElementById('emoji-btn').disabled = false;
    document.getElementById('attach-btn').disabled = false;
    document.getElementById('voice-btn').disabled = false;
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').placeholder = 'Введите сообщение...';
    document.getElementById('message-input').focus();
}

// Загрузка контактов
function loadContacts() {
    if (!currentUser) return;
    
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        const chatsList = document.getElementById('chats-list');
        let contactsHTML = '';
        
        if (data) {
            Object.entries(data).forEach(([userId, userData]) => {
                if (userId === currentUser.uid) return;
                
                contacts.push({
                    id: userId,
                    ...userData
                });
                
                const avatarUrl = userData.photoURL || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.nickname)}&background=7C3AED&color=fff`;
                
                contactsHTML += `
                    <div class="chat-item" data-chat-id="${userId}">
                        <div class="chat-avatar">
                            <img src="${avatarUrl}" alt="${userData.nickname}">
                        </div>
                        <div class="chat-info">
                            <div class="chat-name">${userData.nickname}</div>
                            <div class="chat-last">${userData.online ? 'в сети' : 'не в сети'}</div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Добавляем контакты после общего чата
        const generalChat = document.querySelector('.general-chat').outerHTML;
        chatsList.innerHTML = generalChat + contactsHTML;
        
        // Переустанавливаем обработчики
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', selectChat);
        });
    });
}

// Выбор чата
function selectChat(e) {
    const chatItem = e.currentTarget;
    const chatId = chatItem.dataset.chatId;
    
    // Обновляем активный элемент
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    chatItem.classList.add('active');
    
    currentChat = chatId;
    
    if (chatId === 'general') {
        document.getElementById('chat-title').textContent = 'Общий чат';
        document.getElementById('chat-status').textContent = 'Групповой чат';
    } else {
        const contact = contacts.find(c => c.id === chatId);
        if (contact) {
            document.getElementById('chat-title').textContent = contact.nickname;
            document.getElementById('chat-status').textContent = contact.online ? 'в сети' : 'не в сети';
        }
    }
    
    loadMessages();
}

// Загрузка сообщений
function loadMessages() {
    if (!currentUser || !currentChat) return;
    
    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    const messagesContainer = document.getElementById('messages-container');
    
    onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        messagesContainer.innerHTML = '';
        
        if (!data) {
            if (currentChat === 'general') {
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <div class="welcome-icon">
                            <i class="fas fa-comments"></i>
                        </div>
                        <h3>Общий чат NeoCascade</h3>
                        <p>Начните общение в групповом чате!</p>
                    </div>
                `;
            } else {
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <h3>Начните общение</h3>
                        <p>Отправьте первое сообщение!</p>
                    </div>
                `;
            }
            return;
        }
        
        const messagesArray = Object.entries(data).map(([id, message]) => ({
            id,
            ...message
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        messagesArray.forEach(message => {
            addMessageToUI(message);
        });
        
        scrollToBottom();
    });
}

// Добавление сообщения в UI
function addMessageToUI(message) {
    const messagesContainer = document.getElementById('messages-container');
    const welcomeMessage = document.querySelector('.welcome-message');
    
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const isSent = message.senderId === currentUser?.uid;
    const isGroup = currentChat === 'general';
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    let htmlContent = '';
    
    if (isGroup && !isSent) {
        htmlContent = `
            <div class="sender-name">${escapeHtml(message.senderName)}</div>
            <div class="message-content">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        `;
    } else {
        htmlContent = `
            <div class="message-content">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        `;
    }
    
    messageElement.innerHTML = htmlContent;
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser || !currentChat) {
        showToast('Сначала войдите в систему', 'error');
        return;
    }
    
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    
    if (!messageText) {
        showToast('Введите сообщение', 'error');
        return;
    }
    
    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    const newMessageRef = push(messagesRef);
    
    const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: Date.now(),
        type: 'text'
    };
    
    try {
        await set(newMessageRef, messageData);
        input.value = '';
        input.focus();
        
        if (currentChat === 'general') {
            showNotification(`💬 ${currentUser.displayName}: ${messageText.substring(0, 50)}`);
        }
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        showToast('Не удалось отправить сообщение', 'error');
    }
}

// Статус присутствия
function setupPresence() {
    if (!currentUser) return;
    
    const userStatusRef = ref(database, `users/${currentUser.uid}/online`);
    const userLastSeenRef = ref(database, `users/${currentUser.uid}/lastSeen`);
    
    const disconnectRef = ref(database, '.info/connected');
    onValue(disconnectRef, (snapshot) => {
        if (snapshot.val() === false) {
            set(userStatusRef, false);
            set(userLastSeenRef, Date.now());
            return;
        }
        
        set(userStatusRef, true);
        
        const onDisconnectRef = ref(database, `users/${currentUser.uid}/online`);
        set(onDisconnectRef, false);
        set(ref(database, `users/${currentUser.uid}/lastSeen`), Date.now());
    });
}

// Выход из системы
async function handleLogout() {
    try {
        if (currentUser) {
            await set(ref(database, `users/${currentUser.uid}/online`), false);
            await set(ref(database, `users/${currentUser.uid}/lastSeen`), Date.now());
        }
        
        await signOut(auth);
        
        currentUser = null;
        contacts = [];
        
        resetUI();
        showAuthModal();
        hideAllMenus();
        
        showToast('Выход выполнен', 'success');
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showToast('Ошибка при выходе', 'error');
    }
}

// Сброс UI
function resetUI() {
    document.getElementById('username').textContent = 'Гость';
    document.getElementById('user-avatar').src = 'https://ui-avatars.com/api/?name=Гость&background=64FFDA&color=0A192F';
    document.getElementById('user-status').textContent = 'не в сети';
    document.getElementById('user-status').className = 'offline';
    
    document.getElementById('chat-title').textContent = 'Общий чат';
    document.getElementById('chat-status').textContent = 'войдите в систему';
    
    document.getElementById('messages-container').innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-water"></i>
            </div>
            <h2>Добро пожаловать в NeoCascade!</h2>
            <p>Войдите в систему, чтобы начать общение</p>
        </div>
    `;
    
    document.getElementById('search-contacts').disabled = true;
    document.getElementById('new-chat-btn').disabled = true;
    document.getElementById('video-call-btn').disabled = true;
    document.getElementById('voice-call-btn').disabled = true;
    document.getElementById('start-video-call').disabled = true;
    document.getElementById('chat-menu-btn').disabled = true;
    document.getElementById('emoji-btn').disabled = true;
    document.getElementById('attach-btn').disabled = true;
    document.getElementById('voice-btn').disabled = true;
    document.getElementById('message-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('message-input').placeholder = 'Войдите, чтобы отправлять сообщения';
    document.getElementById('message-input').value = '';
    
    document.getElementById('chats-list').innerHTML = `
        <div class="chat-item general-chat active" data-chat-id="general">
            <div class="chat-avatar">
                <i class="fas fa-users"></i>
            </div>
            <div class="chat-info">
                <div class="chat-name">Общий чат</div>
                <div class="chat-last">Групповое общение</div>
            </div>
        </div>
    `;
}

// Видеозвонок (WebRTC)
async function initVideoCall() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = stream;
        
        // Показываем интерфейс видеозвонка
        document.getElementById('video-call-container').classList.add('active');
        videoCallActive = true;
        
        // Запускаем таймер
        startCallTimer();
        
        showToast('Видеозвонок начат', 'success');
        
        // Здесь можно добавить логику подключения к собеседнику через WebRTC
        // Для простоты показываем только локальное видео
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        showToast('Не удалось получить доступ к камере', 'error');
    }
}

function endVideoCall() {
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    
    if (localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
    }
    
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    
    document.getElementById('video-call-container').classList.remove('active');
    videoCallActive = false;
    
    stopCallTimer();
    showToast('Видеозвонок завершен', 'info');
}

function toggleVideo() {
    const localVideo = document.getElementById('local-video');
    if (localVideo.srcObject) {
        const videoTrack = localVideo.srcObject.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        
        const btn = document.getElementById('toggle-video');
        btn.innerHTML = videoTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    }
}

function toggleAudio() {
    const localVideo = document.getElementById('local-video');
    if (localVideo.srcObject) {
        const audioTrack = localVideo.srcObject.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        
        const btn = document.getElementById('toggle-audio');
        btn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    }
}

function startCallTimer() {
    callStartTime = Date.now();
    updateCallTimer();
    callTimer = setInterval(updateCallTimer, 1000);
}

function updateCallTimer() {
    if (!callStartTime) return;
    
    const elapsed = Date.now() - callStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    document.getElementById('call-timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    callStartTime = null;
    document.getElementById('call-timer').textContent = '00:00';
}

// Утилиты
function scrollToBottom() {
    const container = document.getElementById('messages-container');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showNotification(message) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("NeoCascade", { 
            body: message,
            icon: "https://ui-avatars.com/api/?name=NC&background=3B82F6&color=fff"
        });
    }
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.classList.toggle('active');
}

function hideAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
    });
}

function searchContacts() {
    const searchTerm = document.getElementById('search-contacts').value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        const name = item.querySelector('.chat-name').textContent.toLowerCase();
        const isVisible = name.includes(searchTerm) || item.classList.contains('general-chat');
        item.style.display = isVisible ? 'flex' : 'none';
    });
}

async function createNewChat() {
    if (!currentUser) {
        showToast('Сначала войдите в систему', 'error');
        return;
    }
    
    const username = prompt('Введите имя пользователя для нового чата:');
    if (!username) return;
    
    showToast('Функция в разработке', 'info');
    // Здесь можно добавить логику создания нового чата
}
