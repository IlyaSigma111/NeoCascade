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
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let selectedCameraId = null;
let cameras = [];

// Конфигурация WebRTC
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
    document.addEventListener('click', (e) => {
        if (e.target.closest('.chat-item')) {
            const chatItem = e.target.closest('.chat-item');
            selectChat(chatItem);
        }
    });
    
    // Видеозвонок
    document.getElementById('video-call-btn').addEventListener('click', () => initVideoCall(true));
    document.getElementById('start-video-call').addEventListener('click', () => initVideoCall(false));
    document.getElementById('end-call').addEventListener('click', endVideoCall);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
    document.getElementById('camera-select').addEventListener('click', showCameraSelector);
    
    // Новый чат
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
    
    // Поиск
    document.getElementById('search-contacts').addEventListener('input', searchContacts);
    
    // Закрытие выбора камеры
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#camera-select') && !e.target.closest('#camera-selector')) {
            document.getElementById('camera-selector').classList.remove('active');
        }
    });
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
        document.querySelector('.partner-avatar').innerHTML = '<i class="fas fa-users"></i>';
    } else {
        const contact = contacts.find(c => c.id === chatId);
        if (contact) {
            document.getElementById('chat-title').textContent = contact.nickname;
            document.getElementById('chat-status').textContent = contact.online ? 'в сети' : 'не в сети';
            const avatarUrl = contact.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.nickname)}&background=7C3AED&color=fff`;
            document.querySelector('.partner-avatar').innerHTML = `<img src="${avatarUrl}" alt="${contact.nickname}">`;
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

// ВИДЕОЗВОНОК
async function initVideoCall(isGroup = false) {
    try {
        // Получаем список камер
        await getCameras();
        
        // Получаем медиапоток
        const constraints = {
            video: {
                deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        
        // Настраиваем удаленное видео
        const remoteVideo = document.getElementById('remote-video');
        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;
        
        // Создаем Peer Connection
        peerConnection = new RTCPeerConnection(configuration);
        
        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Обработка удаленного потока
        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
        };
        
        // ICE кандидаты
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Отправляем кандидата через Firebase
                sendIceCandidate(event.candidate);
            }
        };
        
        // Устанавливаем соединение
        if (!isGroup) {
            await createOffer();
        }
        
        // Показываем интерфейс
        document.getElementById('video-call-container').classList.add('active');
        videoCallActive = true;
        
        // Обновляем имя собеседника
        if (currentChat !== 'general') {
            const contact = contacts.find(c => c.id === currentChat);
            if (contact) {
                document.getElementById('remote-name').textContent = contact.nickname;
            }
        }
        
        // Запускаем таймер
        startCallTimer();
        
        showToast('Видеозвонок начат', 'success');
        
    } catch (error) {
        console.error('Ошибка видеозвонка:', error);
        showToast('Ошибка видеозвонка: ' + error.message, 'error');
    }
}

async function createOffer() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Сохраняем offer в Firebase
        const callRef = ref(database, `calls/${currentChat}`);
        await set(callRef, {
            type: 'offer',
            sdp: offer.sdp,
            from: currentUser.uid,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Ошибка создания offer:', error);
    }
}

async function sendIceCandidate(candidate) {
    try {
        const candidateRef = ref(database, `calls/${currentChat}/candidates`);
        await push(candidateRef, {
            candidate: JSON.stringify(candidate),
            from: currentUser.uid,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Ошибка отправки ICE кандидата:', error);
    }
}

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter(device => device.kind === 'videoinput');
        
        // Обновляем список камер в UI
        updateCameraList();
        
    } catch (error) {
        console.error('Ошибка получения камер:', error);
    }
}

function updateCameraList() {
    const cameraList = document.getElementById('camera-list');
    cameraList.innerHTML = '';
    
    if (cameras.length === 0) {
        cameraList.innerHTML = '<p>Камеры не найдены</p>';
        return;
    }
    
    cameras.forEach((camera, index) => {
        const button = document.createElement('button');
        button.textContent = camera.label || `Камера ${index + 1}`;
        button.addEventListener('click', () => switchCamera(camera.deviceId));
        cameraList.appendChild(button);
    });
}

async function switchCamera(deviceId) {
    try {
        if (localStream) {
            // Останавливаем старый видеотрек
            localStream.getVideoTracks().forEach(track => track.stop());
            
            // Получаем новый видеотрек
            const constraints = {
                video: { deviceId: { exact: deviceId } }
            };
            
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newVideoTrack = newStream.getVideoTracks()[0];
            
            // Заменяем видеотрек
            const sender = peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
            
            // Обновляем локальный поток
            localStream.addTrack(newVideoTrack);
            document.getElementById('local-video').srcObject = localStream;
            
            selectedCameraId = deviceId;
            showToast('Камера изменена', 'success');
            
            // Скрываем выбор камеры
            document.getElementById('camera-selector').classList.remove('active');
        }
    } catch (error) {
        console.error('Ошибка смены камеры:', error);
        showToast('Ошибка смены камеры', 'error');
    }
}

function showCameraSelector() {
    document.getElementById('camera-selector').classList.toggle('active');
}

function endVideoCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    document.getElementById('video-call-container').classList.remove('active');
    videoCallActive = false;
    
    stopCallTimer();
    
    // Очищаем данные звонка в Firebase
    if (currentChat) {
        const callRef = ref(database, `calls/${currentChat}`);
        set(callRef, null);
    }
    
    showToast('Звонок завершен', 'info');
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
            btn.title = videoTrack.enabled ? 'Выключить видео' : 'Включить видео';
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
            btn.title = audioTrack.enabled ? 'Выключить звук' : 'Включить звук';
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
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.classList.toggle('active');
    menu.style.top = '60px';
    menu.style.right = '15px';
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
        if (item.classList.contains('general-chat')) {
            item.style.display = 'flex';
            return;
        }
        
        const name = item.querySelector('.chat-name').textContent.toLowerCase();
        const isVisible = name.includes(searchTerm);
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
    
    // Поиск пользователя в базе данных
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
        const users = snapshot.val();
        const existingUser = Object.entries(users).find(([id, user]) => 
            user.nickname && user.nickname.toLowerCase() === username.toLowerCase()
        );
        
        if (existingUser) {
            // Создаем элемент чата
            const chatsList = document.getElementById('chats-list');
            const chatId = existingUser[0];
            
            const avatarUrl = existingUser[1].photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=7C3AED&color=fff`;
            
            const chatHTML = `
                <div class="chat-item" data-chat-id="${chatId}">
                    <div class="chat-avatar">
                        <img src="${avatarUrl}" alt="${username}">
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${username}</div>
                        <div class="chat-last">не в сети</div>
                    </div>
                </div>
            `;
            
            // Вставляем после общего чата
            const generalChat = document.querySelector('.general-chat');
            generalChat.insertAdjacentHTML('afterend', chatHTML);
            
            showToast(`Чат с ${username} создан`, 'success');
            return;
        }
    }
    
    showToast('Пользователь не найден', 'error');
}
