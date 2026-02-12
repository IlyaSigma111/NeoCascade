// Firebase конфиг
const firebaseConfig = {
    apiKey: "AIzaSyDxGOGD6Oooo1CILrmrTpzy5Sq_MPuGiKM",
    authDomain: "messenger-4a3ab.firebaseapp.com",
    databaseURL: "https://messenger-4a3ab-default-rtdb.firebaseio.com",
    projectId: "messenger-4a3ab",
    storageBucket: "messenger-4a3ab.firebasestorage.app",
    messagingSenderId: "684785124123",
    appId: "1:684785124123:web:15efc74d7bb49259b789be"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Админ данные
const ADMIN_EMAIL = 'admin@ilyasigma.com';
const ADMIN_PASSWORD = 'JojoTop1';

// Глобальные переменные
let currentUser = null;
let currentChat = 'general';

// ========== ЭЛЕМЕНТЫ ==========
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
    // Проверка авторизации
    auth.onAuthStateChanged((user) => {
        if (user) {
            handleUserLogin(user);
        } else {
            showLoginModal();
        }
    });
    
    // Обработчики
    setupEventListeners();
});

function setupEventListeners() {
    // Логин
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
    sendBtn?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Выход
    logoutBtn?.addEventListener('click', handleLogout);
    
    // Выбор чата
    chatList?.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            selectChat(chatItem.dataset.chat);
        }
    });
}

// ========== GOOGLE ЛОГИН ==========
async function handleGoogleLogin() {
    const btn = document.getElementById('google-login-btn');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<div class="loading"></div>';
        
        const result = await auth.signInWithPopup(googleProvider);
        console.log('Google вход успешен:', result.user.email);
        
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
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Заполните все поля', 'error');
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
        
        await database.ref(`users/${result.user.uid}`).set({
            name: name,
            email: email,
            online: true,
            lastSeen: Date.now()
        });
        
        showNotification('Регистрация успешна!', 'success');
        
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        
    } catch (error) {
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
        showNotification('Ошибка входа', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ========== ОБРАБОТКА ВХОДА ==========
async function handleUserLogin(user) {
    currentUser = user;
    
    // Обновляем статус
    await database.ref(`users/${user.uid}`).update({
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        online: true,
        lastSeen: Date.now()
    });
    
    // Настраиваем отключение
    database.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            database.ref(`users/${user.uid}/online`).set(true);
            database.ref(`users/${user.uid}/online`).onDisconnect().set(false);
            database.ref(`users/${user.uid}/lastSeen`).onDisconnect().set(Date.now());
        }
    });
    
    // Обновляем UI
    usernameEl.textContent = user.displayName || user.email.split('@')[0];
    userStatus.textContent = 'в сети';
    userStatus.className = 'online';
    
    if (user.photoURL) {
        userAvatar.innerHTML = `<img src="${user.photoURL}" alt="avatar">`;
    }
    
    // Показываем основной интерфейс
    loginModal.style.display = 'none';
    mainContainer.style.display = 'flex';
    
    // Загружаем сообщения
    loadMessages();
    loadContacts();
    
    showNotification(`Привет, ${user.displayName || 'друг'}!`, 'success');
}

// ========== ЗАГРУЗКА КОНТАКТОВ ==========
function loadContacts() {
    database.ref('users').on('value', (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        
        let contactsHTML = '';
        
        Object.entries(users).forEach(([id, user]) => {
            if (id === currentUser?.uid) return;
            
            contactsHTML += `
                <div class="chat-item" data-chat="${id}">
                    <div class="chat-icon" style="background: #10B981;">
                        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=10B981&color=fff`}" alt="avatar">
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${user.name || 'User'}</div>
                        <div style="font-size: 12px; color: ${user.online ? '#10B981' : '#94A3B8'};">
                            ${user.online ? 'в сети' : 'не в сети'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Сохраняем общий чат
        const generalChat = chatList.querySelector('.chat-item[data-chat="general"]')?.outerHTML || '';
        chatList.innerHTML = generalChat + contactsHTML;
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
    if (selected) selected.classList.add('active');
    
    // Обновляем заголовок
    if (chatId === 'general') {
        chatTitle.textContent = 'Общий чат';
    } else {
        database.ref(`users/${chatId}`).once('value', (snapshot) => {
            const user = snapshot.val();
            if (user) chatTitle.textContent = user.name || 'Пользователь';
        });
    }
    
    // Загружаем сообщения
    loadMessages();
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadMessages() {
    const messagesRef = database.ref(`chats/${currentChat}/messages`).limitToLast(50);
    
    messagesRef.off();
    messagesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        messagesContainer.innerHTML = '';
        
        if (!data) {
            messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #94A3B8;">
                    <i class="fas fa-comments" style="font-size: 48px; color: #3B82F6; margin-bottom: 16px;"></i>
                    <h3 style="color: white;">Нет сообщений</h3>
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
                <div>${escapeHtml(msg.text)}</div>
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
    
    const messagesRef = database.ref(`chats/${currentChat}/messages`).push();
    
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
        await database.ref(`users/${currentUser.uid}`).update({
            online: false,
            lastSeen: Date.now()
        });
    }
    
    await auth.signOut();
    
    currentUser = null;
    loginModal.style.display = 'flex';
    mainContainer.style.display = 'none';
    
    showNotification('Вы вышли из системы', 'info');
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    
    notification.innerHTML = `${icon} ${message}`;
    
    if (type === 'error') notification.style.borderLeftColor = '#EF4444';
    if (type === 'success') notification.style.borderLeftColor = '#10B981';
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ========== ЭКРАНИРОВАНИЕ ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
