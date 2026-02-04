import { 
    database, ref, push, onValue, set, get, child, 
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signInWithPopup, googleProvider, onAuthStateChanged, signOut, updateProfile 
} from './firebase-config.js';

// Конфигурация
const CONFIG = {
    ICE_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ],
    DEFAULT_DISCRIMINATOR: '0000',
    MAX_CHANNELS: 50,
    MESSAGES_PER_LOAD: 100,
    TYPING_TIMEOUT: 3000
};

// Глобальное состояние
let state = {
    currentUser: null,
    currentChat: 'general',
    currentChatType: 'channel',
    contacts: new Map(),
    channels: new Map(),
    dms: new Map(),
    messages: new Map(),
    typingUsers: new Map(),
    
    // Звонки
    localStream: null,
    peerConnections: new Map(),
    callActive: false,
    callStartTime: null,
    callTimer: null,
    screenStream: null,
    
    // UI
    theme: 'dark',
    notifications: true,
    emojiPickerOpen: false,
    voiceRecording: false,
    mediaRecorder: null,
    audioChunks: []
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    initSoundEffects();
    setupServiceWorker();
});

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initApp() {
    // Проверяем тему
    const savedTheme = localStorage.getItem('neocascade-theme');
    if (savedTheme) {
        switchTheme(savedTheme);
        state.theme = savedTheme;
    }
    
    // Авторизация
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await handleUserLogin(user);
        } else {
            showLoginModal();
        }
    });
    
    // Инициализируем звуки
    initSoundEffects();
}

function setupEventListeners() {
    // Навигация
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        toggleForms();
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        toggleForms();
    });
    
    // Авторизация
    document.getElementById('email-login-btn').addEventListener('click', handleEmailLogin);
    document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
    document.getElementById('github-login-btn').addEventListener('click', handleSocialLogin);
    document.getElementById('discord-login-btn').addEventListener('click', handleSocialLogin);
    document.getElementById('email-register-btn').addEventListener('click', handleEmailRegister);
    
    // Сообщения
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('input', handleTyping);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Поиск пользователей
    document.getElementById('search-user').addEventListener('click', searchUser);
    document.getElementById('user-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUser();
    });
    
    // Создание каналов
    document.getElementById('create-channel-btn').addEventListener('click', showCreateChannelModal);
    document.getElementById('confirm-create').addEventListener('click', createChannel);
    document.getElementById('cancel-create').addEventListener('click', hideCreateChannelModal);
    document.querySelector('.modal-close').addEventListener('click', hideCreateChannelModal);
    
    // Звонки
    document.getElementById('start-group-call').addEventListener('click', startGroupCall);
    document.getElementById('join-call-btn').addEventListener('click', joinCall);
    document.getElementById('end-call').addEventListener('click', endCall);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
    document.getElementById('screen-share').addEventListener('click', toggleScreenShare);
    
    // Голосовые сообщения
    document.getElementById('voice-btn').addEventListener('click', toggleVoiceRecording);
    document.getElementById('cancel-recording').addEventListener('click', cancelVoiceRecording);
    document.getElementById('send-recording').addEventListener('click', sendVoiceMessage);
    
    // Эмодзи
    document.getElementById('emoji-btn').addEventListener('click', toggleEmojiPicker);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#emoji-picker') && !e.target.closest('#emoji-btn')) {
            hideEmojiPicker();
        }
    });
    
    // Темы
    document.querySelector('.theme-toggle').addEventListener('click', toggleTheme);
    
    // Уведомления
    document.getElementById('notifications-toggle').addEventListener('click', toggleNotifications);
    
    // Файлы
    document.getElementById('attach-btn').addEventListener('click', openFilePicker);
    
    // Рефреш
    document.getElementById('refresh-chats').addEventListener('click', refreshData);
    
    // Выход
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Команды
    setupCommands();
}

// ==================== АУТЕНТИФИКАЦИЯ ====================
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    const btn = document.getElementById('email-login-btn');
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        playSound('login');
        showNotification('Квантовый вход успешен!', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Ошибка входа: ' + error.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти в систему';
        btn.disabled = false;
    }
}

async function handleGoogleLogin() {
    try {
        await signInWithPopup(auth, googleProvider);
        playSound('login');
        showNotification('Гугл-авторизация успешна!', 'success');
    } catch (error) {
        showNotification('Ошибка Google входа', 'error');
    }
}

async function handleEmailRegister() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-password-confirm').value;
    
    // Валидация
    if (!name || !email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (name.length < 3) {
        showNotification('Имя должно быть от 3 символов', 'error');
        return;
    }
    
    if (password.length < 8) {
        showNotification('Пароль от 8 символов', 'error');
        return;
    }
    
    if (password !== confirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    const btn = document.getElementById('email-register-btn');
    btn.innerHTML = '<div class="loading"></div>';
    btn.disabled = true;
    
    try {
        // Регистрируем
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Генерируем дискриминатор
        const discriminator = generateDiscriminator();
        const displayName = `${name}#${discriminator}`;
        
        // Обновляем профиль
        await updateProfile(user, {
            displayName: displayName,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff&bold=true`
        });
        
        // Сохраняем в БД
        const userData = {
            uid: user.uid,
            email: user.email,
            username: name,
            discriminator: discriminator,
            displayName: displayName,
            photoURL: user.photoURL,
            bio: 'Новый пользователь NeoCascade',
            status: 'online',
            statusText: 'В потоке...',
            lastSeen: Date.now(),
            createdAt: Date.now(),
            badges: ['newbie'],
            theme: 'dark'
        };
        
        await set(ref(database, `users/${user.uid}`), userData);
        
        playSound('success');
        showNotification('Квантовый аккаунт создан!', 'success');
        
    } catch (error) {
        console.error('Register error:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Создать квантовый аккаунт';
        btn.disabled = false;
    }
}

// ==================== СИСТЕМА ДИСКРИМИНАТОРОВ ====================
function generateDiscriminator() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function formatDisplayName(username, discriminator) {
    return `${username}#${discriminator}`;
}

// ==================== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ====================
async function searchUser() {
    const searchInput = document.getElementById('user-search').value.trim();
    
    if (!searchInput) {
        showNotification('Введите username#1234', 'warning');
        return;
    }
    
    // Проверяем формат
    const match = searchInput.match(/^(.+)#(\d{4})$/);
    if (!match) {
        showNotification('Формат: username#1234', 'error');
        return;
    }
    
    const [_, username, discriminator] = match;
    
    try {
        // Ищем в Firebase
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        const allUsers = snapshot.val();
        const targetUser = Object.values(allUsers).find(user => 
            user.username.toLowerCase() === username.toLowerCase() && 
            user.discriminator === discriminator
        );
        
        if (!targetUser) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        // Открываем ЛС
        await openDM(targetUser.uid, targetUser);
        document.getElementById('user-search').value = '';
        
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Ошибка поиска', 'error');
    }
}

// ==================== КАНАЛЫ И ЧАТЫ ====================
async function createChannel() {
    const name = document.getElementById('channel-name').value.trim();
    const topic = document.getElementById('channel-topic').value.trim();
    const type = document.getElementById('channel-type').value;
    
    if (!name) {
        showNotification('Введите название канала', 'error');
        return;
    }
    
    try {
        const channelId = `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const channelRef = ref(database, `channels/${channelId}`);
        
        const channelData = {
            id: channelId,
            name: name,
            topic: topic,
            type: type,
            createdBy: state.currentUser.uid,
            createdAt: Date.now(),
            members: {
                [state.currentUser.uid]: true
            },
            settings: {
                nsfw: false,
                slowmode: 0,
                readOnly: false
            }
        };
        
        await set(channelRef, channelData);
        
        // Подписываемся на канал
        state.channels.set(channelId, channelData);
        addChannelToUI(channelData);
        
        hideCreateChannelModal();
        playSound('create');
        showNotification(`Канал "${name}" создан!`, 'success');
        
    } catch (error) {
        console.error('Create channel error:', error);
        showNotification('Ошибка создания канала', 'error');
    }
}

function addChannelToUI(channel) {
    const chatsList = document.getElementById('chats-list');
    
    const channelElement = document.createElement('div');
    channelElement.className = 'chat-item';
    channelElement.dataset.chatId = channel.id;
    channelElement.dataset.chatType = 'channel';
    
    const icon = channel.type === 'voice' ? 'fa-volume-up' : 
                 channel.type === 'private' ? 'fa-lock' : 'fa-hashtag';
    
    channelElement.innerHTML = `
        <div class="chat-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="chat-details">
            <div class="chat-name">${channel.name}</div>
            <div class="chat-activity">
                <span class="online-count">0 онлайн</span>
                <span class="last-msg">${channel.topic || 'Нет описания'}</span>
            </div>
        </div>
        <div class="chat-badge">
            <i class="fas fa-bolt"></i>
        </div>
    `;
    
    chatsList.appendChild(channelElement);
    
    channelElement.addEventListener('click', () => {
        selectChat(channel.id, 'channel', channel);
    });
}

// ==================== ЛИЧНЫЕ СООБЩЕНИЯ ====================
async function openDM(userId, userData) {
    try {
        const dmId = [state.currentUser.uid, userId].sort().join('_');
        const dmRef = ref(database, `dms/${dmId}`);
        const snapshot = await get(dmRef);
        
        let dmData;
        if (!snapshot.exists()) {
            dmData = {
                id: dmId,
                participants: {
                    [state.currentUser.uid]: true,
                    [userId]: true
                },
                createdAt: Date.now(),
                lastMessage: null
            };
            await set(dmRef, dmData);
        } else {
            dmData = snapshot.val();
        }
        
        // Сохраняем в состояние
        state.dms.set(dmId, { ...dmData, user: userData });
        
        // Добавляем в UI
        addDMToUI(dmId, userData);
        
        // Переключаемся на ЛС
        selectChat(dmId, 'dm', { ...dmData, user: userData });
        
    } catch (error) {
        console.error('Open DM error:', error);
        showNotification('Ошибка открытия ЛС', 'error');
    }
}

function addDMToUI(dmId, userData) {
    const dmsList = document.getElementById('dms-list');
    
    // Проверяем, не добавлен ли уже
    if (document.querySelector(`.dm-item[data-chat-id="${dmId}"]`)) {
        return;
    }
    
    const dmElement = document.createElement('div');
    dmElement.className = 'dm-item';
    dmElement.dataset.chatId = dmId;
    dmElement.dataset.chatType = 'dm';
    
    const avatarUrl = userData.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=10B981&color=fff&bold=true`;
    
    dmElement.innerHTML = `
        <div class="avatar-wrapper">
            <div class="avatar" style="background-image: url('${avatarUrl}')">
                ${userData.photoURL ? '' : '<i class="fas fa-user"></i>'}
            </div>
            <div class="user-status ${userData.status || 'offline'}"></div>
        </div>
        <div class="chat-details">
            <div class="chat-name">${userData.displayName}</div>
            <div class="chat-activity">
                <span class="status-text">${userData.statusText || 'Не в сети'}</span>
            </div>
        </div>
    `;
    
    dmsList.appendChild(dmElement);
    
    // Обновляем счетчик
    updateDMCounter();
    
    dmElement.addEventListener('click', () => {
        selectChat(dmId, 'dm', { ...userData, id: dmId });
    });
}

// ==================== СООБЩЕНИЯ ====================
async function sendMessage() {
    if (!state.currentUser) return;
    
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    // Проверяем команды
    if (text.startsWith('/')) {
        handleCommand(text);
        input.value = '';
        return;
    }
    
    // Очищаем индикатор набора
    clearTypingIndicator();
    
    const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: sanitizeText(text),
        senderId: state.currentUser.uid,
        senderName: state.currentUser.username,
        senderTag: state.currentUser.discriminator,
        timestamp: Date.now(),
        edited: false,
        reactions: {},
        attachments: [],
        mentions: extractMentions(text)
    };
    
    try {
        let messagesRef;
        if (state.currentChatType === 'dm') {
            messagesRef = ref(database, `dms/${state.currentChat}/messages`);
        } else {
            messagesRef = ref(database, `chats/${state.currentChat}/messages`);
        }
        
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, messageData);
        
        // Воспроизводим звук отправки
        playSound('message_sent');
        
        // Очищаем поле ввода
        input.value = '';
        input.focus();
        
    } catch (error) {
        console.error('Send message error:', error);
        showNotification('Ошибка отправки', 'error');
    }
}

function handleTyping() {
    if (!state.currentUser || !state.currentChat) return;
    
    const input = document.getElementById('message-input');
    const typingIndicator = document.getElementById('typing-indicator');
    
    if (input.value.length > 0) {
        typingIndicator.classList.add('active');
        updateTypingStatus(true);
    } else {
        typingIndicator.classList.remove('active');
        updateTypingStatus(false);
    }
}

function updateTypingStatus(isTyping) {
    if (!state.currentUser || !state.currentChat) return;
    
    const typingRef = ref(database, 
        state.currentChatType === 'dm' 
            ? `dms/${state.currentChat}/typing/${state.currentUser.uid}`
            : `channels/${state.currentChat}/typing/${state.currentUser.uid}`
    );
    
    if (isTyping) {
        set(typingRef, {
            userId: state.currentUser.uid,
            username: state.currentUser.username,
            timestamp: Date.now()
        });
        
        // Автоматически убираем статус через 3 секунды
        setTimeout(() => {
            updateTypingStatus(false);
        }, CONFIG.TYPING_TIMEOUT);
    } else {
        set(typingRef, null);
    }
}

// ==================== КОМАНДЫ ====================
function setupCommands() {
    window.commands = {
        gif: async (query) => {
            const gif = await searchGIF(query || 'hello');
            if (gif) {
                // Отправляем как сообщение
                const messageInput = document.getElementById('message-input');
                messageInput.value = gif;
                sendMessage();
            }
        },
        
        me: (action) => {
            if (!action) return;
            const messageInput = document.getElementById('message-input');
            messageInput.value = `*${state.currentUser.username} ${action}*`;
            sendMessage();
        },
        
        nick: async (newName) => {
            if (!newName || newName.length < 3) {
                showNotification('Имя должно быть от 3 символов', 'error');
                return;
            }
            
            try {
                const userRef = ref(database, `users/${state.currentUser.uid}`);
                const displayName = `${newName}#${state.currentUser.discriminator}`;
                
                await updateProfile(auth.currentUser, { displayName });
                await set(ref(database, `users/${state.currentUser.uid}/username`), newName);
                await set(ref(database, `users/${state.currentUser.uid}/displayName`), displayName);
                
                state.currentUser.username = newName;
                state.currentUser.displayName = displayName;
                updateUserProfile();
                
                showNotification(`Имя изменено на ${newName}`, 'success');
                playSound('success');
                
            } catch (error) {
                showNotification('Ошибка смены имени', 'error');
            }
        },
        
        clear: () => {
            const messagesContainer = document.getElementById('messages-container');
            messagesContainer.innerHTML = '';
            showNotification('Сообщения очищены локально', 'info');
        },
        
        game: (gameType) => {
            const games = {
                dice: '🎲 Вы бросили кубик: ' + (Math.floor(Math.random() * 6) + 1),
                coin: '🪙 Монетка: ' + (Math.random() > 0.5 ? 'Орел' : 'Решка'),
                rps: '✊✋✌️ Ваш ход в камень-ножницы-бумага!'
            };
            
            const result = games[gameType] || 'Доступные игры: dice, coin, rps';
            const messageInput = document.getElementById('message-input');
            messageInput.value = result;
            sendMessage();
        },
        
        theme: (themeName) => {
            switchTheme(themeName);
        },
        
        help: () => {
            const helpText = `
Доступные команды:
/gif [текст] - поиск гифки
/me [действие] - действие от лица пользователя
/nick [имя] - сменить имя
/clear - очистить чат (локально)
/game [тип] - мини-игры (dice, coin, rps)
/theme [название] - сменить тему
/help - эта справка
            `;
            showNotification(helpText, 'info');
        }
    };
}

function handleCommand(text) {
    const [command, ...args] = text.slice(1).split(' ');
    const cmdFunction = window.commands[command];
    
    if (cmdFunction) {
        cmdFunction(args.join(' '));
    } else {
        showNotification(`Неизвестная команда: /${command}`, 'error');
    }
}

// ==================== ВИДЕОЗВОНКИ ====================
async function startGroupCall() {
    try {
        // Запрашиваем разрешения
        state.localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Показываем локальное видео
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = state.localStream;
        
        // Создаем запись о звонке
        const callRef = ref(database, `calls/general`);
        await set(callRef, {
            id: 'general',
            active: true,
            type: 'group',
            startedBy: state.currentUser.uid,
            startedAt: Date.now(),
            participants: {
                [state.currentUser.uid]: {
                    joinedAt: Date.now(),
                    video: true,
                    audio: true
                }
            },
            settings: {
                maxParticipants: 12,
                recording: false,
                screenShare: false
            }
        });
        
        // Показываем интерфейс звонка
        showCallInterface();
        
        // Создаем Peer Connection для каждого участника
        startListeningForParticipants();
        
        playSound('call_start');
        showNotification('Групповой звонок начат!', 'success');
        
    } catch (error) {
        console.error('Start call error:', error);
        showNotification('Ошибка начала звонка: ' + error.message, 'error');
    }
}

async function joinCall() {
    if (state.callActive) return;
    
    try {
        state.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = state.localStream;
        
        // Получаем информацию о звонке
        const callRef = ref(database, `calls/general`);
        const snapshot = await get(callRef);
        
        if (!snapshot.exists() || !snapshot.val().active) {
            showNotification('Активный звонок не найден', 'warning');
            state.localStream.getTracks().forEach(track => track.stop());
            state.localStream = null;
            return;
        }
        
        const callData = snapshot.val();
        
        // Добавляем себя к участникам
        await set(ref(database, `calls/general/participants/${state.currentUser.uid}`), {
            joinedAt: Date.now(),
            video: true,
            audio: true,
            username: state.currentUser.username
        });
        
        // Подключаемся к другим участникам
        Object.keys(callData.participants || {}).forEach(userId => {
            if (userId !== state.currentUser.uid) {
                connectToUser(userId);
            }
        });
        
        showCallInterface();
        startListeningForParticipants();
        
        playSound('call_join');
        showNotification('Вы присоединились к звонку', 'success');
        
    } catch (error) {
        console.error('Join call error:', error);
        showNotification('Ошибка подключения: ' + error.message, 'error');
    }
}

async function connectToUser(userId) {
    try {
        const peerConnection = new RTCPeerConnection({
            iceServers: CONFIG.ICE_SERVERS
        });
        
        // Добавляем локальные треки
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, state.localStream);
            });
        }
        
        // Обработка удаленного потока
        peerConnection.ontrack = (event) => {
            addRemoteVideo(userId, event.streams[0]);
        };
        
        // ICE кандидаты
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Отправляем кандидата через Firebase
                const candidateRef = ref(database, `candidates/${state.currentUser.uid}_${userId}`);
                push(candidateRef, {
                    candidate: event.candidate,
                    from: state.currentUser.uid,
                    to: userId,
                    timestamp: Date.now()
                });
            }
        };
        
        // Создаем оффер
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Сохраняем оффер
        const offerRef = ref(database, `offers/${state.currentUser.uid}_${userId}`);
        await set(offerRef, {
            sdp: offer.sdp,
            type: 'offer',
            from: state.currentUser.uid,
            to: userId,
            timestamp: Date.now()
        });
        
        // Сохраняем соединение
        state.peerConnections.set(userId, peerConnection);
        
        // Слушаем ответ
        listenForAnswer(userId, peerConnection);
        listenForCandidates(userId, peerConnection);
        
    } catch (error) {
        console.error('Connect error:', error);
    }
}

function addRemoteVideo(userId, stream) {
    const remoteVideos = document.getElementById('remote-videos');
    
    // Проверяем, не добавлено ли уже видео этого пользователя
    if (document.querySelector(`.video-wrapper[data-user-id="${userId}"]`)) {
        return;
    }
    
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper remote glass';
    videoWrapper.dataset.userId = userId;
    
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    const label = document.createElement('div');
    label.className = 'video-label glass';
    label.innerHTML = `
        <span class="user-tag">Пользователь#${userId.slice(0, 4)}</span>
        <span class="status-dot online"></span>
    `;
    
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(label);
    remoteVideos.appendChild(videoWrapper);
    
    // Обновляем счетчик участников
    updateParticipantsCount();
}

// ==================== ГОЛОСОВЫЕ СООБЩЕНИЯ ====================
async function toggleVoiceRecording() {
    if (state.voiceRecording) {
        stopVoiceRecording();
    } else {
        await startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        state.audioChunks = [];
        
        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };
        
        state.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
            await sendVoiceMessage(audioBlob);
            
            // Останавливаем все треки
            stream.getTracks().forEach(track => track.stop());
        };
        
        state.mediaRecorder.start();
        state.voiceRecording = true;
        
        // Показываем интерфейс записи
        document.getElementById('voice-recorder').classList.add('active');
        startRecordingTimer();
        
        playSound('record_start');
        
    } catch (error) {
        console.error('Recording error:', error);
        showNotification('Ошибка доступа к микрофону', 'error');
    }
}

function stopVoiceRecording() {
    if (state.mediaRecorder && state.voiceRecording) {
        state.mediaRecorder.stop();
        state.voiceRecording = false;
        
        document.getElementById('voice-recorder').classList.remove('active');
        stopRecordingTimer();
        
        playSound('record_stop');
    }
}

async function sendVoiceMessage(audioBlob) {
    try {
        // Конвертируем в base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        reader.onloadend = async () => {
            const base64Audio = reader.result;
            const duration = await getAudioDuration(audioBlob);
            
            const messageData = {
                id: `voice_${Date.now()}`,
                type: 'voice',
                senderId: state.currentUser.uid,
                senderName: state.currentUser.username,
                audioData: base64Audio,
                duration: duration,
                timestamp: Date.now()
            };
            
            let messagesRef;
            if (state.currentChatType === 'dm') {
                messagesRef = ref(database, `dms/${state.currentChat}/messages`);
            } else {
                messagesRef = ref(database, `chats/${state.currentChat}/messages`);
            }
            
            const newMessageRef = push(messagesRef);
            await set(newMessageRef, messageData);
            
            showNotification('Голосовое сообщение отправлено', 'success');
            playSound('message_sent');
        };
        
    } catch (error) {
        console.error('Send voice error:', error);
        showNotification('Ошибка отправки голосового', 'error');
    }
}

// ==================== ЭМОДЗИ ====================
function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    
    if (state.emojiPickerOpen) {
        hideEmojiPicker();
    } else {
        showEmojiPicker();
    }
}

function showEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.add('active');
    state.emojiPickerOpen = true;
    
    // Загружаем эмодзи
    if (!picker.querySelector('.emoji-grid').children.length) {
        loadEmojis();
    }
}

function hideEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.remove('active');
    state.emojiPickerOpen = false;
}

function loadEmojis() {
    const emojiGrid = document.querySelector('.emoji-grid');
    const emojis = ['😀', '😂', '🥰', '😎', '🤔', '😱', '🎉', '🔥', '💯', '✨', '🎮', '🚀', '❤️', '👍', '👋', '🎶'];
    
    emojiGrid.innerHTML = '';
    
    emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji';
        emojiBtn.textContent = emoji;
        emojiBtn.addEventListener('click', () => {
            insertEmoji(emoji);
            hideEmojiPicker();
        });
        emojiGrid.appendChild(emojiBtn);
    });
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    const cursorPos = input.selectionStart;
    const text = input.value;
    
    input.value = text.substring(0, cursorPos) + emoji + text.substring(cursorPos);
    input.focus();
    input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
}

// ==================== ТЕМЫ ====================
function toggleTheme() {
    const themes = ['dark', 'light', 'neon', 'matrix'];
    const currentIndex = themes.indexOf(state.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    switchTheme(nextTheme);
}

function switchTheme(themeName) {
    const body = document.body;
    
    // Удаляем предыдущие классы тем
    themes.forEach(theme => {
        body.classList.remove(`theme-${theme}`);
    });
    
    // Добавляем новую тему
    body.classList.add(`theme-${themeName}`);
    state.theme = themeName;
    
    // Сохраняем в localStorage
    localStorage.setItem('neocascade-theme', themeName);
    
    // Обновляем тему в Firebase если пользователь авторизован
    if (state.currentUser) {
        set(ref(database, `users/${state.currentUser.uid}/theme`), themeName);
    }
    
    showNotification(`Тема изменена: ${themeName}`, 'info');
    playSound('theme_switch');
}

// ==================== УВЕДОМЛЕНИЯ ====================
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle'
    };
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${icons[type] || icons.info}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${type.toUpperCase()}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
    
    // Звук уведомления
    if (state.notifications) {
        playSound('notification');
        
        // Если разрешены браузерные уведомления
        if (Notification.permission === 'granted') {
            new Notification('NeoCascade', {
                body: message,
                icon: '/icon.png'
            });
        }
    }
    
    // Закрытие по клику
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
}

function toggleNotifications() {
    state.notifications = !state.notifications;
    const btn = document.getElementById('notifications-toggle');
    
    if (state.notifications) {
        btn.innerHTML = '<i class="fas fa-bell"></i>';
        showNotification('Уведомления включены', 'success');
    } else {
        btn.innerHTML = '<i class="fas fa-bell-slash"></i>';
        showNotification('Уведомления выключены', 'warning');
    }
    
    // Сохраняем настройку
    localStorage.setItem('neocascade-notifications', state.notifications);
}

// ==================== ЗВУКИ ====================
function initSoundEffects() {
    // Создаем аудио элементы для звуков
    const sounds = {
        message_sent: 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3',
        message_received: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
        notification: 'https://assets.mixkit.co/sfx/preview/mixkit-bubble-notification-alert-2357.mp3',
        call_start: 'https://assets.mixkit.co/sfx/preview/mixkit-retro-game-emergency-alarm-1000.mp3',
        call_join: 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3',
        call_end: 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-wrong-answer-buzz-950.mp3',
        login: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
        logout: 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-wrong-answer-buzz-950.mp3',
        success: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
        error: 'https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3',
        record_start: 'https://assets.mixkit.co/sfx/preview/mixkit-camera-shutter-click-1133.mp3',
        record_stop: 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
        theme_switch: 'https://assets.mixkit.co/sfx/preview/mixkit-plastic-bubble-click-1124.mp3'
    };
    
    window.sounds = {};
    
    Object.entries(sounds).forEach(([name, url]) => {
        const audio = new Audio(url);
        audio.volume = 0.3;
        window.sounds[name] = audio;
    });
}

function playSound(soundName) {
    if (window.sounds && window.sounds[soundName]) {
        const sound = window.sounds[soundName].cloneNode();
        sound.volume = 0.3;
        sound.play().catch(e => console.log('Sound play error:', e));
    }
}

// ==================== УТИЛИТЫ ====================
function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractMentions(text) {
    const mentionRegex = /@(\w+)#(\d{4})/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push({
            username: match[1],
            discriminator: match[2]
        });
    }
    
    return mentions;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

async function getAudioDuration(blob) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.src = URL.createObjectURL(blob);
        
        audio.onloadedmetadata = () => {
            resolve(Math.round(audio.duration));
            URL.revokeObjectURL(audio.src);
        };
        
        audio.onerror = () => {
            resolve(0);
        };
    });
}

// ==================== PWA И ОФФЛАЙН ====================
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function updateUserProfile() {
    if (!state.currentUser) return;
    
    document.getElementById('username').textContent = state.currentUser.username;
    document.getElementById('user-tag').textContent = `#${state.currentUser.discriminator}`;
    
    const avatar = document.getElementById('user-avatar');
    if (state.currentUser.photoURL) {
        avatar.style.backgroundImage = `url('${state.currentUser.photoURL}')`;
        avatar.innerHTML = '';
    } else {
        avatar.style.backgroundImage = '';
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    }
}

function clearTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    indicator.classList.remove('active');
}

function refreshData() {
    if (state.currentUser) {
        loadContacts();
        loadChannels();
        loadDMs();
    }
}

// Добавьте эти CSS темы в конец style.css:
const themeStyles = `
.theme-light {
    --bg-deep: #f0f2f5;
    --bg-surface: rgba(255, 255, 255, 0.9);
    --bg-card: rgba(255, 255, 255, 0.7);
    --glass-bg: rgba(255, 255, 255, 0.8);
    --text-primary: #1a1a1a;
    --text-secondary: #666;
    --text-muted: #999;
}

.theme-neon {
    --primary: #ff00ff;
    --secondary: #00ffff;
    --accent: #ffff00;
    --bg-deep: #000;
    --glass-border: rgba(255, 0, 255, 0.3);
    --neon-glow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 40px currentColor;
}

.theme-matrix {
    --primary: #00ff00;
    --secondary: #009900;
    --bg-deep: #000;
    --text-primary: #00ff00;
    --glass-bg: rgba(0, 255, 0, 0.1);
    --glass-border: rgba(0, 255, 0, 0.3);
}
`;

// Добавьте эти стили в style.css
const styleEl = document.createElement('style');
styleEl.textContent = themeStyles;
document.head.appendChild(styleEl);

// Экспортируем состояние для отладки
window.appState = state;
console.log('NeoCascade Messenger v2.0 загружен!');

// Инициализируем дополнительные модули при необходимости
setTimeout(() => {
    if (state.currentUser) {
        showNotification('Добро пожаловать в NeoCascade Quantum!', 'success');
        playSound('login');
    }
}, 1000);
