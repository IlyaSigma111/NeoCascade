import { 
    database, ref, push, onValue, set, get, child, 
    auth, signInWithPopup, googleProvider, onAuthStateChanged, signOut 
} from './firebase-config.js';

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let contacts = [];
let messages = [];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// Инициализация
function initApp() {
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
        if (user) {
            // Пользователь уже вошел
            await handleExistingUser(user);
        } else {
            // Показываем окно входа через Google
            showGoogleLoginModal();
        }
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка входа через Google
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    
    // Кнопка сохранения ника
    document.getElementById('save-nickname-btn').addEventListener('click', saveNickname);
    
    // Ввод ника по Enter
    document.getElementById('nickname-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveNickname();
    });
    
    // Кнопки примеров ников
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('nickname-input').value = e.target.dataset.nick;
        });
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
    document.querySelector('.btn-new-chat').addEventListener('click', createNewChat);
    
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

// Вход через Google
async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Проверяем, есть ли у пользователя ник в базе данных
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            // Пользователь уже есть в базе - загружаем данные
            const userData = snapshot.val();
            await handleExistingUser(user, userData);
        } else {
            // Новый пользователь - показываем окно выбора ника
            showNicknameModal(user);
        }
        
    } catch (error) {
        console.error('Ошибка входа через Google:', error);
        alert('Не удалось войти через Google. Проверьте консоль Firebase (включите Google Sign-in).');
    }
}

// Обработка существующего пользователя
async function handleExistingUser(firebaseUser, userData = null) {
    if (!userData) {
        const userRef = ref(database, `users/${firebaseUser.uid}`);
        const snapshot = await get(userRef);
        userData = snapshot.val();
    }
    
    currentUser = {
        uid: firebaseUser.uid,
        displayName: userData.nickname || firebaseUser.displayName || 'Аноним',
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL || userData.photoURL
    };
    
    // Обновляем профиль пользователя
    updateUserProfile();
    
    // Загружаем контакты и чаты
    loadContacts();
    
    // Скрываем все модальные окна
    hideAllModals();
    
    // Устанавливаем онлайн статус
    setupPresence(firebaseUser.uid);
}

// Показать окно выбора ника
function showNicknameModal(user) {
    // Заполняем данные пользователя
    document.getElementById('preview-avatar').src = user.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}&background=64FFDA&color=0A192F`;
    document.getElementById('preview-email').textContent = user.email || 'Нет email';
    
    // Генерируем предложение ника на основе email
    const suggestedNick = generateNickFromEmail(user.email || 'User');
    document.getElementById('nickname-input').value = suggestedNick;
    document.getElementById('nickname-input').focus();
    
    // Показываем окно выбора ника
    hideGoogleLoginModal();
    document.getElementById('nickname-modal').style.display = 'flex';
}

// Генерация ника из email
function generateNickFromEmail(email) {
    const username = email.split('@')[0];
    // Убираем цифры и специальные символы, добавляем случайное число
    const cleanName = username.replace(/[0-9._-]/g, '');
    const randomNum = Math.floor(Math.random() * 1000);
    return (cleanName || 'User') + randomNum;
}

// Сохранение ника
async function saveNickname() {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput.value.trim();
    
    if (!nickname) {
        nicknameInput.style.borderColor = '#EF4444';
        setTimeout(() => {
            nicknameInput.style.borderColor = 'rgba(100, 255, 218, 0.3)';
        }, 2000);
        return;
    }
    
    if (nickname.length < 3) {
        alert('Ник должен содержать минимум 3 символа');
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            alert('Пользователь не найден. Попробуйте войти заново.');
            return;
        }
        
        // Сохраняем пользователя в базу данных
        await set(ref(database, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            nickname: nickname,
            photoURL: user.photoURL,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now()
        });
        
        // Обновляем текущего пользователя
        currentUser = {
            uid: user.uid,
            displayName: nickname,
            email: user.email,
            photoURL: user.photoURL
        };
        
        // Обновляем профиль
        updateUserProfile();
        
        // Загружаем контакты
        loadContacts();
        
        // Скрываем модальное окно
        hideAllModals();
        
        // Устанавливаем онлайн статус
        setupPresence(user.uid);
        
    } catch (error) {
        console.error('Ошибка сохранения ника:', error);
        alert('Не удалось сохранить ник. Попробуйте еще раз.');
    }
}

// Выход из системы
async function handleLogout() {
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
        document.getElementById('username').textContent = 'Гость';
        document.getElementById('user-avatar').src = 'https://ui-avatars.com/api/?name=User&background=64FFDA&color=0A192F';
        document.getElementById('user-status').textContent = 'не в сети';
        document.getElementById('user-status').className = 'offline';
        
        document.getElementById('chat-title').textContent = 'Выберите чат';
        document.getElementById('chat-status').textContent = 'начните общение';
        document.getElementById('messages-container').innerHTML = `
            <div class="welcome-message">
                <h2><i class="fas fa-water"></i> Добро пожаловать в NeoCascade!</h2>
                <p>Выберите контакт для начала общения</p>
                <p class="hint">Сообщения появляются как водопад - плавно и непрерывно</p>
            </div>
        `;
        
        document.getElementById('message-input').disabled = true;
        document.getElementById('send-btn').disabled = true;
        document.getElementById('message-input').placeholder = 'Введите сообщение...';
        document.getElementById('message-input').value = '';
        
        // Очищаем список контактов
        document.querySelector('.contacts-list').innerHTML = '<div class="no-contacts">Нет контактов</div>';
        
        // Сбрасываем активный чат
        document.querySelectorAll('.contact').forEach(contact => {
            contact.classList.remove('active');
        });
        
        // Показываем окно входа
        showGoogleLoginModal();
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        alert('Ошибка при выходе из системы');
    }
}

// Обновление профиля пользователя
function updateUserProfile() {
    if (!currentUser) return;
    
    document.getElementById('username').textContent = currentUser.displayName;
    document.getElementById('user-status').textContent = 'в сети';
    document.getElementById('user-status').className = 'online';
    
    // Используем фото Google или генерируем аватар
    if (currentUser.photoURL) {
        document.getElementById('user-avatar').src = currentUser.photoURL;
    } else {
        document.getElementById('user-avatar').src = 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=64FFDA&color=0A192F`;
    }
}

// Управление модальными окнами
function showGoogleLoginModal() {
    document.getElementById('google-login-modal').style.display = 'flex';
}

function hideGoogleLoginModal() {
    document.getElementById('google-login-modal').style.display = 'none';
}

function hideAllModals() {
    document.getElementById('google-login-modal').style.display = 'none';
    document.getElementById('nickname-modal').style.display = 'none';
    document.getElementById('announcement-modal').style.display = 'none';
}

// Настройка статуса присутствия
function setupPresence(userId) {
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
        
        // При отключении
        const onDisconnectRef = ref(database, `users/${userId}/online`);
        set(onDisconnectRef, false);
        set(ref(database, `users/${userId}/lastSeen`), Date.now());
    });
}

// Загрузка контактов
async function loadContacts() {
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
            
            // Определяем аватар
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
        }
    });
}

// Выбор чата
function selectChat(userId, username) {
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
    if (!currentUser || !currentChat) return;
    
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    
    if (!messageText) return;
    
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
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        alert('Не удалось отправить сообщение');
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
        alert('Сначала выберите чат!');
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
        alert('Пожалуйста, введите ссылку!');
        document.getElementById('announcement-link').focus();
        return;
    }
    
    if (!isValidUrl(link)) {
        alert('Пожалуйста, введите корректную ссылку (начинается с http:// или https://)');
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
        showNotification(`📢 Новое объявление от ${currentUser.displayName}`);
        
    } catch (error) {
        console.error('Ошибка отправки объявления:', error);
        alert('Не удалось отправить объявление');
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
        alert('Сначала войдите в систему!');
        return;
    }
    
    const username = prompt('Введите имя пользователя для нового чата:');
    if (!username) return;
    
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
    
    alert('Пользователь не найден. Пригласите его в NeoCascade!');
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
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
});
