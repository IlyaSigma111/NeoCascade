import { 
    database, ref, push, onValue, set, get, child,
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPopup, googleProvider, onAuthStateChanged, signOut, updateProfile
} from './firebase-config.js';

// Глобальное состояние
let currentUser = null;
let currentChat = 'general';
let contacts = [];
let activeCall = false;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем авторизацию
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleUserLogin(user);
        } else {
            showLoginModal();
        }
    });

    // Обработчики событий
    setupEventListeners();
});

function setupEventListeners() {
    // Переключение форм
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    // Авторизация
    document.getElementById('email-login-btn').addEventListener('click', handleEmailLogin);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    document.getElementById('email-register-btn').addEventListener('click', handleEmailRegister);

    // Сообщения
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Выход
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Звонки
    document.getElementById('start-group-call').addEventListener('click', startCall);
    document.getElementById('join-call-btn').addEventListener('click', joinCall);
    document.getElementById('end-call').addEventListener('click', endCall);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);

    // Выбор чата
    document.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            selectChat(chatItem.dataset.chat);
        }
    });
}

// Вход по email
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }

    const btn = document.getElementById('email-login-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading"></div>';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Вход выполнен успешно', 'success');
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification(getAuthErrorMessage(error), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
    }
}

// Вход через Google
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading"></div>';

    try {
        await signInWithPopup(auth, googleProvider);
        showNotification('Вход через Google выполнен', 'success');
    } catch (error) {
        console.error('Ошибка Google входа:', error);
        showNotification(getAuthErrorMessage(error), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-google"></i> Войти через Google';
    }
}

// Регистрация
async function handleEmailRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if (!name || !email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }

    if (name.length < 2) {
        showNotification('Имя должно быть от 2 символов', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Пароль должен быть от 6 символов', 'error');
        return;
    }

    const btn = document.getElementById('email-register-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="loading"></div>';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Обновляем профиль
        await updateProfile(user, {
            displayName: name,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`
        });

        // Сохраняем в базу данных
        await set(ref(database, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            name: name,
            photoURL: user.photoURL,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now()
        });

        showNotification('Регистрация успешна!', 'success');

        // Переключаемся на форму входа
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showNotification(getAuthErrorMessage(error), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Зарегистрироваться';
    }
}

// Обработка входа пользователя
async function handleUserLogin(firebaseUser) {
    // Получаем данные пользователя
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
            photoURL: firebaseUser.photoURL,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now()
        };
        await set(userRef, userData);
    }

    // Обновляем онлайн статус
    await set(ref(database, `users/${firebaseUser.uid}/online`), true);
    await set(ref(database, `users/${firebaseUser.uid}/lastSeen`), Date.now());

    // Сохраняем пользователя
    currentUser = {
        uid: firebaseUser.uid,
        name: userData.name,
        email: userData.email,
        photoURL: userData.photoURL
    };

    // Обновляем UI
    hideLoginModal();
    updateUserProfile();
    loadContacts();
    setupPresence();
    enableChat();
    loadMessages();
}

// Обновление профиля в UI
function updateUserProfile() {
    document.getElementById('username').textContent = currentUser.name;
    document.getElementById('user-status').textContent = 'в сети';
    document.getElementById('user-status').classList.remove('offline');
    document.getElementById('user-status').classList.add('online');

    const avatar = document.getElementById('user-avatar');
    if (currentUser.photoURL) {
        avatar.innerHTML = `<img src="${currentUser.photoURL}" alt="${currentUser.name}">`;
    } else {
        avatar.innerHTML = `<i class="fas fa-user"></i>`;
    }
}

// Включение чата
function enableChat() {
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('join-call-btn').disabled = false;
    document.getElementById('message-input').placeholder = 'Введите сообщение...';
    document.getElementById('message-input').focus();

    // Показываем основной интерфейс
    document.querySelector('.container').style.display = 'flex';
}

// Загрузка контактов
function loadContacts() {
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        const chatList = document.querySelector('.chat-list');
        let contactsHTML = '';

        if (data) {
            Object.entries(data).forEach(([userId, userData]) => {
                if (userId === currentUser.uid) return;

                contacts.push({
                    id: userId,
                    ...userData
                });

                const avatar = userData.photoURL || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=10B981&color=fff`;

                contactsHTML += `
                    <div class="chat-item" data-chat="${userId}">
                        <div class="chat-icon">
                            <img src="${avatar}" alt="${userData.name}">
                        </div>
                        <div class="chat-info">
                            <div class="chat-name">${userData.name}</div>
                            <div class="chat-preview">${userData.online ? 'в сети' : 'не в сети'}</div>
                        </div>
                        <button class="btn-call-mini" data-chat="${userId}">
                            <i class="fas fa-video"></i>
                        </button>
                    </div>
                `;
            });
        }

        // Добавляем контакты после общего чата
        const generalChat = chatList.querySelector('.chat-item').outerHTML;
        chatList.innerHTML = generalChat + contactsHTML;
    });
}

// Выбор чата
function selectChat(chatId) {
    currentChat = chatId;

    // Обновляем активный элемент
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.chat-item[data-chat="${chatId}"]`).classList.add('active');

    if (chatId === 'general') {
        document.getElementById('chat-title').textContent = 'Общий чат';
        document.getElementById('chat-status').textContent = 'Групповой чат';
        document.querySelector('.chat-title .avatar').innerHTML = '<i class="fas fa-users"></i>';
    } else {
        const contact = contacts.find(c => c.id === chatId);
        if (contact) {
            document.getElementById('chat-title').textContent = contact.name;
            document.getElementById('chat-status').textContent = contact.online ? 'в сети' : 'не в сети';
            const avatar = contact.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=10B981&color=fff`;
            document.querySelector('.chat-title .avatar').innerHTML = `<img src="${avatar}" alt="${contact.name}">`;
        }
    }

    loadMessages();
}

// Загрузка сообщений
function loadMessages() {
    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    const messagesContainer = document.getElementById('messages-container');

    onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        messagesContainer.innerHTML = '';

        if (!data) {
            messagesContainer.innerHTML = `
                <div class="welcome">
                    <div class="welcome-icon">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h3>${currentChat === 'general' ? 'Общий чат' : 'Личные сообщения'}</h3>
                    <p>Начните общение!</p>
                </div>
            `;
            return;
        }

        // Сортируем сообщения по времени
        const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);

        messages.forEach(message => {
            addMessageToUI(message);
        });

        scrollToBottom();
    });
}

// Добавление сообщения в UI
function addMessageToUI(message) {
    const messagesContainer = document.getElementById('messages-container');
    const welcome = messagesContainer.querySelector('.welcome');

    if (welcome) {
        welcome.remove();
    }

    const isSent = message.senderId === currentUser.uid;
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.innerHTML = `
        <div class="message-content">${escapeHtml(message.text)}</div>
        <div class="message-time">${time}</div>
    `;

    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser) return;

    const input = document.getElementById('message-input');
    const text = input.value.trim();

    if (!text) return;

    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    const newMessageRef = push(messagesRef);

    const messageData = {
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        timestamp: Date.now()
    };

    try {
        await set(newMessageRef, messageData);
        input.value = '';
        input.focus();
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showNotification('Не удалось отправить сообщение', 'error');
    }
}

// Система присутствия
function setupPresence() {
    const userStatusRef = ref(database, `users/${currentUser.uid}/online`);
    const userLastSeenRef = ref(database, `users/${currentUser.uid}/lastSeen`);

    // При отключении устанавливаем offline
    const disconnectRef = ref(database, '.info/connected');
    onValue(disconnectRef, (snapshot) => {
        if (snapshot.val() === false) {
            set(userStatusRef, false);
            set(userLastSeenRef, Date.now());
            return;
        }

        set(userStatusRef, true);
        
        // Настраиваем onDisconnect
        const onDisconnectRef = ref(database, `users/${currentUser.uid}/online`);
        set(onDisconnectRef, false);
        set(ref(database, `users/${currentUser.uid}/lastSeen`), Date.now());
    });
}

// Выход
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

        // Сбрасываем состояние
        currentUser = null;
        contacts = [];

        // Сбрасываем UI
        resetUI();
        showLoginModal();

        showNotification('Выход выполнен', 'success');
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showNotification('Ошибка при выходе', 'error');
    }
}

function resetUI() {
    document.getElementById('username').textContent = 'Гость';
    document.getElementById('user-status').textContent = 'не в сети';
    document.getElementById('user-status').classList.remove('online');
    document.getElementById('user-status').classList.add('offline');
    
    const avatar = document.getElementById('user-avatar');
    avatar.innerHTML = '<i class="fas fa-user"></i>';
    
    document.getElementById('chat-title').textContent = 'Общий чат';
    document.getElementById('chat-status').textContent = 'войдите в систему';
    
    document.getElementById('messages-container').innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">
                <i class="fas fa-water"></i>
            </div>
            <h2>NeoCascade Messenger</h2>
            <p>Быстрое и безопасное общение</p>
            <p class="hint">Войдите в систему, чтобы начать общаться</p>
        </div>
    `;
    
    document.getElementById('message-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('join-call-btn').disabled = true;
    document.getElementById('message-input').placeholder = 'Войдите, чтобы отправлять сообщения';
    document.getElementById('message-input').value = '';
    
    document.querySelector('.container').style.display = 'none';
    document.querySelector('.chat-list').innerHTML = `
        <div class="chat-item active" data-chat="general">
            <div class="chat-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="chat-info">
                <div class="chat-name">Общий чат</div>
                <div class="chat-preview">Присоединяйтесь к беседе</div>
            </div>
            <button class="btn-call-mini" data-chat="general">
                <i class="fas fa-video"></i>
            </button>
        </div>
    `;
}

// Видеозвонки
async function startCall() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = stream;

        // Создаем звонок в общем чате
        await set(ref(database, `calls/general`), {
            active: true,
            startedBy: currentUser.uid,
            startedAt: Date.now(),
            participants: {
                [currentUser.uid]: true
            }
        });

        // Показываем интерфейс звонка
        document.getElementById('video-call-container').classList.add('active');
        activeCall = true;

        showNotification('Звонок начат', 'success');
    } catch (error) {
        console.error('Ошибка звонка:', error);
        showNotification('Не удалось начать звонок', 'error');
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
        localVideo.srcObject = stream;

        // Добавляем себя к участникам
        await set(ref(database, `calls/general/participants/${currentUser.uid}`), true);

        document.getElementById('video-call-container').classList.add('active');
        activeCall = true;

        showNotification('Вы присоединились к звонку', 'success');
    } catch (error) {
        console.error('Ошибка подключения:', error);
        showNotification('Не удалось присоединиться', 'error');
    }
}

function endCall() {
    // Останавливаем все медиапотоки
    const localVideo = document.getElementById('local-video');
    if (localVideo.srcObject) {
        localVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    // Убираем звонок из базы
    set(ref(database, `calls/general`), null);

    // Скрываем интерфейс звонка
    document.getElementById('video-call-container').classList.remove('active');
    activeCall = false;

    showNotification('Звонок завершен', 'info');
}

function toggleVideo() {
    const localVideo = document.getElementById('local-video');
    if (localVideo.srcObject) {
        const videoTrack = localVideo.srcObject.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('toggle-video');
            btn.innerHTML = videoTrack.enabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
        }
    }
}

function toggleAudio() {
    const localVideo = document.getElementById('local-video');
    if (localVideo.srcObject) {
        const audioTrack = localVideo.srcObject.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('toggle-audio');
            btn.innerHTML = audioTrack.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

// Вспомогательные функции
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Удаляем предыдущие уведомления
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification`;
    notification.style.background = type === 'error' ? 'var(--danger)' : 
                                  type === 'success' ? 'var(--secondary)' : 'var(--primary)';
    notification.textContent = message;

    document.body.appendChild(notification);

    // Автоудаление через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Неверный формат email';
        case 'auth/user-disabled':
            return 'Аккаунт отключен';
        case 'auth/user-not-found':
            return 'Пользователь не найден';
        case 'auth/wrong-password':
            return 'Неверный пароль';
        case 'auth/email-already-in-use':
            return 'Email уже используется';
        case 'auth/weak-password':
            return 'Слишком слабый пароль';
        case 'auth/popup-closed-by-user':
            return 'Окно авторизации закрыто';
        case 'auth/popup-blocked':
            return 'Браузер заблокировал окно авторизации';
        default:
            return 'Ошибка авторизации';
    }
}

// Экспорт для отладки
window.app = {
    currentUser,
    currentChat,
    contacts,
    activeCall
};
