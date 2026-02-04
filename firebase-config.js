import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get, child, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    onAuthStateChanged,
    signOut,
    updateProfile,
    updateEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDxGOGD6Oooo1CILrmrTpzy5Sq_MPuGiKM",
    authDomain: "messenger-4a3ab.firebaseapp.com",
    databaseURL: "https://messenger-4a3ab-default-rtdb.firebaseio.com",
    projectId: "messenger-4a3ab",
    storageBucket: "messenger-4a3ab.firebasestorage.app",
    messagingSenderId: "684785124123",
    appId: "1:684785124123:web:15efc74d7bb49259b789be",
    measurementId: "G-MY6Z7YB5J9"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация сервисов
const database = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Провайдеры
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Настройки провайдеров
googleProvider.addScope('email');
googleProvider.addScope('profile');
githubProvider.addScope('user:email');

// Экспорт всего необходимого
export { 
    database, 
    storage,
    ref, 
    storageRef,
    push, 
    onValue, 
    set, 
    get, 
    child,
    update,
    remove,
    uploadBytes,
    getDownloadURL,
    auth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    googleProvider,
    githubProvider,
    onAuthStateChanged, 
    signOut,
    updateProfile,
    updateEmail,
    updatePassword
};
