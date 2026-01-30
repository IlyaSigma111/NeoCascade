import { 
    database, ref, push, onValue, set, get, child,
    auth, signInAnonymously, onAuthStateChanged 
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

// Инициализация Firebase и аутентификация
function initApp() {
    // Показываем модальное окно входа
    showLoginModal();
    
    // Запрашиваем разрешение на уведомления
    if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => {
            Notification.requestPermission();
        }, 2000);
    }
    
    // Проверяем состояние аутентификации
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                displayName: user.displayName || 'Аноним'
            };
            
            updateUserProfile();
            loadContacts();
            hideLoginModal();
        }
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Кнопка входа
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // Ввод имени по Enter
    document.getElementById('login-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
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

// Обработчик входа
async function handleLogin() {
    const nameInput = document.getElementById('login-name');
    const username = nameInput.value.trim();
    
    if (!username) {
        nameInput.style.borderColor = '#EF4444';
        setTimeout(() => {
            nameInput.style.borderColor = 'rgba(100, 255, 218, 0.3)';
        }, 2000);
        return;
    }
    
    try {
        // Анонимный вход
        const userCredential = await signInAnonymously(auth);
        
        // Обновляем имя пользователя в базе данных
        await set(ref(database, `users/${userCredential.user.uid}`), {
            username: username,
            online: true,
            lastSeen: Date.now()
        });
        
        // Устанавливаем онлайн статус
        setupPresence(userCredential.user.uid);
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка при входе. Попробуйте еще раз.');
    }
}

// Настройка статуса присутствия
function setupPresence(userId) {
    const userStatusRef = ref(database, `users/${userId}/online`);
    const userLastSeenRef = ref(database, `users/${userId}/lastSeen`);
    
    // При отключении устанавливаем статус офлайн
    const disconnectRef = ref(database, '.info/connected');
    onValue(disconnectRef, (snapshot) => {
        if (snapshot.val() === false) return;
        
        // При подключении устанавливаем онлайн
        set(userStatusRef, true);
        
        // При отключении устанавливаем офлайн
        set(userStatusRef, false);
        set(userLastSeenRef, Date.now());
    });
}

// Обновление профиля пользователя
function updateUserProfile() {
    if (!currentUser) return;
    
    document.getElementById('username').textContent = currentUser.displayName;
    document.getElementById('user-avatar').src = 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName)}&background=64FFDA&color=0A192F`;
}

// Загрузка контактов
async function loadContacts() {
    const contactsRef = ref(database, 'users');
    
    onValue(contactsRef, (snapshot) => {
        const data = snapshot.val();
        contacts = [];
        const contactsList = document.querySelector('.contacts-list');
        contactsList.innerHTML = '';
        
        if (!data) {
            contactsList.innerHTML = '<p class="no-contacts">Контактов нет</p>';
            return;
        }
        
        Object.entries(data).forEach(([userId, userData]) => {
            // Пропускаем текущего пользователя
            if (userId === currentUser.uid) return;
            
            contacts.push({
                id: userId,
                ...userData
            });
            
            // Создаем элемент контакта
            const contactElement = document.createElement('div');
            contactElement.className = 'contact';
            contactElement.dataset.userId = userId;
            
            contactElement.innerHTML = `
                <div class="contact-avatar" style="background: linear-gradient(135deg, #7C3AED, #64FFDA)">
                    ${userData.username ? userData.username.charAt(0).toUpperCase() : '?'}
                </div>
                <div class="contact-info">
                    <div class="contact-name">${userData.username || 'Аноним'}</div>
                    <div class="last-message">${userData.online ? 'в сети' : 'не в сети'}</div>
                </div>
            `;
            
            // Добавляем обработчик клика
            contactElement.addEventListener('click', () => selectChat(userId, userData.username));
            
            contactsList.appendChild(contactElement);
        });
    });
}

// Выбор чата
function selectChat(userId, username) {
    currentChat = userId;
    
    // Обновляем заголовок чата
    document.getElementById('chat-title').textContent = username;
    document.getElementById('chat-status').textContent = 'в сети';
    
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
        
        // Прокручиваем вниз
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
        // Пример команды: /announce Заголовок|Текст|ссылка
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
    
    // Обычное сообщение
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
        
        await updateLastMessage(chatId, messageText);
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        alert('Не удалось отправить сообщение');
    }
}

// Обновление последнего сообщения
async function updateLastMessage(chatId, lastMessage) {
    const chatRef = ref(database, `chats/${chatId}`);
    const snapshot = await get(child(ref(database), `chats/${chatId}`));
    
    if (snapshot.exists()) {
        await set(ref(database, `chats/${chatId}/lastMessage`), {
            text: lastMessage,
            timestamp: Date.now(),
            senderId: currentUser.uid
        });
    }
}

// Функции для работы с объявлениями
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
    // Очищаем поля
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
        
        // Показываем уведомление
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
    
    // Если это объявление
    if (isAnnouncement || message.type === 'announcement' || message.isAnnouncement) {
        const announcementElement = document.createElement('div');
        announcementElement.className = 'message announcement-message';
        
        // Извлекаем домен для красивого отображения
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
    } 
    // Обычное сообщение
    else {
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
    
    contactElements.forEach(contact => {
        const contactName = contact.querySelector('.contact-name').textContent.toLowerCase();
        const isVisible = contactName.includes(searchTerm);
        contact.style.display = isVisible ? 'flex' : 'none';
    });
}

// Создание нового чата
async function createNewChat() {
    const username = prompt('Введите имя пользователя для нового чата:');
    if (!username) return;
    
    // Проверяем, существует ли пользователь
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
        const users = snapshot.val();
        const existingUser = Object.entries(users).find(([id, user]) => 
            user.username.toLowerCase() === username.toLowerCase()
        );
        
        if (existingUser) {
            selectChat(existingUser[0], existingUser[1].username);
            return;
        }
    }
    
    // Создаем нового пользователя
    const newUserRef = push(usersRef);
    const newUserId = newUserRef.key;
    
    await set(newUserRef, {
        username: username,
        online: false,
        lastSeen: Date.now()
    });
    
    selectChat(newUserId, username);
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

// Показать модальное окно входа
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-name').focus();
}

// Скрыть модальное окно входа
function hideLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

// Функция для проверки URL
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
    // Проверяем размер экрана
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
    
    // Фокус на поле входа
    document.getElementById('login-name').focus();
});
