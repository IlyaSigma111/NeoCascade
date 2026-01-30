import { 
    database, ref, push, onValue, set, get, child, 
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPopup, googleProvider, onAuthStateChanged, signOut, updateProfile 
} from './firebase-config.js';

// Глобальные переменные
let currentUser = null;
let currentChat = 'general';
let contacts = [];
let localStream = null;
let peerConnections = new Map();
let callActive = false;
let callTimer = null;
let callStartTime = null;

// Конфигурация WebRTC (упрощенная для группового чата)
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

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
            showLoginModal();
        }
    });
    
    // Слушаем звонки в общем чате
    listenForCalls();
}

function setupEventListeners() {
    // Переключение форм
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.login-container').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.querySelector('.login-container').style.display = 'block';
    });
    
    // Кнопки входа
    document.getElementById('email-login-btn').addEventListener('click', handleEmailLogin);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
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
    
    // Звонки
    document.getElementById('start-group-call').addEventListener('click', startGroupCall);
    document.getElementById('join-call-btn').addEventListener('click', joinCall);
    document.querySelectorAll('.video-call-mini').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            joinCall();
        });
    });
    
    // Управление звонком
    document.getElementById('end-call').addEventListener('click', endCall);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
    
    // Выбор чата
    document.addEventListener('click', (e) => {
        if (e.target.closest('.chat-item')) {
            const chatItem = e.target.closest('.chat-item');
            selectChat(chatItem);
        }
    });
}

// Вход по email
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage('Вход выполнен', 'success');
    } catch (error) {
        console.error('Ошибка входа:', error);
        showMessage('Ошибка входа. Проверьте данные', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
    }
}

// Вход через Google
async function handleGoogleLogin() {
    try {
        await signInWithPopup(auth, googleProvider);
        showMessage('Вход выполнен', 'success');
    } catch (error) {
        console.error('Ошибка Google входа:', error);
        showMessage('Ошибка входа через Google', 'error');
    }
}

// Регистрация
async function handleEmailRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) {
        showMessage('Заполните все поля', 'error');
        return;
    }
    
    if (name.length < 2) {
        showMessage('Имя должно содержать минимум 2 символа', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Пароль должен содержать минимум 6 символов', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, {
            displayName: name
        });
        
        await set(ref(database, `users/${user.uid}`), {
            uid: user.uid,
            email: user.email,
            name: name,
            online: true,
            lastSeen: Date.now(),
            createdAt: Date.now()
        });
        
        showMessage('Регистрация успешна!', 'success');
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showMessage('Ошибка регистрации. Попробуйте другой email', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Зарегистрироваться';
    }
}

// Обработка входа пользователя
async function handleUserLogin(firebaseUser) {
    const userData = await checkAndUpdateUserInDatabase(firebaseUser);
    
    currentUser = {
        uid: firebaseUser.uid,
        name: userData.name || firebaseUser.displayName || firebaseUser.email.split('@')[0],
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL
    };
    
    hideLoginModal();
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
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
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
    
    document.getElementById('username').textContent = currentUser.name;
    document.getElementById('user-status').textContent = 'в сети';
    document.getElementById('user-status').className = 'online';
    
    const avatarUrl = currentUser.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=3B82F6&color=fff`;
    
    document.getElementById('user-avatar').src = avatarUrl;
}

// Активация интерфейса
function enableUI() {
    if (!currentUser) return;
    
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-btn').disabled = false;
    document.getElementById('join-call-btn').disabled = false;
    document.getElementById('message-input').placeholder = 'Введите сообщение...';
    document.getElementById('message-input').focus();
    
    // Показываем кнопку звонка
    document.getElementById('start-group-call').style.display = 'flex';
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
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=10B981&color=fff`;
                
                contactsHTML += `
                    <div class="chat-item" data-chat-id="${userId}">
                        <div class="chat-icon">
                            <img src="${avatarUrl}" alt="${userData.name}">
                        </div>
                        <div class="chat-details">
                            <div class="chat-name">${userData.name}</div>
                            <div class="chat-preview">${userData.online ? 'в сети' : 'не в сети'}</div>
                        </div>
                        <button class="video-call-mini" data-chat-id="${userId}" title="Позвонить">
                            <i class="fas fa-video"></i>
                        </button>
                    </div>
                `;
            });
        }
        
        // Добавляем контакты после общего чата
        chatsList.innerHTML = document.querySelector('.chat-item[data-chat-id="general"]').outerHTML + contactsHTML;
        
        // Переустанавливаем обработчики кнопок звонка
        document.querySelectorAll('.video-call-mini').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chatId = btn.dataset.chatId;
                if (chatId === 'general') {
                    joinCall();
                } else {
                    startPrivateCall(chatId);
                }
            });
        });
    });
}

// Выбор чата
function selectChat(chatItem) {
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
        document.querySelector('.chat-partner .avatar').innerHTML = '<i class="fas fa-users"></i>';
    } else {
        const contact = contacts.find(c => c.id === chatId);
        if (contact) {
            document.getElementById('chat-title').textContent = contact.name;
            document.getElementById('chat-status').textContent = contact.online ? 'в сети' : 'не в сети';
            const avatarUrl = contact.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=10B981&color=fff`;
            document.querySelector('.chat-partner .avatar').innerHTML = `<img src="${avatarUrl}" alt="${contact.name}">`;
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
                    <div class="welcome-screen">
                        <div class="welcome-icon">
                            <i class="fas fa-comments"></i>
                        </div>
                        <h3>Общий чат</h3>
                        <p>Начните общение в групповом чате!</p>
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
    const welcomeScreen = document.querySelector('.welcome-screen');
    
    if (welcomeScreen) {
        welcomeScreen.remove();
    }
    
    const isSent = message.senderId === currentUser?.uid;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const htmlContent = `
        <div class="message-content">${escapeHtml(message.text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    messageElement.innerHTML = htmlContent;
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser || !currentChat) {
        showMessage('Сначала войдите в систему', 'error');
        return;
    }
    
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    
    if (!messageText) {
        showMessage('Введите сообщение', 'error');
        return;
    }
    
    const messagesRef = ref(database, `chats/${currentChat}/messages`);
    const newMessageRef = push(messagesRef);
    
    const messageData = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        timestamp: Date.now()
    };
    
    try {
        await set(newMessageRef, messageData);
        input.value = '';
        input.focus();
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        showMessage('Не удалось отправить сообщение', 'error');
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
        
        if (callActive) {
            endCall();
        }
        
        await signOut(auth);
        
        currentUser = null;
        contacts = [];
        
        resetUI();
        showLoginModal();
        
        showMessage('Выход выполнен', 'success');
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showMessage('Ошибка при выходе', 'error');
    }
}

// Сброс UI
function resetUI() {
    document.getElementById('username').textContent = 'Гость';
    document.getElementById('user-avatar').src = 'https://ui-avatars.com/api/?name=Гость&background=3B82F6&color=fff';
    document.getElementById('user-status').textContent = 'не в сети';
    document.getElementById('user-status').className = 'offline';
    
    document.getElementById('chat-title').textContent = 'Общий чат';
    document.getElementById('chat-status').textContent = 'войдите в систему';
    
    document.getElementById('messages-container').innerHTML = `
        <div class="welcome-screen">
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
    
    document.getElementById('start-group-call').style.display = 'none';
    
    document.getElementById('chats-list').innerHTML = `
        <div class="chat-item active" data-chat-id="general">
            <div class="chat-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="chat-details">
                <div class="chat-name">Общий чат</div>
                <div class="chat-preview">Присоединяйтесь к беседе</div>
            </div>
            <button class="video-call-mini" data-chat-id="general" title="Присоединиться к звонку">
                <i class="fas fa-video"></i>
            </button>
        </div>
    `;
}

// ВИДЕОЗВОНКИ
async function startGroupCall() {
    try {
        // Получаем медиапоток
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        // Показываем локальное видео
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        
        // Создаем запись о звонке в общем чате
        const callRef = ref(database, `calls/general`);
        await set(callRef, {
            active: true,
            startedBy: currentUser.uid,
            startedAt: Date.now(),
            participants: {
                [currentUser.uid]: true
            }
        });
        
        // Показываем интерфейс звонка
        showCallInterface();
        
        showMessage('Групповой звонок начат', 'success');
        
    } catch (error) {
        console.error('Ошибка начала звонка:', error);
        showMessage('Не удалось начать звонок: ' + error.message, 'error');
    }
}

async function joinCall() {
    if (callActive) return;
    
    try {
        // Получаем медиапоток
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        // Показываем локальное видео
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        
        // Обновляем запись о звонке
        const callRef = ref(database, `calls/general`);
        const snapshot = await get(callRef);
        
        if (snapshot.exists() && snapshot.val().active) {
            await set(ref(database, `calls/general/participants/${currentUser.uid}`), true);
            
            // Подключаемся к другим участникам
            const callData = snapshot.val();
            Object.keys(callData.participants || {}).forEach(userId => {
                if (userId !== currentUser.uid) {
                    connectToUser(userId);
                }
            });
            
            showCallInterface();
            showMessage('Вы присоединились к звонку', 'success');
        } else {
            showMessage('Активный звонок не найден', 'error');
            localStream.getTracks().forEach(track => track.stop());
        }
        
    } catch (error) {
        console.error('Ошибка присоединения к звонку:', error);
        showMessage('Не удалось присоединиться: ' + error.message, 'error');
    }
}

async function startPrivateCall(userId) {
    if (callActive) return;
    
    try {
        // Получаем медиапоток
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        
        // Создаем запись о приватном звонке
        const callId = [currentUser.uid, userId].sort().join('_');
        const callRef = ref(database, `calls/${callId}`);
        
        await set(callRef, {
            active: true,
            participants: {
                [currentUser.uid]: true,
                [userId]: true
            },
            startedAt: Date.now()
        });
        
        showCallInterface();
        showMessage('Звонок начат', 'success');
        
    } catch (error) {
        console.error('Ошибка приватного звонка:', error);
        showMessage('Не удалось позвонить: ' + error.message, 'error');
    }
}

function listenForCalls() {
    // Слушаем звонки в общем чате
    const callsRef = ref(database, 'calls');
    
    onValue(callsRef, (snapshot) => {
        const data = snapshot.val();
        
        if (!data || !data.general || !data.general.active) {
            // Нет активных звонков
            return;
        }
        
        const callData = data.general;
        const participants = Object.keys(callData.participants || {}).length;
        
        // Показываем индикатор активного звонка
        document.getElementById('join-call-btn').disabled = false;
        document.getElementById('join-call-btn').title = `Присоединиться (${participants} участников)`;
        
        // Обновляем счетчик в сайдбаре
        const callMiniBtn = document.querySelector('.video-call-mini[data-chat-id="general"]');
        if (callMiniBtn) {
            callMiniBtn.innerHTML = `<i class="fas fa-video"></i> <small>${participants}</small>`;
        }
        
    }, { onlyOnce: false });
}

async function connectToUser(userId) {
    try {
        const peerConnection = new RTCPeerConnection(configuration);
        
        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Создаем предложение
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Сохраняем предложение в Firebase
        const offerRef = ref(database, `offers/${currentUser.uid}_${userId}`);
        await set(offerRef, {
            sdp: offer.sdp,
            type: 'offer',
            from: currentUser.uid,
            to: userId,
            timestamp: Date.now()
        });
        
        peerConnections.set(userId, peerConnection);
        
        // Слушаем ответы
        listenForAnswer(userId, peerConnection);
        
    } catch (error) {
        console.error('Ошибка подключения:', error);
    }
}

async function listenForAnswer(userId, peerConnection) {
    const answerRef = ref(database, `answers/${userId}_${currentUser.uid}`);
    
    onValue(answerRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: data.sdp
            }));
        } catch (error) {
            console.error('Ошибка установки ответа:', error);
        }
    }, { onlyOnce: true });
}

function showCallInterface() {
    document.getElementById('video-call-container').classList.add('active');
    callActive = true;
    startCallTimer();
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Закрываем все соединения
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    
    // Удаляем запись о звонке
    const callRef = ref(database, `calls/general`);
    set(callRef, null);
    
    document.getElementById('video-call-container').classList.remove('active');
    callActive = false;
    stopCallTimer();
    
    // Очищаем удаленные видео
    document.getElementById('remote-videos').innerHTML = '';
    
    showMessage('Звонок завершен', 'info');
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
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
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('toggle-audio');
            btn.innerHTML = audioTrack.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
        }
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
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function showMessage(message, type) {
    // Простой вывод сообщения в консоль и alert для демо
    console.log(`${type}: ${message}`);
    if (type === 'error') {
        alert(`Ошибка: ${message}`);
    }
}

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
