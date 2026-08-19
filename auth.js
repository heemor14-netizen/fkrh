/* ====================================================
   نظام المصادقة والتسجيل الموحد لجميع الألعاب (Auth JS)
   فِكْرَة - Fikrah Games Unified Authentication System
   ==================================================== */

(function() {
    // إعدادات مشروع Firebase الموحدة لجميع الألعاب
    const firebaseConfig = {
        apiKey: "AIzaSyCg29LG4HI-vas93dBFIMqKEfzeYUAx-o0",
        authDomain: "fikrh-cf0ff.firebaseapp.com",
        databaseURL: "https://fikrh-cf0ff-default-rtdb.firebaseio.com",
        projectId: "fikrh-cf0ff",
        storageBucket: "fikrh-cf0ff.firebasestorage.app",
        messagingSenderId: "523229194032",
        appId: "1:523229194032:web:29e3a5ef0ce27d8b3d0af5"
    };

    // تهيئة Firebase بأمان وتجنب تكرار التهيئة
    function getFirebase() {
        if (typeof firebase === 'undefined') return { auth: null, db: null, storage: null };
        if (!firebase.apps || firebase.apps.length === 0) {
            try {
                firebase.initializeApp(firebaseConfig);
            } catch(e) {
                console.warn('Firebase init:', e);
            }
        }
        const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
        const db = (typeof firebase.database === 'function') ? firebase.database() : null;
        const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
        return { auth, db, storage };
    }

    // استرجاع فوري لبيانات المستخدم المحفوظة محلياً لمنع أي وميض في الهيدر
    try {
        const savedAccount = localStorage.getItem('currentUserAccount');
        if (savedAccount) {
            window.currentUserAccount = JSON.parse(savedAccount);
        } else {
            const savedName = localStorage.getItem('currentUser') || 
                              localStorage.getItem('fikrh_username') || 
                              localStorage.getItem('username') || 
                              localStorage.getItem('fikra_player_name');
            if (savedName) {
                window.currentUserAccount = {
                    uid: 'local_' + Date.now(),
                    name: savedName,
                    avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
                };
            } else {
                window.currentUserAccount = null;
            }
        }
    } catch(e) {
        window.currentUserAccount = null;
    }

    // تحويل اسم المستخدم بأمان لبريد إلكتروني صالح لـ Firebase Auth (دعم تام للحروف العربية)
    function usernameToAuthEmail(username) {
        const raw = (username || '').trim();
        if (!raw) return '';
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
            return raw.toLowerCase();
        }
        const encoder = new TextEncoder();
        const bytes = encoder.encode(raw.toLowerCase());
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return `user_${hex}@fikra-players.com`;
    }

    // ترجمة جميع رسائل أخطاء Firebase إلى رسائل عربية واضحة ومباشرة
    function firebaseAuthErrorToArabic(err) {
        const code = err && err.code ? err.code : '';
        const msg = err && err.message ? err.message : '';
        
        const map = {
            'auth/email-already-in-use': 'اسم المستخدم هذا مسجّل مسبقاً، تفضل بتسجيل دخولك أو اختر اسماً آخر!',
            'auth/user-not-found': 'لا يوجد حساب بهذا الاسم، تأكد من الاسم أو سجّل حساباً جديداً!',
            'auth/wrong-password': 'كلمة المرور غير صحيحة، حاول مرة ثانية!',
            'auth/invalid-credential': 'اسم المستخدم أو كلمة المرور غير صحيحة، تأكد وحاول ثانية!',
            'auth/invalid-email': 'اسم المستخدم يحتوي على رموز غير مسموحة!',
            'auth/weak-password': 'كلمة المرور يجب ألا تقل عن 6 خانات!',
            'auth/network-request-failed': 'تعذّر الاتصال، تأكد من اتصالك بالإنترنت!',
            'auth/too-many-requests': 'تم إيقاف المحاولات مؤقتاً بسبب كثرة الإدخال الخاطئ، انتظر قليلاً ثم حاول مجدداً!'
        };
        return map[code] || ('صار خطأ: ' + (msg || 'يرجى المحاولة ثانية'));
    }

    // عرض توست الإشعارات التفاعلي
    function showToast(title, bodyText) {
        let toast = document.getElementById('authToastEl');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'authToastEl';
            toast.className = 'auth-toast-notification';
            document.body.appendChild(toast);
        }
        const fullMsg = bodyText ? `<span>${title}</span> <span>${bodyText}</span>` : `<span>${title}</span>`;
        toast.innerHTML = fullMsg;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    // حفظ بيانات الحساب محلياً
    function saveAccountToStorage(acc) {
        if (!acc) return;
        try {
            localStorage.setItem('currentUserAccount', JSON.stringify(acc));
            localStorage.setItem('currentUser', acc.name);
            localStorage.setItem('fikrh_username', acc.name);
            localStorage.setItem('username', acc.name);
            localStorage.setItem('fikra_player_name', acc.name);
        } catch(e) {}
    }

    // تحديث الهيدر في أعلى اليسار في جميع الصفحات
    function updateHeaderAuthUI() {
        let area = document.getElementById('headerAuthArea');
        if (!area) {
            const header = document.querySelector('header');
            if (header) {
                area = document.createElement('div');
                area.className = 'nav-btns';
                area.id = 'headerAuthArea';
                header.appendChild(area);
            }
        }
        if (!area) return;

        if (window.currentUserAccount && window.currentUserAccount.name) {
            const avatarUrl = window.currentUserAccount.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
            area.innerHTML = `
                <div class="user-profile-badge" onclick="window.openAuthModal('profile')" title="حسابي الشخصي">
                    <img src="${avatarUrl}" class="user-avatar-sm" alt="صورة الحساب" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3135/3135715.png'">
                    <span class="user-name-sm">${window.currentUserAccount.name}</span>
                </div>
            `;
        } else {
            area.innerHTML = `
                <button type="button" class="btn-auth-nav btn-auth-login" onclick="window.openAuthModal('login')">دخول</button>
                <button type="button" class="btn-auth-nav btn-auth-register" onclick="window.openAuthModal('register')">حساب جديد</button>
            `;
        }

        // ملء حقول أسماء اللاعبين في جميع الألعاب تلقائياً بالاسم المسجل
        const nameVal = window.currentUserAccount ? window.currentUserAccount.name : '';
        if (nameVal) {
            const inputs = ['playerNameInput', 'spyPlayerNameInput', 'drawPlayerNameInput', 'guessPlayerNameInput'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.value) {
                    el.value = nameVal;
                }
            });
        }
    }
    window.updateHeaderAuthUI = updateHeaderAuthUI;

    // التأكد من وجود نافذة المودال في الصفحة
    function ensureModalExists() {
        let modal = document.getElementById('authModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'auth-modal-overlay';
            modal.id = 'authModal';
            modal.innerHTML = `<div class="auth-card-box" id="authModalContent"></div>`;
            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.closeAuthModal();
            });
            document.body.appendChild(modal);
        }
        return modal;
    }

    // فتح نافذة المصادقة أو البروفايل
    window.openAuthModal = function(mode) {
        const modal = ensureModalExists();
        const content = document.getElementById('authModalContent');
        if (!content) return;

        modal.style.display = 'flex';

        if (mode === 'profile') {
            const user = window.currentUserAccount || { name: '', avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' };
            content.innerHTML = `
                <button class="auth-modal-close" onclick="window.closeAuthModal()" title="إغلاق">✕</button>
                <div class="auth-icon-badge">👤</div>
                <h2>حسابي الشخصي</h2>
                <p class="auth-subtitle">بياناتك محفوظة ومتزامنة عبر جميع الألعاب</p>
                <div class="profile-avatar-container">
                    <img id="modalAvatarPreview" src="${user.avatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" class="profile-avatar-img" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3135/3135715.png'">
                    <label for="avatarFileInput" class="avatar-upload-btn" title="تغيير الصورة الشخصية">📷</label>
                    <input type="file" id="avatarFileInput" accept="image/*" style="display:none;" onchange="window.handleAvatarUpload(event)">
                </div>
                <div class="auth-field">
                    <input type="text" id="profileNameInput" class="auth-input" value="${user.name || ''}" placeholder="اسم المستخدم" maxlength="20">
                </div>
                <div id="authErrorBox" class="auth-error-box"></div>
                <button id="authSubmitBtn" onclick="window.saveProfileChanges()" class="auth-btn-action">حفظ التعديلات ✨</button>
                <button onclick="window.logoutAccount()" class="auth-btn-danger">تسجيل الخروج 🚪</button>
            `;
        } else {
            const isReg = (mode === 'register');
            content.innerHTML = `
                <button class="auth-modal-close" onclick="window.closeAuthModal()" title="إغلاق">✕</button>
                <div class="auth-icon-badge">${isReg ? '✨' : '👋'}</div>
                <h2>${isReg ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2>
                <p class="auth-subtitle">${isReg ? 'انضم إلى ألعاب فِكْرَة واحتفظ ببياناتك' : 'أهلاً بك! سجّل دخولك للمتابعة'}</p>
                
                <div class="auth-field">
                    <input type="text" id="authUserInput" class="auth-input" placeholder="اسم المستخدم" autocomplete="username">
                </div>
                
                <div class="auth-field">
                    <input type="password" id="authPassInput" class="auth-input" placeholder="كلمة المرور (6 خانات فأكثر)" autocomplete="${isReg ? 'new-password' : 'current-password'}" onkeydown="if(event.key==='Enter') window.submitAuthAction('${mode}')">
                    <span class="auth-eye-toggle" onclick="window.toggleAuthPassVisibility()" title="إظهار/إخفاء">👁️</span>
                </div>
                
                <div id="authErrorBox" class="auth-error-box"></div>
                
                <button id="authSubmitBtn" onclick="window.submitAuthAction('${mode}')" class="auth-btn-action">
                    ${isReg ? 'إنشاء الحساب الآن 🚀' : 'دخول ⚡'}
                </button>
                
                <div class="auth-switch-line">
                    ${isReg ? 'عندك حساب بالفعل؟' : 'ما عندك حساب؟'}
                    <a onclick="window.openAuthModal('${isReg ? 'login' : 'register'}')">
                        ${isReg ? 'سجّل دخولك' : 'أنشئ حساب جديد'}
                    </a>
                </div>
            `;
        }
    };

    window.closeAuthModal = function() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'none';
    };

    window.toggleAuthPassVisibility = function() {
        const p = document.getElementById('authPassInput');
        if (p) p.type = (p.type === 'password' ? 'text' : 'password');
    };

    function showAuthError(msg) {
        const box = document.getElementById('authErrorBox');
        if (box) {
            box.innerText = msg;
            box.classList.add('show');
        }
    }

    function setAuthLoading(isLoading, label) {
        const btn = document.getElementById('authSubmitBtn');
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerHTML = isLoading ? `<span class="auth-spinner"></span> جاري المعالجة...` : label;
    }

    // تنفيذ عملية التسجيل أو تسجيل الدخول
    window.submitAuthAction = async function(mode) {
        const uInput = (document.getElementById('authUserInput')?.value || '').trim();
        const pInput = document.getElementById('authPassInput')?.value || '';
        const isReg = (mode === 'register');
        const originalLabel = isReg ? 'إنشاء الحساب الآن 🚀' : 'دخول ⚡';

        if (!uInput) return showAuthError('يرجى إدخال اسم المستخدم!');
        if (uInput.length < 2) return showAuthError('اسم المستخدم يجب أن يكون حرفين على الأقل!');
        if (!pInput || pInput.length < 6) return showAuthError('كلمة المرور يجب ألا تقل عن 6 خانات!');

        const { auth, db } = getFirebase();
        if (!auth) {
            return showAuthError('خدمة تسجيل الدخول غير متاحة حالياً، تأكد من الاتصال.');
        }

        const email = usernameToAuthEmail(uInput);
        setAuthLoading(true, originalLabel);

        try {
            if (isReg) {
                const cred = await auth.createUserWithEmailAndPassword(email, pInput);
                const avatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
                if (cred.user && cred.user.updateProfile) {
                    await cred.user.updateProfile({ displayName: uInput, photoURL: avatar }).catch(()=>{});
                }
                if (db) {
                    await db.ref('users/' + cred.user.uid).set({
                        name: uInput,
                        avatar: avatar,
                        createdAt: Date.now()
                    }).catch(()=>{});
                }
                window.currentUserAccount = { uid: cred.user.uid, name: uInput, avatar: avatar };
                saveAccountToStorage(window.currentUserAccount);
                showToast('أهلاً بك! 🎉', `تم إنشاء حسابك بنجاح يا ${uInput}!`);
            } else {
                const cred = await auth.signInWithEmailAndPassword(email, pInput);
                let profile = null;
                if (db) {
                    try {
                        const snap = await db.ref('users/' + cred.user.uid).once('value');
                        profile = snap.val();
                    } catch(e) {}
                }
                const name = (profile && profile.name) || cred.user.displayName || uInput;
                const avatar = (profile && profile.avatar) || cred.user.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
                window.currentUserAccount = { uid: cred.user.uid, name: name, avatar: avatar };
                saveAccountToStorage(window.currentUserAccount);
                showToast('أهلاً بعودتك! 🔥', `تم تسجيل دخولك بنجاح يا ${name}!`);
            }
            updateHeaderAuthUI();
            window.closeAuthModal();
        } catch(err) {
            setAuthLoading(false, originalLabel);
            showAuthError(firebaseAuthErrorToArabic(err));
        }
    };

    // رفع وتعديل صورة الحساب الشخصي
    window.handleAvatarUpload = function(event) {
        const file = event.target.files[0];
        if (!file || !window.currentUserAccount) return;
        const preview = document.getElementById('modalAvatarPreview');

        const reader = new FileReader();
        reader.onload = function(e) {
            const rawDataUrl = e.target.result;
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxDim = 160;
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round((h / w) * maxDim); w = maxDim; }
                else { w = Math.round((w / h) * maxDim); h = maxDim; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                
                window.currentUserAccount.avatar = compressedDataUrl;
                if (preview) preview.src = compressedDataUrl;
            };
            img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);

        const { storage } = getFirebase();
        if (storage && window.currentUserAccount.uid && !window.currentUserAccount.uid.startsWith('local_')) {
            const fileRef = storage.ref('avatars/' + window.currentUserAccount.uid + '.jpg');
            fileRef.put(file).then(() => fileRef.getDownloadURL()).then((url) => {
                window.currentUserAccount.avatar = url;
                if (preview) preview.src = url;
            }).catch(() => {});
        }
    };

    // حفظ تعديلات الملف الشخصي
    window.saveProfileChanges = async function() {
        const newName = (document.getElementById('profileNameInput')?.value || '').trim();
        if (!newName) return showAuthError('يرجى إدخال اسم المستخدم!');
        if (!window.currentUserAccount) return;

        window.currentUserAccount.name = newName;
        setAuthLoading(true, 'حفظ التعديلات ✨');

        const { auth, db } = getFirebase();

        try {
            saveAccountToStorage(window.currentUserAccount);
            if (db && window.currentUserAccount.uid && !window.currentUserAccount.uid.startsWith('local_')) {
                await db.ref('users/' + window.currentUserAccount.uid).update({
                    name: window.currentUserAccount.name,
                    avatar: window.currentUserAccount.avatar
                }).catch(()=>{});
            }
            if (auth && auth.currentUser) {
                await auth.currentUser.updateProfile({
                    displayName: window.currentUserAccount.name,
                    photoURL: window.currentUserAccount.avatar
                }).catch(()=>{});
            }
            updateHeaderAuthUI();
            window.closeAuthModal();
            showToast('تم الحفظ ✨', 'تم حفظ بياناتك بنجاح!');
        } catch(e) {
            setAuthLoading(false, 'حفظ التعديلات ✨');
            showAuthError('تعذّر حفظ التعديلات، يرجى المحاولة ثانية.');
        }
    };

    // تسجيل الخروج
    window.logoutAccount = function() {
        const { auth } = getFirebase();
        if (auth) {
            auth.signOut().catch(()=>{});
        }
        window.currentUserAccount = null;
        localStorage.removeItem('currentUserAccount');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('fikrh_username');
        localStorage.removeItem('username');
        localStorage.removeItem('fikra_player_name');
        updateHeaderAuthUI();
        window.closeAuthModal();
        showToast('تم الخروج 🚪', 'تم تسجيل الخروج بنجاح.');
    };

    // الاستماع لحالة المصادقة
    function setupAuthListener() {
        const { auth, db } = getFirebase();
        if (!auth) return;
        
        if (auth.setPersistence && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                let profile = null;
                if (db) {
                    try {
                        const snap = await db.ref('users/' + user.uid).once('value');
                        profile = snap.val();
                    } catch(e) {}
                }
                const name = (profile && profile.name) || user.displayName || 'لاعب';
                const avatar = (profile && profile.avatar) || user.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
                window.currentUserAccount = { uid: user.uid, name: name, avatar: avatar };
                saveAccountToStorage(window.currentUserAccount);
            } else {
                if (!window.currentUserAccount || !window.currentUserAccount.uid.startsWith('local_')) {
                    window.currentUserAccount = null;
                    localStorage.removeItem('currentUserAccount');
                }
            }
            updateHeaderAuthUI();
        });
    }

    // التهيئة التلقائية عند تشغيل الملف
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateHeaderAuthUI();
            setupAuthListener();
        });
    } else {
        updateHeaderAuthUI();
        setupAuthListener();
    }
})();
