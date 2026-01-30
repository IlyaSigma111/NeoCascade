import { 
    database, ref, push, onValue, set, get, child, 
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPopup, googleProvider, onAuthStateChanged, signOut, updateProfile 
} from './firebase-config.js';

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let contacts = [];
let messages = [];

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
    
    // Объявления
    document.getElementById('announcement-btn').addEventListener('click', showAnnouncementModal);
    document.getElementById('cancel-announcement').addEventListener('click', hideAnnouncementModal);
    document.getElementById('send-announcement').addEventListener('click', sendAnnouncement);
    document.getElementById('announcement-link').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAnnouncement();
    });
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
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.classList.add('show');
    console.log("Успех:", message);
    
    // Автоматическое скрытие через 3 секунды
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
        
        // Скрываем сообщения об ошибках
        hideAllMessages();
        
        // Проверяем и обновляем пользователя в базе данных
        await checkAndUpdateUserInDatabase(user);
        
    } catch (error) {
        console.error('Ошибка входа через Google:', error);
        
        // Показываем понятное сообщение об ошибке
        let errorMessage = 'Ошибка входа через Google. ';
        
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = 'Вход отменен';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'Всплывающее окно заблокировано. Разрешите всплывающие окна для этого сайта';
                break;
            case 'auth/unauthorized-domain':
                errorMessage = 'Домен не авторизован в Firebase Console';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Вход через Google не включен в Firebase Console';
                break;
            default:
                errorMessage += 'Попробуйте еще раз или используйте вход по Email';
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
    
    // Показываем индикатор загрузки
    const loginBtn = document.getElementById('email-login-btn');
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Успешный вход по Email:", user.email);
        
        // Успешный вход обрабатывается в onAuthStateChanged
        hideAllMessages();
        
    } catch (error) {
        console.error('Ошибка входа по Email:', error);
        
        // Показываем понятное сообщение об ошибке
        let errorMessage = 'Ошибка входа. ';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage += 'Неверный формат email';
                break;
            case 'auth/user-disabled':
                errorMessage += 'Аккаунт отключен';
                break;
            case 'auth/user-not-found':
                errorMessage += 'Пользователь не найден';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Неверный пароль';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Слишком много попыток. Попробуйте позже';
                break;
            default:
                errorMessage += 'Проверьте email и пароль';
        }
        
        showError(errorMessage);
        
    } finally {
        // Убираем индикатор загрузки
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
    
    // Показываем индикатор загрузки
    const registerBtn = document.getElementById('email-register-btn');
    registerBtn.classList.add('loading');
    registerBtn.disabled = true;
    
    try {
        // Создаем пользователя
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Пользователь создан:", user.uid);
        
        // Обновляем профиль с никнеймом
        await updateProfile(user, {
            displayName: nickname
        });
        
        // Сохраняем пользователя в базу данных
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
        
        // Автоматический вход обрабатывается в onAuthStateChanged
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        
        // Показываем понятное сообщение об ошибке
        let errorMessage = 'Ошибка регистрации. ';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Email уже используется';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Неверный формат email';
                break;
            case 'auth/operation-not-allowed':
                errorMessage += 'Регистрация по email отключена';
                break;
            case 'auth/weak-password':
                errorMessage += 'Пароль слишком слабый';
                break;
            default:
                errorMessage += 'Попробуйте другой email';
        }
        
        showError(errorMessage);
        
    } finally {
        // Убираем индикатор загрузки
        registerBtn.classList.remove('loading');
        registerBtn.disabled = false;
    }
}

// Проверка и обновление пользователя в базе данных
async function checkAndUpdateUserInDatabase(firebaseUser) {
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        // Пользователь уже есть в базе
        console.log("Пользователь уже в базе данных");
        return snapshot.val();
    } else {
        // Создаем нового пользователя в базе
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
    
    // Создаем объект текущего пользователя
    currentUser = {
        uid: firebaseUser.uid,
        displayName: userData.nickname || firebaseUser.displayName || firebaseUser.email || 'Аноним',
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
    };
    
    console.log("Текущий пользователь установлен:", currentUser.displayName);
    
    // Обновляем профиль пользователя
    updateUserProfile();
    
    // Загружаем контакты и чаты
    loadContacts();
    
    // Скрываем модальное окно
    hideAuthModal();
    
    // Устанавливаем онлайн статус
    setupPresence(firebaseUser.uid);
    
    // Активируем интерфейс
    enableUI();
}

// Активация интерфейса после входа
function enableUI() {
    console.log("Активация интерфейса...");
    
    // Активируем поле поиска
    document.getElementById('search-contacts').disabled = false;
    document.getElementById('search-contacts').placeholder = "Поиск контактов...";
    
    // Активируем кнопки
    document.getElementById('new-chat-btn').disabled = false;
    document.getElementById('voice-chat-btn').disabled = false;
    document.getElementById('announcement-btn').disabled = false;
    
    // Активируем инструменты
    document.querySelectorAll('.btn-tool').forEach(btn => {
        btn.disabled = false;
    });
    
    document.querySelectorAll('.btn-action').forEach(btn => {
        btn.disabled = false;
    });
    
    document.querySelector('.btn-voice').disabled = false;
    
    // Обновляем статус чата
    document.getElementById('chat-status').textContent = 'выберите чат';
}

// Выход из системы
async function handleLogout() {
    console.log("Выход из системы...");
    
    try {
        // Устанавливаем статус офлайн
        if (currentUser) {
            await set(ref(database, `users/${currentUser.uid}/online`), false);
            await set(ref(database, `users/${currentUser.uid}/lastSeen`), Date.now());
        }
        
        // Выход из Firebase
        await signOut(auth);
        
        // Сбрасываем состояние
        currentUser = null;
        currentChat = null;
        contacts = [];
        messages = [];
        
        // Сбрасываем UI
        resetUI();
        
        // Показываем окно входа
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
    
    document.getElementById('chat-title').textContent = 'Выберите чат';
    document.getElementById('chat-status').textContent = 'войдите в систему';
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
    
    // Деактивируем поле поиска
    document.getElementById('search-contacts').disabled = true;
    document.getElementById('search-contacts').value = '';
    document.getElementById('search-contacts').placeholder = 'Войдите для поиска...';
    
    // Деактивируем кнопки
    document.getElementById('new-chat-btn').disabled = true;
    document.getElementById('voice-chat-btn').disabled = true;
    document.getElementById('announcement-btn').disabled = true;
    
    // Деактивируем инструменты
    document.querySelectorAll('.btn-tool').forEach(btn => {
        btn.disabled = true;
    });
    
    document.querySelectorAll('.btn-action').forEach(btn => {
        btn.disabled = true;
    });
    
    document.querySelector('.btn-voice').disabled = true;
    
    // Очищаем список контактов
    document.querySelector('.contacts-list').innerHTML = '<div class="no-contacts">Войдите, чтобы увидеть контакты</div>';
    
    // Сбрасываем активный чат
    document.querySelectorAll('.contact').forEach(contact => {
        contact.classList.remove('active');
    });
}

// Обновление профиля пользователя
function updateUserProfile() {
    if (!currentUser) return;
    
    console.log("Обновление профиля:", currentUser.displayName);
    
    document.getElementById('username').textContent = currentUser.displayName;
    document.getElementById('user-status').textContent = 'в сети';
    document.getElementById('user-status').className = 'online';
    
    // Генерируем аватар на основе имени
    const avatarUrl = currentUser.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=64FFDA&color=0A192F`;
    
    document.getElementById('user-avatar').src = avatarUrl;
}

// Управление модальными окнами
function showAuthModal() {
    console.log("Показ модального окна аутентификации");
    document.getElementById('auth-modal').style.display = 'flex';
    // Сбрасываем форму входа
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    hideAllMessages();
}

function hideAuthModal() {
    console.log("Скрытие модального окна аутентификации");
    document.getElementById('auth-modal').style.display = 'none';
}

// Настройка статуса присутствия
function setupPresence(userId) {
    console.log("Настройка статуса присутствия для:", userId);
    
    const userStatusRef = ref(database, `users/${userId}/online`);
    const userLastSeenRef = ref(database, `users/${userId}/lastSeen`);
    
    const disconnectRef = ref(database, '.info/connected');
    onValue(disconnectRef, (snapshot) => {
        if (snapshot.val() === false) {
            // При отключении
            set(userStatusRef, false);
            set(userLastSeenRef, Date.now());
            return;
        }
        
        // При подключении
        set(userStatusRef, true);
        
        // При отключении (обработка закрытия вкладки)
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
            contactsList.innerHTML = '<div class="no-contacts">Нет контактов</div>';
            return;
        }
        
        // Очищаем список
        contactsList.innerHTML = '';
        
        Object.entries(data).forEach(([userId, userData]) => {
            // Пропускаем текущего пользователя
            if (userId === currentUser?.uid) return;
            
            contacts.push({
                id: userId,
                ...userData
            });
            
            const contactElement = document.createElement('div');
            contactElement.className = 'contact';
            contactElement.dataset.userId = userId;
            
            // Генерируем аватар
            let avatarUrl = userData.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.nickname || userData.email || '?')}&background=7C3AED&color=fff`;
            
            // Определяем имя для отображения
            let displayName = userData.nickname || userData.email || 'Аноним';
            
            contactElement.innerHTML = `
                <div class="contact-avatar">
                    <img src="${avatarUrl}" alt="${displayName}">
                </div>
                <div class="contact-info">
                    <div class="contact-name">${displayName}</div>
                    <div class="last-message">${userData.online ? 'в сети' : 'не в сети'}</div>
                </div>
            `;
            
            contactElement.addEventListener('click', () => selectChat(userId, displayName));
            contactsList.appendChild(contactElement);
        });
        
        // Если контактов нет (кроме текущего пользователя)
        if (contacts.length === 0) {
            contactsList.innerHTML = '<div class="no-contacts">Нет контактов. Создайте новый чат!</div>';
        } else {
            console.log("Загружено контактов:", contacts.length);
        }
    });
}

// Выбор чата
function selectChat(userId, username) {
    console.log("Выбор чата с:", username, "ID:", userId);
    
    currentChat = userId;
    
    document.getElementById('chat-title').textContent = username;
    document.getElementById('chat-status').textContent = 'в сети';
    
    // Обновляем статус в UI
    const contact = contacts.find(c => c.id === userId);
    if (contact) {
        document.getElementById('chat-status').textContent = contact.online ? 'в сети' : 'не в сети';
        document.querySelector('.partner-avatar .status-indicator').className = 
            `status-indicator ${contact.online ? 'online' : 'offline'}`;
    }
    
    // Обновляем аватар в чате
    const contactAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7C3AED&color=fff`;
    document.querySelector('.partner-avatar img').src = contactAvatar;
    
    // Активируем контакт в списке
    document.querySelectorAll('.contact').forEach(contact => {
        contact.classList.remove('active');
        if (contact.dataset.userId === userId) {
            contact.classList.add('active');
        }
    });
    
    // Активируем поле ввода
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').placeholder = `Сообщение для ${username}...`;
    
    // Загружаем сообщения
    loadMessages(userId);
    
    // На мобильных скрываем меню
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

// Загрузка сообщений
function loadMessages(userId) {
    console.log("Загрузка сообщений для чата:", userId);
    
    const chatId = getChatId(currentUser.uid, userId);
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    
    messages = [];
    const messagesContainer = document.getElementById('messages-container');
    
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
        
        // Преобразуем объект в массив и сортируем по времени
        const messagesArray = Object.entries(data).map(([id, message]) => ({
            id,
            ...message
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        console.log("Загружено сообщений:", messagesArray.length);
        
        // Отображаем сообщения
        messagesArray.forEach(message => {
            if (message.type === 'announcement' || message.isAnnouncement) {
                addMessageToUI(message, false, true);
            } else {
                addMessageToUI(message, message.senderId === currentUser.uid, false);
            }
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
    if (!currentUser || !currentChat) {
        showError('Сначала выберите чат');
        return;
    }
    
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    
    if (!messageText) {
        showError('Введите сообщение');
        return;
    }
    
    console.log("Отправка сообщения:", messageText.substring(0, 50) + "...");
    
    // Проверяем, не является ли сообщение командой
    if (messageText.startsWith('/announce ')) {
        const parts = messageText.substring(10).split('|');
        if (parts.length >= 2) {
            showAnnouncementModal();
            if (parts[0]) document.getElementById('announcement-title').value = parts[0];
            if (parts[1]) document.getElementById('announcement-text').value = parts[1];
            if (parts[2]) document.getElementById('announcement-link').value = parts[2];
            input.value = '';
            return;
        }
    }
    
    const chatId = getChatId(currentUser.uid, currentChat);
    const messagesRef = ref(database, `chats/${chatId}/messages`);
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
        
        // Обновляем последнее сообщение
        await updateLastMessage(chatId, messageText);
        
        console.log("Сообщение отправлено успешно");
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        showError('Не удалось отправить сообщение');
    }
}

// Обновление последнего сообщения
async function updateLastMessage(chatId, lastMessage) {
    try {
        await set(ref(database, `chats/${chatId}/lastMessage`), {
            text: lastMessage,
            timestamp: Date.now(),
            senderId: currentUser.uid,
            senderName: currentUser.displayName
        });
    } catch (error) {
        console.error('Ошибка обновления последнего сообщения:', error);
    }
}

// Функции для объявлений
function showAnnouncementModal() {
    if (!currentUser || !currentChat) {
        showError('Сначала выберите чат!');
        return;
    }
    
    document.getElementById('announcement-modal').style.display = 'flex';
    document.getElementById('announcement-title').focus();
}

function hideAnnouncementModal() {
    document.getElementById('announcement-modal').style.display = 'none';
    document.getElementById('announcement-title').value = '';
    document.getElementById('announcement-text').value = '';
    document.getElementById('announcement-link').value = '';
}

async function sendAnnouncement() {
    const title = document.getElementById('announcement-title').value.trim();
    const text = document.getElementById('announcement-text').value.trim();
    const link = document.getElementById('announcement-link').value.trim();
    
    // Валидация
    if (!link) {
        showError('Пожалуйста, введите ссылку!');
        document.getElementById('announcement-link').focus();
        return;
    }
    
    if (!isValidUrl(link)) {
        showError('Пожалуйста, введите корректную ссылку (начинается с http:// или https://)');
        return;
    }
    
    if (!currentChat) return;
    
    const chatId = getChatId(currentUser.uid, currentChat);
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    const newMessageRef = push(messagesRef);
    
    const announcementData = {
        type: 'announcement',
        title: title || 'Важное объявление',
        text: text || '',
        link: link,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        timestamp: Date.now(),
        isAnnouncement: true
    };
    
    try {
        await set(newMessageRef, announcementData);
        hideAnnouncementModal();
        showSuccess('Объявление отправлено!');
        showNotification(`📢 Новое объявление от ${currentUser.displayName}`);
        
    } catch (error) {
        console.error('Ошибка отправки объявления:', error);
        showError('Не удалось отправить объявление');
    }
}

// Добавление сообщения в UI
function addMessageToUI(message, isSent, isAnnouncement) {
    const messagesContainer = document.getElementById('messages-container');
    const welcomeMessage = document.querySelector('.welcome-message');
    
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    if (isAnnouncement || message.type === 'announcement' || message.isAnnouncement) {
        const announcementElement = document.createElement('div');
        announcementElement.className = 'message announcement-message';
        
        let domain = 'Ссылка';
        try {
            const url = new URL(message.link);
            domain = url.hostname.replace('www.', '');
        } catch (e) {}
        
        const time = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        announcementElement.innerHTML = `
            <div class="announcement-icon">📢</div>
            <div class="announcement-title">${escapeHtml(message.title || 'Объявление')}</div>
            ${message.text ? `<div class="announcement-text">${escapeHtml(message.text)}</div>` : ''}
            <a href="${escapeHtml(message.link)}" 
               target="_blank" 
               rel="noopener noreferrer"
               class="announcement-link">
                <i class="fas fa-external-link-alt"></i>
                ${escapeHtml(domain)}
            </a>
            <div class="message-time" style="margin-top: 10px; opacity: 0.8;">
                От: ${escapeHtml(message.senderName)} • ${time}
            </div>
        `;
        
        messagesContainer.appendChild(announcementElement);
    } else {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageElement.innerHTML = `
            <div class="message-content">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
    }
    
    scrollToBottom();
}

// Поиск контактов
function searchContacts() {
    const searchTerm = document.getElementById('search-contacts').value.toLowerCase();
    const contactElements = document.querySelectorAll('.contact');
    let found = false;
    
    contactElements.forEach(contact => {
        const contactName = contact.querySelector('.contact-name').textContent.toLowerCase();
        const isVisible = contactName.includes(searchTerm);
        contact.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) found = true;
    });
    
    // Если ничего не найдено
    const contactsList = document.querySelector('.contacts-list');
    const noResults = contactsList.querySelector('.no-results');
    
    if (!found && searchTerm) {
        if (!noResults) {
            const noResultsElement = document.createElement('div');
            noResultsElement.className = 'no-contacts no-results';
            noResultsElement.textContent = 'Контакты не найдены';
            contactsList.appendChild(noResultsElement);
        }
    } else if (noResults) {
        noResults.remove();
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
    
    // Ищем пользователя в базе данных
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
        const users = snapshot.val();
        const existingUser = Object.entries(users).find(([id, user]) => 
            (user.nickname && user.nickname.toLowerCase() === username.toLowerCase()) ||
            (user.email && user.email.toLowerCase() === username.toLowerCase())
        );
        
        if (existingUser) {
            selectChat(existingUser[0], existingUser[1].nickname || existingUser[1].email);
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

// Проверка URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
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
    // Браузерные уведомления
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("📢 NeoCascade", { 
            body: text, 
            icon: "https://ui-avatars.com/api/?name=NC&background=7C3AED&color=fff",
            tag: "announcement"
        });
    }
    
    // Звуковое уведомление
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
