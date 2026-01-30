import { 
    database, ref, push, onValue, set, get, child, 
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPopup, googleProvider, onAuthStateChanged, signOut, updateProfile 
} from './firebase-config.js';

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let currentChatType = 'group';
let contacts = [];
let messages = [];
let onlineUsers = new Set();

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log("Приложение загружается...");
    initApp();
    setupEventListeners();
});

// Инициализация
function initApp() {
    console.log("Инициализация приложения...");
    
    // Запрашиваем разрешение на уведомления
    if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Разрешение на уведомления получено");
                }
            });
        }, 2000);
    }
    
    // Проверяем состояние аутентификации
    onAuthStateChanged(auth, async (user) => {
        console.log("Статус аутентификации:", user ? "вошел" : "не вошел");
        if (user) {
            // Пользователь уже вошел
            await handleExistingUser(user);
        } else {
            // Показываем окно входа
            showAuthModal();
            // Загружаем общий чат для гостей
            selectGroupChat();
        }
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    console.log("Настройка обработчиков событий...");
    
    // Табы аутентификации
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchAuthTab(tabName);
        });
    });
    
    // Переключение между формами
    document.querySelector('.switch-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('register');
    });
    
    document.querySelector('.switch-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthTab('login');
    });
    
    // Кнопки входа
    document.getElementById('email-login-btn').addEventListener('click', handleEmailLogin);
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleEmailLogin();
    });
    
    // Кнопка входа через Google
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    document.getElementById('google-register-btn').addEventListener('click', handleGoogleLogin);
    
    // Кнопки регистрации
    document.getElementById('email-register-btn').addEventListener('click', handleEmailRegister);
    document.getElementById('register-confirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleEmailRegister();
    });
    
    // Кнопка выхода
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Отправка сообщения
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Голосовой чат
    document.getElementById('voice-chat-btn').addEventListener('click', toggleVoiceChat);
    document.getElementById('close-voice-btn').addEventListener('click', toggleVoiceChat);
    
    // Мобильное меню
    document.querySelector('.mobile-menu-btn').addEventListener('click', toggleMobileMenu);
    
    // Новый чат
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
    
    // Поиск контактов
    document.getElementById('search-contacts').addEventListener('input', searchContacts);
    
    // Выбор общего чата
    document.querySelector('.general-chat').addEventListener('click', () => selectGroupChat());
    
    // Закрытие модального окна при клике на фон
    document.getElementById('auth-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideAuthModal();
        }
    });
}

// Показать модальное окно аутентификации
function showAuthModal() {
    console.log("Показ модального окна аутентификации");
    document.getElementById('auth-modal').style.display = 'flex';
    // Сбрасываем форму входа
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    hideAllMessages();
}

// Скрыть модальное окно аутентификации
function hideAuthModal() {
    console.log("Скрытие модального окна аутентификации");
    document.getElementById('auth-modal').style.display = 'none';
}

// Переключение табов аутентификации
function switchAuthTab(tabName) {
    console.log("Переключение на таб:", tabName);
    
    // Обновляем активные табы
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Показываем соответствующую форму
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.toggle('active', form.id === `${tabName}-form`);
    });
    
    // Очищаем сообщения об ошибках
    hideAllMessages();
}

// Показать/скрыть сообщения
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    console.error("Ошибка:", message);
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.classList.add('show');
    console.log("Успех:", message);
    
    setTimeout(() => {
        successDiv.classList.remove('show');
    }, 3000);
}

function hideAllMessages() {
    document.getElementById('error-message').classList.remove('show');
    document.getElementById('success-message').classList.remove('show');
}

// Вход через Google
async function handleGoogleLogin() {
    console.log("Вход через Google...");
    
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        console.log("Успешный вход через Google:", user.email);
        
        hideAllMessages();
        await checkAndUpdateUserInDatabase(user);
        
    } catch (error) {
        console.error('Ошибка входа через Google:', error.code, error.message);
        
        let errorMessage = 'Ошибка входа через Google. ';
        
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = 'Вход отменен';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'Всплывающее окно заблокировано';
                break;
            case 'auth/unauthorized-domain':
                errorMessage = 'Домен не авторизован для Google Sign-in';
                break;
            default:
                errorMessage += 'Попробуйте еще раз';
        }
        
        showError(errorMessage);
    }
}

// Вход по email/password
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    console.log("Вход по Email:", email);
    
    // Валидация
    if (!email || !password) {
        showError('Заполните все поля');
        return;
    }
    
    const loginBtn = document.getElementById('email-login-btn');
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Успешный вход по Email:", user.email);
        
        hideAllMessages();
        
    } catch (error) {
        console.error('Ошибка входа по Email:', error);
        
        let errorMessage = 'Ошибка входа. ';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage += 'Неверный формат email';
                break;
            case 'auth/user-not-found':
                errorMessage += 'Пользователь не найден';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Неверный пароль';
                break;
            default:
                errorMessage += 'Проверьте email и пароль';
        }
        
        showError(errorMessage);
        
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
}

// Регистрация по email/password
async function handleEmailRegister() {
    const nickname = document.getElementById('register-nickname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    console.log("Регистрация по Email:", email, "Ник:", nickname);
    
    // Валидация
    if (!nickname || !email || !password || !confirmPassword) {
        showError('Заполните все поля');
        return;
    }
    
    if (nickname.length < 3) {
        showError('Никнейм должен содержать минимум 3 символа');
        return;
    }
    
    if (password.length < 6) {
        showError('Пароль должен содержать минимум 6 символов');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('Пароли не совпадают');
        return;
    }
    
    const registerBtn = document.getElementById('email-register-btn');
    registerBtn.classList.add('loading');
    registerBtn.disabled = true;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Пользователь создан:", user.uid);
        
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
        
        showSuccess('Регистрация успешна! Выполняется вход...');
        console.log("Пользователь сохранен в базе данных");
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        
        let errorMessage = 'Ошибка регистрации. ';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Email уже используется';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Неверный формат email';
                break;
            default:
                errorMessage += 'Попробуйте другой email';
        }
        
        showError(errorMessage);
        
    } finally {
        registerBtn.classList.remove('loading');
        registerBtn.disabled = false;
    }
}

// Проверка и обновление пользователя в базе данных
async function checkAndUpdateUserInDatabase(firebaseUser) {
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        console.log("Пользователь уже в базе данных");
        return snapshot.val();
    } else {
        console.log("Создание нового пользователя в базе данных");
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

// Обработка существующего пользователя
async function handleExistingUser(firebaseUser, userData = null) {
    console.log("Обработка существующего пользователя:", firebaseUser.email);
    
    if (!userData) {
        userData = await checkAndUpdateUserInDatabase(firebaseUser);
    }
    
    currentUser = {
        uid: firebaseUser.uid,
        displayName: userData.nickname || firebaseUser.displayName || firebaseUser.email || 'Аноним',
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
    };
    
    console.log("Текущий пользователь установлен:", currentUser.displayName);
    
    updateUserProfile();
    loadContacts();
    hideAuthModal();
    setupPresence(firebaseUser.uid);
    enableUI();
}

// Выбор общего чата
function selectGroupChat() {
    console.log("Выбор общего чата");
    currentChat = 'general';
    currentChatType = 'group';
    
    document.getElementById('chat-title').textContent = 'Общий чат';
    document.getElementById('chat-status').textContent = 'Групповой чат';
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector('.general-chat').classList.add('active');
    
    loadGroupMessages();
    loadOnlineUsers();
    
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

// Загрузка сообщений общего чата
function loadGroupMessages() {
    console.log("Загрузка сообщений общего чата");
    
    const messagesRef = ref(database, `chats/general/messages`);
    const messagesContainer = document.getElementById('messages-container');
    
    messages = [];
    
    onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        messagesContainer.innerHTML = '';
        
        if (!data) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h3>Общий чат NeoCascade</h3>
                    <p>Начните общение в групповом чате!</p>
                </div>
            `;
            return;
        }
        
        const messagesArray = Object.entries(data).map(([id, message]) => ({
            id,
            ...message
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        console.log("Загружено сообщений в общем чате:", messagesArray.length);
        
        messagesArray.forEach(message => {
            addMessageToUI(message, message.senderId === currentUser?.uid, false, true);
        });
        
        scrollToBottom();
    });
}

// Загрузка онлайн пользователей
function loadOnlineUsers() {
    const usersRef = ref(database, 'users');
    
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        onlineUsers.clear();
        
        if (!data) return;
        
        let onlineCount = 0;
        Object.entries(data).forEach(([userId, userData]) => {
            if (userData.online) {
                onlineUsers.add(userId);
                onlineCount++;
            }
        });
        
        document.getElementById('chat-status').textContent = 
            `${onlineCount} участник${getRussianPlural(onlineCount)} онлайн`;
    });
}

// Функция для русского множественного числа
function getRussianPlural(number) {
    if (number % 10 === 1 && number % 100 !== 11) return '';
    if (number % 10 >= 2 && number % 10 <= 4 && (number % 100 < 10 || number % 100 >= 20)) return 'а';
    return 'ов';
}

// Активация интерфейса после входа
function enableUI() {
    console.log("Активация интерфейса...");
    
    document.getElementById('search-contacts').disabled = false;
    document.getElementById('search-contacts').placeholder = "Поиск контактов...";
    
    document.getElementById('new-chat-btn').disabled = false;
    document.getElementById('voice-chat-btn').disabled = false;
    
    document.querySelectorAll('.btn-tool').forEach(btn => {
        btn.disabled = false;
    });
    
    document.querySelectorAll('.btn-action').forEach(btn => {
        btn.disabled = false;
    });
    
    document.querySelector('.btn-voice').disabled = false;
    
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').placeholder = 'Сообщение в общий чат...';
    
    loadOnlineUsers();
}

// Выход из системы
async function handleLogout() {
    console.log("Выход из системы...");
    
    try {
        if (currentUser) {
            await set(ref(database, `users/${currentUser.uid}/online`), false);
            await set(ref(database, `users/${currentUser.uid}/lastSeen`), Date.now());
        }
        
        await signOut(auth);
        
        currentUser = null;
        currentChat = null;
        contacts = [];
        messages = [];
        
        resetUI();
        showAuthModal();
        
        console.log("Выход выполнен успешно");
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showError('Ошибка при выходе из системы');
    }
}

// Сброс UI
function resetUI() {
    console.log("Сброс UI...");
    
    document.getElementById('username').textContent = 'Гость';
    document.getElementById('user-avatar').src = 'https://ui-avatars.com/api/?name=Гость&background=64FFDA&color=0A192F';
    document.getElementById('user-status').textContent = 'не в сети';
    document.getElementById('user-status').className = 'offline';
    
    document.getElementById('chat-title').textContent = 'Общий чат';
    document.getElementById('chat-status').textContent = 'Групповой чат';
    
    document.getElementById('messages-container').innerHTML = `
        <div class="welcome-message">
            <h2><i class="fas fa-water"></i> Добро пожаловать в NeoCascade!</h2>
            <p>Войдите в систему, чтобы начать общение</p>
            <p class="hint">Сообщения появляются как водопад - плавно и непрерывно</p>
        </div>
    `;
    
    document.getElementById('message-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
    document.getElementById('message-input').placeholder = 'Войдите, чтобы отправлять сообщения';
    document.getElementById('message-input').value = '';
    
    document.getElementById('search-contacts').disabled = true;
    document.getElementById('search-contacts').value = '';
    document.getElementById('search-contacts').placeholder = 'Войдите для поиска...';
    
    document.getElementById('new-chat-btn').disabled = true;
    document.getElementById('voice-chat-btn').disabled = true;
    
    document.querySelectorAll('.btn-tool').forEach(btn => {
        btn.disabled = true;
    });
    
    document.querySelectorAll('.btn-action').forEach(btn => {
        btn.disabled = true;
    });
    
    document.querySelector('.btn-voice').disabled = true;
    
    document.querySelector('.contacts-list').innerHTML = `
        <div class="chat-item general-chat contact" data-chat-type="group">
            <div class="contact-avatar">
                <img src="https://ui-avatars.com/api/?name=Общий&background=7C3AED&color=fff" alt="Общий чат">
            </div>
            <div class="contact-info">
                <div class="contact-name">Общий чат</div>
                <div class="last-message">Групповое общение</div>
            </div>
        </div>
        <div class="no-contacts">Войдите, чтобы увидеть контакты</div>
    `;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector('.general-chat').classList.add('active');
    currentChat = 'general';
    currentChatType = 'group';
}

// Настройка статуса присутствия
function setupPresence(userId) {
    console.log("Настройка статуса присутствия для:", userId);
    
    const userStatusRef = ref(database, `users/${userId}/online`);
    const userLastSeenRef = ref(database, `users/${userId}/lastSeen`);
    
    const disconnectRef = ref(database, '.info/connected');
    onValue(disconnectRef, (snapshot) => {
        if (snapshot.val() === false) {
            set(userStatusRef, false);
            set(userLastSeenRef, Date.now());
            return;
        }
        
        set(userStatusRef, true);
        
        const onDisconnectRef = ref(database, `users/${userId}/online`);
        set(onDisconnectRef, false);
        set(ref(database, `users/${userId}/lastSeen`), Date.now());
    });
}

// Загрузка контактов
async function loadContacts() {
    console.log("Загрузка контактов...");
    
    const contactsRef = ref(database, 'users');
    
    onValue(contactsRef, (snapshot) => {
        const data = snapshot.val();
        contacts = [];
        const contactsList = document.querySelector('.contacts-list');
        
        if (!data) {
            contactsList.innerHTML = `
                <div class="chat-item general-chat contact" data-chat-type="group">
                    <div class="contact-avatar">
                        <img src="https://ui-avatars.com/api/?name=Общий&background=7C3AED&color=fff" alt="Общий чат">
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">Общий чат</div>
                        <div class="last-message">Групповое общение</div>
                    </div>
                </div>
                <div class="no-contacts">Нет контактов</div>
            `;
            return;
        }
        
        let contactsHTML = `
            <div class="chat-item general-chat contact" data-chat-type="group">
                <div class="contact-avatar">
                    <img src="https://ui-avatars.com/api/?name=Общий&background=7C3AED&color=fff" alt="Общий чат">
                </div>
                <div class="contact-info">
                    <div class="contact-name">Общий чат</div>
                    <div class="last-message">Групповое общение</div>
                </div>
            </div>
        `;
        
        Object.entries(data).forEach(([userId, userData]) => {
            if (userId === currentUser?.uid) return;
            
            contacts.push({
                id: userId,
                ...userData
            });
            
            const avatarUrl = userData.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.nickname || userData.email || '?')}&background=7C3AED&color=fff`;
            
            const displayName = userData.nickname || userData.email || 'Аноним';
            
            contactsHTML += `
                <div class="contact chat-item" data-user-id="${userId}" data-chat-type="private">
                    <div class="contact-avatar">
                        <img src="${avatarUrl}" alt="${displayName}">
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">${displayName}</div>
                        <div class="last-message">${userData.online ? 'в сети' : 'не в сети'}</div>
                    </div>
                </div>
            `;
        });
        
        contactsList.innerHTML = contactsHTML;
        
        document.querySelectorAll('.contact[data-user-id]').forEach(contact => {
            contact.addEventListener('click', () => {
                const userId = contact.dataset.userId;
                const displayName = contact.querySelector('.contact-name').textContent;
                selectPrivateChat(userId, displayName);
            });
        });
        
        document.querySelector('.general-chat').addEventListener('click', () => selectGroupChat());
        
        if (contacts.length === 0) {
            contactsList.innerHTML += '<div class="no-contacts">Нет контактов. Создайте новый чат!</div>';
        } else {
            console.log("Загружено контактов:", contacts.length);
        }
    });
}

// Выбор приватного чата
function selectPrivateChat(userId, username) {
    console.log("Выбор приватного чата с:", username, "ID:", userId);
    
    currentChat = userId;
    currentChatType = 'private';
    
    document.getElementById('chat-title').textContent = username;
    document.getElementById('chat-status').textContent = 'личный чат';
    
    const contactAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7C3AED&color=fff`;
    document.querySelector('.partner-avatar img').src = contactAvatar;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-user-id="${userId}"]`).classList.add('active');
    document.querySelector('.general-chat').classList.remove('active');
    
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').placeholder = `Сообщение для ${username}...`;
    
    loadPrivateMessages(userId);
    
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

// Загрузка сообщений приватного чата
function loadPrivateMessages(userId) {
    console.log("Загрузка сообщений приватного чата с:", userId);
    
    const chatId = getChatId(currentUser.uid, userId);
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const messagesContainer = document.getElementById('messages-container');
    
    messages = [];
    
    onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        messagesContainer.innerHTML = '';
        
        if (!data) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h3>Начните общение с ${document.getElementById('chat-title').textContent}</h3>
                    <p>Отправьте первое сообщение!</p>
                </div>
            `;
            return;
        }
        
        const messagesArray = Object.entries(data).map(([id, message]) => ({
            id,
            ...message
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        console.log("Загружено сообщений в приватном чате:", messagesArray.length);
        
        messagesArray.forEach(message => {
            addMessageToUI(message, message.senderId === currentUser.uid, false, false);
        });
        
        scrollToBottom();
    });
}

// Генерация ID чата
function getChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser) {
        showError('Сначала войдите в систему!');
        return;
    }
    
    if (!currentChat) {
        showError('Сначала выберите чат!');
        return;
    }
    
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    
    if (!messageText) {
        showError('Введите сообщение');
        return;
    }
    
    console.log("Отправка сообщения в", currentChatType, "чат:", messageText.substring(0, 50) + "...");
    
    let messagesRef;
    if (currentChatType === 'group') {
        messagesRef = ref(database, `chats/general/messages`);
    } else {
        const chatId = getChatId(currentUser.uid, currentChat);
        messagesRef = ref(database, `chats/${chatId}/messages`);
    }
    
    const newMessageRef = push(messagesRef);
    
    const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: Date.now(),
        type: 'text',
        chatType: currentChatType
    };
    
    try {
        await set(newMessageRef, messageData);
        input.value = '';
        
        console.log("Сообщение отправлено успешно");
        
        if (currentChatType === 'group') {
            showNotification(`💬 ${currentUser.displayName}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`);
        }
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        showError('Не удалось отправить сообщение');
    }
}

// Добавление сообщения в UI
function addMessageToUI(message, isSent, isGroup = false) {
    const messagesContainer = document.getElementById('messages-container');
    const welcomeMessage = document.querySelector('.welcome-message');
    
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'} ${isGroup ? 'group-message' : ''}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    if (isGroup && !isSent) {
        messageElement.innerHTML = `
            <div class="sender-name">${escapeHtml(message.senderName)}</div>
            <div class="message-content">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-content">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        `;
    }
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// Поиск контактов
function searchContacts() {
    const searchTerm = document.getElementById('search-contacts').value.toLowerCase();
    const contactElements = document.querySelectorAll('.chat-item[data-chat-type="private"]');
    let found = false;
    
    contactElements.forEach(contact => {
        const contactName = contact.querySelector('.contact-name').textContent.toLowerCase();
        const isVisible = contactName.includes(searchTerm);
        contact.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) found = true;
    });
    
    if (!found && searchTerm) {
        const noResults = document.querySelector('.no-results');
        if (!noResults) {
            const noResultsElement = document.createElement('div');
            noResultsElement.className = 'no-contacts no-results';
            noResultsElement.textContent = 'Контакты не найдены';
            document.querySelector('.contacts-list').appendChild(noResultsElement);
        }
    } else {
        const noResults = document.querySelector('.no-results');
        if (noResults) noResults.remove();
    }
}

// Создание нового чата
async function createNewChat() {
    if (!currentUser) {
        showError('Сначала войдите в систему!');
        return;
    }
    
    const username = prompt('Введите имя пользователя для нового чата:');
    if (!username) return;
    
    console.log("Поиск пользователя:", username);
    
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
        const users = snapshot.val();
        const existingUser = Object.entries(users).find(([id, user]) => 
            (user.nickname && user.nickname.toLowerCase() === username.toLowerCase()) ||
            (user.email && user.email.toLowerCase() === username.toLowerCase())
        );
        
        if (existingUser) {
            selectPrivateChat(existingUser[0], existingUser[1].nickname || existingUser[1].email);
            return;
        }
    }
    
    showError('Пользователь не найден. Пригласите его в NeoCascade!');
}

// Голосовой чат
function toggleVoiceChat() {
    const voicePanel = document.getElementById('voice-panel');
    voicePanel.classList.toggle('active');
    
    document.querySelector('.voice-status p').textContent = 
        voicePanel.classList.contains('active') 
            ? 'Подключение к голосовому чату...' 
            : 'Подключитесь к голосовому чату';
}

// Мобильное меню
function toggleMobileMenu() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// Обновление профиля пользователя
function updateUserProfile() {
    if (!currentUser) return;
    
    console.log("Обновление профиля:", currentUser.displayName);
    
    document.getElementById('username').textContent = currentUser.displayName;
    document.getElementById('user-status').textContent = 'в сети';
    document.getElementById('user-status').className = 'online';
    
    const avatarUrl = currentUser.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=64FFDA&color=0A192F`;
    
    document.getElementById('user-avatar').src = avatarUrl;
}

// Прокрутка вниз
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Уведомления
function showNotification(text) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("💬 NeoCascade", { 
            body: text, 
            icon: "https://ui-avatars.com/api/?name=NC&background=7C3AED&color=fff"
        });
    }
    
    playNotificationSound();
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Аудио не поддерживается');
    }
}

// Инициализация при загрузке
window.addEventListener('load', () => {
    console.log("Окно загружено");
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
});
