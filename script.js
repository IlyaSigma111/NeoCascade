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
const googleProvider = new firebase.auth.GoogleAuthProvider();

// АДМИН ДАННЫЕ
const ADMIN_EMAIL = 'admin@ilyasigma.com';
const ADMIN_PASSWORD = 'JojoTop1';

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let currentChat = 'general';

// ========== ДОМ ЭЛЕМЕНТЫ ==========
const loginModal = document.getElementById('login-modal');
const mainContainer = document.getElementById('main-container');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatList = document.getElementById('chat-list');
const usernameEl = document.getElementById('username');
const userStatus = document.getElementById('user-status');
const userAvatar = document.getElementById('user-avatar');
const chatTitle = document.getElementById('chat-title');
const logoutBtn = document.getElementById('logout-btn');

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('NeoCascade загружен!');
    
    // Проверяем авторизацию
    auth.onAuthStateChanged((user) => {
        if (user) {
            handleUserLogin(user);
        } else {
            showLoginModal();
        }
    });
    
    // Назначаем обработчики
    setupEventListeners();
});

// ========== НАЗНАЧЕНИЕ ОБРАБОТЧИКОВ ==========
function setupEventListeners() {
    console.log('Назначаем обработчики...');
    
    // Кнопки входа
    const emailLoginBtn = document.getElementById('email-login-btn');
    if (emailLoginBtn) {
        emailLoginBtn.addEventListener('click', handleEmailLogin);
        console.log('Обработчик email login назначен');
    }
    
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
        console.log('Обработчик google login назначен');
    }
    
    const emailRegisterBtn = document.getElementById('email-register-btn');
    if (emailRegisterBtn) {
        emailRegisterBtn.addEventListener('click', handleEmailRegister);
    }
    
    const adminLoginBtn = document.getElementById('admin-login-btn');
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', handleAdminLogin);
    }
    
    // Переключение форм
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
    
    // Отправка сообщений
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Выход
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Выбор чата
    if (chatList) {
        chatList.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem && chatItem.dataset.chat) {
                selectChat(chatItem.dataset.chat);
            }
        });
    }
}

// ========== ПОКАЗ МОДАЛКИ ==========
function showLoginModal() {
    console.log('Показываем модалку входа');
    if (loginModal) {
        loginModal.style.display = 'flex';
    }
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
}

// ========== СКРЫТЬ МОДАЛКУ ==========
function hideLoginModal() {
    if (loginModal) {
        loginModal.style.display = 'none';
    }
    if (mainContainer) {
        mainContainer.style.display = 'flex';
    }
}

// ========== GOOGLE ЛОГИН ==========
async function handleGoogleLogin() {
    console.log('Google login...');
    const btn = document.getElementById('google-login-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        const result = await auth.signInWithPopup(googleProvider);
        console.log('Google успех:', result.user.email);
        
    } catch (error) {
        console.error('Google ошибка:', error);
        showNotification('Ошибка входа через Google', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ========== EMAIL ЛОГИН ==========
async function handleEmailLogin() {
    console.log('Email login...');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Введите email и пароль', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Вход выполнен!', 'success');
        
    } catch (error) {
        console.error('Email ошибка:', error);
        showNotification('Неверный email или пароль', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ========== РЕГИСТРАЦИЯ ==========
async function handleEmailRegister() {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть от 6 символов', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        const result = await auth.createUserWithEmailAndPassword(email, password);
        await result.user.updateProfile({
            displayName: name
        });
        
        await db.ref(`users/${result.user.uid}`).set({
            name: name,
            email: email,
            online: true,
            lastSeen: Date.now()
        });
        
        showNotification('Регистрация успешна!', 'success');
        
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        
    } catch (error) {
        console.error('Register error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification('Email уже используется', 'error');
        } else {
            showNotification('Ошибка регистрации', 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ========== АДМИН ЛОГИН ==========
async function handleAdminLogin() {
    console.log('Admin login...');
    const btn = document.getElementById('admin-login-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        try {
            await auth.signInWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                await auth.createUserWithEmailAndPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
                const user = auth.currentUser;
                await user.updateProfile({
                    displayName: 'ИльяСигма111'
                });
            } else {
                throw error;
            }
        }
        
        showNotification('Добро пожаловать, Администратор!', 'success');
        
    } catch (error) {
        console.error('Admin error:', error);
        showNotification('Ошибка входа', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ========== ОБРАБОТКА ВХОДА ПОЛЬЗОВАТЕЛЯ ==========
async function handleUserLogin(user) {
    console.log('Пользователь вошел:', user.email);
    currentUser = user;
    
    // Обновляем статус в БД
    await db.ref(`users/${user.uid}`).update({
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        online: true,
        lastSeen: Date.now()
    });
    
    // Настраиваем отключение
    db.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            db.ref(`users/${user.uid}/online`).set(true);
            db.ref(`users/${user.uid}/online`).onDisconnect().set(false);
            db.ref(`users/${user.uid}/lastSeen`).onDisconnect().set(Date.now());
        }
    });
    
    // Обновляем UI
    usernameEl.textContent = user.displayName || user.email.split('@')[0];
    userStatus.textContent = 'в сети';
    userStatus.className = 'online';
    
    if (user.photoURL) {
        userAvatar.innerHTML = `<img src="${user.photoURL}" alt="avatar">`;
    }
    
    // Скрываем модалку, показываем чат
    hideLoginModal();
    
    // Загружаем данные
    loadMessages();
    loadContacts();
    
    showNotification(`Привет, ${user.displayName || 'друг'}!`, 'success');
}

// ========== ЗАГРУЗКА КОНТАКТОВ ==========
function loadContacts() {
    if (!currentUser) return;
    
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        // Сохраняем общий чат
        const generalChat = document.querySelector('.chat-item[data-chat="general"]');
        let html = generalChat ? generalChat.outerHTML : '';
        
        // Добавляем контакты
        Object.entries(users).forEach(([id, user]) => {
            if (id === currentUser?.uid) return;
            
            html += `
                <div class="chat-item" data-chat="${id}">
                    <div class="chat-icon" style="background: #10B981;">
                        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=10B981&color=fff`}" alt="avatar">
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${user.name || 'Пользователь'}</div>
                        <div class="chat-preview" style="color: ${user.online ? '#10B981' : '#94A3B8'};">
                            ${user.online ? 'в сети' : 'не в сети'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        chatList.innerHTML = html;
    });
}

// ========== ВЫБОР ЧАТА ==========
function selectChat(chatId) {
    currentChat = chatId;
    
    // Обновляем активный класс
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selected = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (selected) {
        selected.classList.add('active');
    }
    
    // Обновляем заголовок
    if (chatId === 'general') {
        chatTitle.textContent = 'Общий чат';
    } else {
        db.ref(`users/${chatId}`).once('value', (snapshot) => {
            const user = snapshot.val();
            if (user) {
                chatTitle.textContent = user.name || 'Пользователь';
            }
        });
    }
    
    // Загружаем сообщения
    loadMessages();
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages() {
    if (!currentUser) return;
    
    const messagesRef = db.ref(`chats/${currentChat}/messages`).limitToLast(50);
    
    messagesRef.off();
    messagesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        messagesContainer.innerHTML = '';
        
        if (!data) {
            messagesContainer.innerHTML = `
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
            const isSent = msg.senderId === currentUser?.uid;
            const time = new Date(msg.timestamp).toLocaleTimeString('ru', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const messageEl = document.createElement('div');
            messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
            messageEl.innerHTML = `
                <div>${escapeHtml(msg.text || '')}</div>
                <div class="message-time">${time}</div>
            `;
            
            messagesContainer.appendChild(messageEl);
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
async function sendMessage() {
    if (!currentUser || !messageInput.value.trim()) return;
    
    const text = messageInput.value.trim();
    messageInput.value = '';
    
    const messagesRef = db.ref(`chats/${currentChat}/messages`).push();
    
    await messagesRef.set({
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        timestamp: Date.now()
    });
}

// ========== ВЫХОД ==========
async function handleLogout() {
    if (currentUser) {
        await db.ref(`users/${currentUser.uid}`).update({
            online: false,
            lastSeen: Date.now()
        });
    }
    
    await auth.signOut();
    
    currentUser = null;
    showLoginModal();
    showNotification('Вы вышли из системы', 'info');
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'info') icon = '📢';
    
    notification.innerHTML = `${icon} ${message}`;
    
    if (type === 'error') {
        notification.style.borderLeftColor = '#EF4444';
    } else if (type === 'success') {
        notification.style.borderLeftColor = '#10B981';
    }
    
    container.appendChild(notification);
    
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

console.log('✅ NeoCascade script загружен!');
