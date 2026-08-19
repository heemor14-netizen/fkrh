/* ====================================================
   نظام المصادقة والتسجيل الموحد لجميع الألعاب (Auth JS)
   فِكْرَة - Fikrah Games Unified Authentication System
   ==================================================== */

(function() {
    const firebaseConfig = {
        apiKey: "AIzaSyCg29LG4HI-vas93dBFIMqKEfzeYUAx-o0",
        authDomain: "fikrh-cf0ff.firebaseapp.com",
        databaseURL: "https://fikrh-cf0ff-default-rtdb.firebaseio.com",
        projectId: "fikrh-cf0ff",
        storageBucket: "fikrh-cf0ff.firebasestorage.app",
        messagingSenderId: "523229194032",
        appId: "1:523229194032:web:29e3a5ef0ce27d8b3d0af5"
    };

    const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

    // تهيئة Firebase بأمان وتجنب أي خطأ
    function getFirebase() {
        if (typeof firebase === 'undefined') return { auth: null, db: null, storage: null };
        if (!firebase.apps || firebase.apps.length === 0) {
            try {
                firebase.initializeApp(firebaseConfig);
            } catch(e) {}
        }
        const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
        const db = (typeof firebase.database === 'function') ? firebase.database() : null;
        const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;
        return { auth, db, storage };
    }

    // استرجاع فوري لبيانات المستخدم المحفوظة محلياً لتجنب الوميض
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
                    uid: usernameToSafeKey(savedName),
                    name: savedName,
                    avatar: DEFAULT_AVATAR
                };
            } else {
                window.currentUserAccount = null;
            }
        }
    } catch(e) {
        window.currentUserAccount = null;
    }

    // تحويل اسم المستخدم لمفتاح فريد وآمن لقاعدة البيانات (يدعم الحروف العربية بالكامل)
    function usernameToSafeKey(username) {
        const raw = (username || '').trim().toLowerCase();
        if (!raw) return 'u_guest';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(raw);
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return 'u_' + hex;
    }

    function usernameToAuthEmail(username) {
        const safeKey = usernameToSafeKey(username);
        return safeKey + '@fikra-games.app';
    }

    // تشفير كلمة المرور محلياً للحماية
    async function hashPassword(str) {
        try {
            if (window.crypto && crypto.subtle) {
                const msgUint8 = new TextEncoder().encode(str + '_fikrah_secure_salt');
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch(e) {}
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'h_' + hash;
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

        const friendsBtn = `<button type="button" class="btn-auth-friends" onclick="window.openFriendsModal()" title="قائمة أصدقائي">👥 أصدقائي</button>`;

        if (window.currentUserAccount && window.currentUserAccount.name) {
            const avatarUrl = window.currentUserAccount.avatar || DEFAULT_AVATAR;
            area.innerHTML = `
                ${friendsBtn}
                <div class="user-profile-badge" onclick="window.openAuthModal('profile')" title="حسابي الشخصي">
                    <img src="${avatarUrl}" class="user-avatar-sm" alt="صورة الحساب" onerror="this.src='${DEFAULT_AVATAR}'">
                    <span class="user-name-sm">${window.currentUserAccount.name}</span>
                </div>
            `;
        } else {
            area.innerHTML = `
                ${friendsBtn}
                <button type="button" class="btn-auth-nav btn-auth-login" onclick="window.openAuthModal('login')">دخول</button>
                <button type="button" class="btn-auth-nav btn-auth-register" onclick="window.openAuthModal('register')">حساب جديد</button>
            `;
        }

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

    window.openAuthModal = function(mode) {
        const modal = ensureModalExists();
        const content = document.getElementById('authModalContent');
        if (!content) return;

        modal.style.display = 'flex';

        if (mode === 'profile') {
            const user = window.currentUserAccount || { name: '', avatar: DEFAULT_AVATAR };
            content.innerHTML = `
                <button class="auth-modal-close" onclick="window.closeAuthModal()" title="إغلاق">✕</button>
                <div class="auth-icon-badge">👤</div>
                <h2>حسابي الشخصي</h2>
                <p class="auth-subtitle">بياناتك محفوظة ومتزامنة عبر جميع الألعاب</p>
                <div class="profile-avatar-container">
                    <img id="modalAvatarPreview" src="${user.avatar || DEFAULT_AVATAR}" class="profile-avatar-img" onerror="this.src='${DEFAULT_AVATAR}'">
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

    // تنفيذ عملية التسجيل أو تسجيل الدخول (نظام هجين ذكي وموثوق 100%)
    window.submitAuthAction = async function(mode) {
        const uInput = (document.getElementById('authUserInput')?.value || '').trim();
        const pInput = document.getElementById('authPassInput')?.value || '';
        const isReg = (mode === 'register');
        const originalLabel = isReg ? 'إنشاء الحساب الآن 🚀' : 'دخول ⚡';

        if (!uInput) return showAuthError('يرجى إدخال اسم المستخدم!');
        if (uInput.length < 2) return showAuthError('اسم المستخدم يجب أن يكون حرفين على الأقل!');
        if (!pInput || pInput.length < 6) return showAuthError('كلمة المرور يجب ألا تقل عن 6 خانات!');

        setAuthLoading(true, originalLabel);

        const { auth, db } = getFirebase();
        const safeKey = usernameToSafeKey(uInput);
        const passHash = await hashPassword(pInput);

        try {
            if (isReg) {
                // إنشاء حساب جديد
                let userExists = false;
                if (db) {
                    try {
                        const snap = await db.ref('app_users/' + safeKey).once('value');
                        if (snap.exists()) {
                            userExists = true;
                        }
                    } catch(e) {}
                }

                if (userExists) {
                    setAuthLoading(false, originalLabel);
                    return showAuthError('اسم المستخدم هذا مسجّل مسبقاً، تفضل بتسجيل دخولك!');
                }

                // محاولة التسجيل عبر Firebase Auth في الخلفية إن أمكن
                let authUid = safeKey;
                if (auth) {
                    try {
                        const email = usernameToAuthEmail(uInput);
                        const cred = await auth.createUserWithEmailAndPassword(email, pInput);
                        if (cred && cred.user) {
                            authUid = cred.user.uid;
                            if (cred.user.updateProfile) {
                                cred.user.updateProfile({ displayName: uInput, photoURL: DEFAULT_AVATAR }).catch(()=>{});
                            }
                        }
                    } catch(authErr) {
                        // في حال تعذر Auth سنعتمد على Realtime DB بنجاح تام
                        console.log('Firebase Auth fallback to DB:', authErr.code);
                    }
                }

                const newAccount = {
                    uid: authUid,
                    name: uInput,
                    password: passHash,
                    avatar: DEFAULT_AVATAR,
                    createdAt: Date.now()
                };

                if (db) {
                    await db.ref('app_users/' + safeKey).set(newAccount).catch(()=>{});
                    await db.ref('users/' + authUid).set({ name: uInput, avatar: DEFAULT_AVATAR }).catch(()=>{});
                }

                window.currentUserAccount = { uid: authUid, name: uInput, avatar: DEFAULT_AVATAR };
                saveAccountToStorage(window.currentUserAccount);
                updateHeaderAuthUI();
                loadCloudFriends();
                window.closeAuthModal();
                showToast('أهلاً بك! 🎉', `تم إنشاء حسابك بنجاح يا ${uInput}!`);

            } else {
                // تسجيل الدخول
                let loggedInAccount = null;

                // 1. محاولة Realtime Database
                if (db) {
                    try {
                        const snap = await db.ref('app_users/' + safeKey).once('value');
                        if (snap.exists()) {
                            const dbUser = snap.val();
                            if (dbUser.password === passHash || dbUser.password === pInput) {
                                loggedInAccount = {
                                    uid: dbUser.uid || safeKey,
                                    name: dbUser.name || uInput,
                                    avatar: dbUser.avatar || DEFAULT_AVATAR
                                };
                            } else {
                                setAuthLoading(false, originalLabel);
                                return showAuthError('كلمة المرور غير صحيحة، حاول مرة ثانية!');
                            }
                        }
                    } catch(e) {}
                }

                // 2. محاولة Firebase Auth كخيار إضافي
                if (!loggedInAccount && auth) {
                    try {
                        const email = usernameToAuthEmail(uInput);
                        const cred = await auth.signInWithEmailAndPassword(email, pInput);
                        if (cred && cred.user) {
                            let profile = null;
                            if (db) {
                                try {
                                    const snap = await db.ref('users/' + cred.user.uid).once('value');
                                    profile = snap.val();
                                } catch(e) {}
                            }
                            loggedInAccount = {
                                uid: cred.user.uid,
                                name: (profile && profile.name) || cred.user.displayName || uInput,
                                avatar: (profile && profile.avatar) || cred.user.photoURL || DEFAULT_AVATAR
                            };
                        }
                    } catch(authErr) {
                        if (authErr.code === 'auth/wrong-password') {
                            setAuthLoading(false, originalLabel);
                            return showAuthError('كلمة المرور غير صحيحة، حاول مرة ثانية!');
                        }
                    }
                }

                if (loggedInAccount) {
                    window.currentUserAccount = loggedInAccount;
                    saveAccountToStorage(window.currentUserAccount);
                    updateHeaderAuthUI();
                    loadCloudFriends();
                    window.closeAuthModal();
                    showToast('أهلاً بعودتك! 🔥', `تم تسجيل دخولك بنجاح يا ${loggedInAccount.name}!`);
                } else {
                    setAuthLoading(false, originalLabel);
                    return showAuthError('لا يوجد حساب بهذا الاسم أو كلمة المرور غير صحيحة، تأكد أو أنشئ حساباً جديداً!');
                }
            }
        } catch(err) {
            setAuthLoading(false, originalLabel);
            showAuthError('حدث خطأ غير متوقع، يرجى المحاولة ثانية.');
        }
    };

    
    // ====================================================
    // محرر وتعديل وقص الصورة الشخصية التفاعلي (Interactive Cropper)
    // ====================================================
    let cropImg = new Image();
    let cropScale = 1.0;
    let cropBaseScale = 1.0;
    let cropOffsetX = 0;
    let cropOffsetY = 0;
    let cropRotation = 0;
    let isDraggingCrop = false;
    let dragStartX = 0;
    let dragStartY = 0;

    function ensureCropperModalExists() {
        let modal = document.getElementById('avatarCropperModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'avatar-cropper-overlay';
            modal.id = 'avatarCropperModal';
            modal.innerHTML = `
                <div class="avatar-cropper-card">
                    <h3>تعديل وقص الصورة الشخصية ✂️</h3>
                    <p class="auth-subtitle">اسحب الصورة لضبط مكانها واستخدم شريط التكبير لتناسب الإطار الدائري</p>
                    
                    <div class="crop-viewport-wrap" id="cropViewport">
                        <canvas id="cropCanvas" width="240" height="240"></canvas>
                    </div>

                    <div class="crop-controls">
                        <span>🔍</span>
                        <input type="range" id="cropZoomSlider" min="0.5" max="3" step="0.02" value="1" oninput="window.handleCropZoom(this.value)">
                        <button type="button" class="btn-crop-rotate" onclick="window.rotateCropImage()" title="تدوير 90 درجة">🔄</button>
                    </div>

                    <div class="crop-actions">
                        <button type="button" class="auth-btn-action" onclick="window.applyCroppedAvatar()">تأكيد واعتماد الصورة ✨</button>
                        <button type="button" class="auth-btn-danger" onclick="window.cancelCropAvatar()" style="background:#F1F5F9; color:#64748B; border-color:#E2E8F0; margin-top:0;">إلغاء</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            setupCropperEvents();
        }
        return modal;
    }

    function setupCropperEvents() {
        const viewport = document.getElementById('cropViewport');
        if (!viewport) return;

        // Mouse Events
        viewport.addEventListener('mousedown', (e) => {
            isDraggingCrop = true;
            dragStartX = e.clientX - cropOffsetX;
            dragStartY = e.clientY - cropOffsetY;
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDraggingCrop) return;
            cropOffsetX = e.clientX - dragStartX;
            cropOffsetY = e.clientY - dragStartY;
            redrawCropCanvas();
        });
        window.addEventListener('mouseup', () => { isDraggingCrop = false; });

        // Touch Events
        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDraggingCrop = true;
                dragStartX = e.touches[0].clientX - cropOffsetX;
                dragStartY = e.touches[0].clientY - cropOffsetY;
            }
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (!isDraggingCrop || e.touches.length !== 1) return;
            cropOffsetX = e.touches[0].clientX - dragStartX;
            cropOffsetY = e.touches[0].clientY - dragStartY;
            redrawCropCanvas();
        }, { passive: true });
        window.addEventListener('touchend', () => { isDraggingCrop = false; });

        // Mouse Wheel Zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const slider = document.getElementById('cropZoomSlider');
            if (slider) {
                let val = parseFloat(slider.value) - (e.deltaY * 0.002);
                val = Math.max(0.5, Math.min(3, val));
                slider.value = val;
                window.handleCropZoom(val);
            }
        }, { passive: false });
    }

    function redrawCropCanvas() {
        const canvas = document.getElementById('cropCanvas');
        if (!canvas || !cropImg.complete) return;
        const ctx = canvas.getContext('2d');
        const cw = canvas.width;
        const ch = canvas.height;

        ctx.clearRect(0, 0, cw, ch);
        ctx.save();
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate((cropRotation * Math.PI) / 180);
        ctx.scale(cropScale * cropBaseScale, cropScale * cropBaseScale);

        const iw = cropImg.width;
        const ih = cropImg.height;
        ctx.drawImage(cropImg, (-iw / 2) + (cropOffsetX / (cropScale * cropBaseScale)), (-ih / 2) + (cropOffsetY / (cropScale * cropBaseScale)));
        ctx.restore();
    }

    window.handleCropZoom = function(val) {
        cropScale = parseFloat(val);
        redrawCropCanvas();
    };

    window.rotateCropImage = function() {
        cropRotation = (cropRotation + 90) % 360;
        redrawCropCanvas();
    };

    window.cancelCropAvatar = function() {
        const modal = document.getElementById('avatarCropperModal');
        if (modal) modal.style.display = 'none';
    };

    window.applyCroppedAvatar = function() {
        const sourceCanvas = document.getElementById('cropCanvas');
        if (!sourceCanvas) return;

        // إنشاء كانفاس للتصدير النهائي بجودة وحجم مناسبين (200x200)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 200;
        exportCanvas.height = 200;
        const ctx = exportCanvas.getContext('2d');

        // رسم محتوى الكانفاس المعروض
        ctx.drawImage(sourceCanvas, 0, 0, 200, 200);

        const finalDataUrl = exportCanvas.toDataURL('image/jpeg', 0.88);
        if (window.currentUserAccount) {
            window.currentUserAccount.avatar = finalDataUrl;
            saveAccountToStorage(window.currentUserAccount);
            const preview = document.getElementById('modalAvatarPreview');
            if (preview) preview.src = finalDataUrl;
            updateHeaderAuthUI();
            
            // مزامنة الصورة في قاعدة البيانات إن أمكن
            const { db } = getFirebase();
            if (db && window.currentUserAccount.uid) {
                const safeKey = usernameToSafeKey(window.currentUserAccount.name);
                db.ref('app_users/' + safeKey).update({ avatar: finalDataUrl }).catch(()=>{});
                db.ref('users/' + window.currentUserAccount.uid).update({ avatar: finalDataUrl }).catch(()=>{});
            }
        }

        window.cancelCropAvatar();
        showToast('تم اعتماد الصورة! ✨', 'تم تعديل وقص صورتك الشخصية بنجاح.');
    };

    // معالج رفع الصورة لفتح أداة القص فوراً
    window.handleAvatarUpload = function(event) {
        const file = event.target.files[0];
        if (!file || !window.currentUserAccount) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            cropImg = new Image();
            cropImg.onload = function() {
                cropScale = 1.0;
                cropOffsetX = 0;
                cropOffsetY = 0;
                cropRotation = 0;
                
                // حساب المقياس الأساسي لتغطية الإطار
                const minDim = Math.min(cropImg.width, cropImg.height);
                cropBaseScale = 240 / minDim;

                const slider = document.getElementById('cropZoomSlider');
                if (slider) slider.value = 1;

                const modal = ensureCropperModalExists();
                modal.style.display = 'flex';
                redrawCropCanvas();
            };
            cropImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };


    // حفظ تعديلات الملف الشخصي
    window.saveProfileChanges = async function() {
        const newName = (document.getElementById('profileNameInput')?.value || '').trim();
        if (!newName) return showAuthError('يرجى إدخال اسم المستخدم!');
        if (!window.currentUserAccount) return;

        window.currentUserAccount.name = newName;
        setAuthLoading(true, 'حفظ التعديلات ✨');

        const { auth, db } = getFirebase();
        const safeKey = usernameToSafeKey(newName);

        try {
            saveAccountToStorage(window.currentUserAccount);
            if (db && window.currentUserAccount.uid) {
                await db.ref('app_users/' + safeKey).update({
                    name: window.currentUserAccount.name,
                    avatar: window.currentUserAccount.avatar
                }).catch(()=>{});
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

    // مزامنة حالة الحساب
    function setupAuthListener() {
        const { auth, db } = getFirebase();
        if (!auth) return;

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
                const avatar = (profile && profile.avatar) || user.photoURL || DEFAULT_AVATAR;
                window.currentUserAccount = { uid: user.uid, name: name, avatar: avatar };
                saveAccountToStorage(window.currentUserAccount);
                loadCloudFriends();
            }
            updateHeaderAuthUI();
        });
    }

    // ==================== نظام الأصدقاء الموحد (Friends System) ====================
    function getStoredFriends() {
        try {
            const raw = localStorage.getItem('fikrh_friends_list');
            return raw ? JSON.parse(raw) : [];
        } catch(e) {
            return [];
        }
    }

    function saveStoredFriends(list) {
        try {
            localStorage.setItem('fikrh_friends_list', JSON.stringify(list || []));
            window.dispatchEvent(new CustomEvent('fikrh:friends_updated', { detail: list }));
        } catch(e) {}
    }

    window.getFriendsList = function() {
        return getStoredFriends();
    };

    async function loadCloudFriends() {
        const { db } = getFirebase();
        const uid = window.currentUserAccount && window.currentUserAccount.uid;
        if (!db || !uid) return;
        try {
            const snap = await db.ref('user_friends/' + uid).once('value');
            if (!snap.exists()) return;
            const remote = snap.val() || {};
            const remoteList = Object.keys(remote).map(k => remote[k]).filter(f => f && f.name);
            const local = getStoredFriends();
            const merged = [...local];
            remoteList.forEach(rf => {
                const exists = merged.some(f =>
                    ((f.name || '').trim().toLowerCase() === (rf.name || '').trim().toLowerCase()) ||
                    (f.uid && rf.uid && f.uid === rf.uid)
                );
                if (!exists) merged.push(rf);
            });
            saveStoredFriends(merged);
        } catch (e) {}
    }

    window.isFriend = function(hostUid, hostName) {
        if (!hostName && !hostUid) return false;
        const list = getStoredFriends();
        const cleanName = (hostName || '').trim().toLowerCase();
        return list.some(f => {
            const fName = (f.name || '').trim().toLowerCase();
            return (fName && fName === cleanName) || (hostUid && f.uid && f.uid === hostUid);
        });
    };

    function isMyOwnRoom(room) {
        if (!room) return false;
        const me = window.currentUserAccount || {};
        const myName = (me.name || '').trim().toLowerCase();
        const hostName = (room.hostName || '').trim().toLowerCase();
        if (me.uid && room.hostUid && String(me.uid) === String(room.hostUid)) return true;
        return !!(myName && hostName && myName === hostName);
    }

    window.canSeeListedRoom = function(room) {
        if (!room) return false;
        if (room.accessType !== 'friends') return true;
        return isMyOwnRoom(room) || window.isFriend(room.hostUid, room.hostName);
    };

    window.canJoinListedRoom = function(room) {
        return window.canSeeListedRoom(room);
    };

    window.getRoomCreateOptions = function() {
        const extras = Array.from(document.querySelectorAll('.room-create-extras')).find(box => {
            return !!(box.offsetWidth || box.offsetHeight || box.getClientRects().length);
        }) || document.querySelector('.room-create-extras');

        if (!extras) return { roomTitle: '', accessType: 'public' };
        const title = extras.querySelector('.custom-room-title-input, #customRoomTitleInput');
        const radio = extras.querySelector('input[type="radio"]:checked');
        return {
            roomTitle: title ? (title.value || '').trim() : '',
            accessType: (radio && radio.value === 'friends') ? 'friends' : 'public'
        };
    };

    function injectRoomCreateFields() {
        const buttons = Array.from(document.querySelectorAll('button'));
        buttons.forEach((btn, idx) => {
            const label = (btn.textContent || '').replace(/\s+/g, ' ').trim();
            if (!label.includes('إنشاء غرفة')) return;
            const hostCard = btn.closest('.glass-card') || btn.parentElement;
            if (hostCard && hostCard.querySelector('.room-create-extras')) return;

            const nameGroup = 'roomAccessType_' + idx;
            const box = document.createElement('div');
            box.className = 'room-create-extras';
            box.innerHTML = `
                <div class="form-group">
                    <label>اسم الغرفة (اختياري 🏷️)</label>
                    <input type="text" class="custom-room-title-input" placeholder="مثال: غرفة الأساطير 🔥" maxlength="25">
                </div>
                <div class="room-privacy-group">
                    <label>نوع الغرفة والدخول:</label>
                    <div class="room-privacy-grid">
                        <label class="privacy-card-label">
                            <input type="radio" name="${nameGroup}" value="public" checked> 🌐 للجميع
                        </label>
                        <label class="privacy-card-label">
                            <input type="radio" name="${nameGroup}" value="friends"> 👥 للأصدقاء فقط
                        </label>
                    </div>
                </div>
            `;
            btn.parentNode.insertBefore(box, btn);
        });
    }

    window.addFriend = async function(nameInput) {
        const rawName = (nameInput || '').trim();
        if (!rawName) return showToast('تنبيه ⚠️', 'أدخل اسم المستخدم لإضافته كصديق!');

        const myName = (window.currentUserAccount && window.currentUserAccount.name) ? window.currentUserAccount.name.trim().toLowerCase() : '';
        if (myName && rawName.toLowerCase() === myName) {
            return showToast('تنبيه ⚠️', 'لا يمكنك إضافة نفسك يا بطل!');
        }

        const list = getStoredFriends();
        if (list.some(f => (f.name || '').trim().toLowerCase() === rawName.toLowerCase())) {
            return showToast('تنبيه ⚠️', 'هذا الصديق مضاف مسبقاً في قائمتك!');
        }

        // جلب صورة الصديق من قاعدة البيانات إن وجدت
        let avatar = DEFAULT_AVATAR;
        let uid = usernameToSafeKey(rawName);
        const { db } = getFirebase();
        if (db) {
            try {
                const snap = await db.ref('app_users/' + uid).once('value');
                if (snap.exists() && snap.val().avatar) {
                    avatar = snap.val().avatar;
                }
            } catch(e) {}
        }

        const newFriend = {
            name: rawName,
            avatar: avatar,
            uid: uid,
            addedAt: Date.now()
        };

        list.push(newFriend);
        saveStoredFriends(list);

        // حفظ في السحابة إن كان مسجلاً
        if (db && window.currentUserAccount && window.currentUserAccount.uid) {
            db.ref('user_friends/' + window.currentUserAccount.uid + '/' + uid).set(newFriend).catch(()=>{});
        }

        renderFriendsModalList();
        showToast('تمت الإضافة! 👥', `تمت إضافة (${rawName}) إلى قائمة أصدقائك.`);
    };

    window.removeFriend = function(friendName) {
        let list = getStoredFriends();
        const targetClean = (friendName || '').trim().toLowerCase();
        const filtered = list.filter(f => (f.name || '').trim().toLowerCase() !== targetClean);
        saveStoredFriends(filtered);

        const { db } = getFirebase();
        if (db && window.currentUserAccount && window.currentUserAccount.uid) {
            const uid = usernameToSafeKey(friendName);
            db.ref('user_friends/' + window.currentUserAccount.uid + '/' + uid).remove().catch(()=>{});
        }

        renderFriendsModalList();
        showToast('تم الحذف 🗑️', `تم حذف (${friendName}) من أصدقائك.`);
    };

    // إنشاء وبناء نافذة الأصدقاء التفاعلية
    function ensureFriendsModalExists() {
        let modal = document.getElementById('fikrhFriendsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'fikrhFriendsModal';
            modal.className = 'auth-modal-overlay';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="auth-card-box friends-modal-card">
                    <button class="auth-modal-close" onclick="window.closeFriendsModal()" title="إغلاق">✕</button>
                    <div class="auth-icon-badge">👥</div>
                    <h2>قائمة أصدقائي</h2>
                    <p class="auth-subtitle">أضف خويك باسم حسابه عشان تلاقي غرفه فوراً في الرئيسية</p>

                    <div class="my-friend-share-box">
                        <div>
                            <div class="my-friend-share-label">اسمك المسجل لمشاركته:</div>
                            <div class="my-friend-share-name" id="myFriendCodeDisplay">...</div>
                        </div>
                        <button type="button" class="btn-compact" onclick="copyMyFriendName()">نسخ 📋</button>
                    </div>

                    <div class="auth-field" style="text-align: right;">
                        <label class="auth-label" style="display:block; font-weight:800; font-size:0.82rem; margin-bottom:6px;">إضافة صديق جديد ➕</label>
                        <div style="display: flex; gap: 6px;">
                            <input type="text" id="addFriendInput" class="auth-input" placeholder="اكتب اسم صديقك هنا..." maxlength="20" style="margin: 0;" onkeydown="if(event.key==='Enter') submitAddFriendAction()">
                            <button type="button" class="auth-btn-action" onclick="submitAddFriendAction()" style="width:auto; padding: 0.55rem 1rem; white-space: nowrap; border-radius: 14px; font-size: 0.85rem;">إضافة</button>
                        </div>
                    </div>

                    <div class="friends-list-heading">أصدقاؤك المضافون (<span id="friendsCountBadge">0</span>)</div>
                    <div id="friendsListDisplayContainer" class="friends-list-container"></div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) window.closeFriendsModal();
            });
        }
        return modal;
    }

    function renderFriendsModalList() {
        const modal = ensureFriendsModalExists();
        const list = getStoredFriends();
        const container = document.getElementById('friendsListDisplayContainer');
        const countBadge = document.getElementById('friendsCountBadge');
        const myDisplay = document.getElementById('myFriendCodeDisplay');

        if (countBadge) countBadge.innerText = list.length;
        if (myDisplay) {
            myDisplay.innerText = (window.currentUserAccount && window.currentUserAccount.name) ? window.currentUserAccount.name : 'ضيف';
        }

        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1.5rem 0.5rem; color: #94A3B8; font-weight: 700; font-size: 0.85rem;">
                    لم تضف أي صديق بعد! 🤝<br>اكتب اسم صديقك في الأعلى لإضافته فوراً وتحديه في الغرف.
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(f => `
            <div class="friend-item-card">
                <div class="friend-info">
                    <img src="${f.avatar || DEFAULT_AVATAR}" class="friend-avatar" alt="${f.name}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div>
                        <div class="friend-name">${f.name}</div>
                        <div class="friend-status">صديق في فِكْرَة ⚡</div>
                    </div>
                </div>
                <button type="button" class="btn-friend-action" onclick="window.removeFriend(decodeURIComponent('${encodeURIComponent(f.name || '')}'))" title="حذف من الأصدقاء">حذف ✕</button>
            </div>
        `).join('');
    }

    window.submitAddFriendAction = function() {
        const input = document.getElementById('addFriendInput');
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            window.addFriend(val);
            input.value = '';
        }
    };

    window.copyMyFriendName = function() {
        const name = (window.currentUserAccount && window.currentUserAccount.name) ? window.currentUserAccount.name : 'ضيف';
        navigator.clipboard.writeText(name);
        showToast('تم النسخ! 📋', 'تم نسخ اسمك بنجاح.');
    };

    window.openFriendsModal = function() {
        const modal = ensureFriendsModalExists();
        renderFriendsModalList();
        modal.style.display = 'flex';
    };

    window.closeFriendsModal = function() {
        const modal = document.getElementById('fikrhFriendsModal');
        if (modal) modal.style.display = 'none';
    };


    // ==================== نظام بث وإدارة الغرف الموحد لجميع الألعاب ====================
    window.broadcastRoom = function(gameType, code, gameName, hostName, hostAvatar, roomTitle, accessType) {
        const { db } = getFirebase();
        if (!db || !code) return;
        const roomKey = gameType + '_' + code;
        const pAvatar = hostAvatar || ((window.currentUserAccount && window.currentUserAccount.avatar) ? window.currentUserAccount.avatar : DEFAULT_AVATAR);
        const pName = hostName || ((window.currentUserAccount && window.currentUserAccount.name) ? window.currentUserAccount.name : 'الهوست');
        const hostUid = (window.currentUserAccount && window.currentUserAccount.uid) ? window.currentUserAccount.uid : usernameToSafeKey(pName);
        const payload = {
            gameType: gameType,
            code: String(code),
            gameName: gameName || gameType,
            hostName: pName,
            hostAvatar: pAvatar,
            hostUid: hostUid,
            createdAt: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue) ? firebase.database.ServerValue.TIMESTAMP : Date.now()
        };

        // الهوست يمرر العنوان ونوع الدخول (7 وسائط). الضيف يحدّث الحضور فقط بدون تغيير الخصوصية.
        if (arguments.length >= 7) {
            const opts = (typeof window.getRoomCreateOptions === 'function') ? window.getRoomCreateOptions() : { roomTitle: '', accessType: 'public' };
            const titleVal = (roomTitle && String(roomTitle).trim()) ? String(roomTitle).trim() : (opts.roomTitle || gameName || gameType);
            payload.roomTitle = titleVal;
            if (accessType === 'friends' || accessType === 'public') {
                payload.accessType = accessType;
            } else {
                payload.accessType = opts.accessType === 'friends' ? 'friends' : 'public';
            }
        }

        try {
            db.ref('activeRooms/' + roomKey).update(payload).catch(() => {});
        } catch(e) {}
    };

    window.unbroadcastRoom = function(gameType, code) {
        const { db } = getFirebase();
        if (!db || !code) return;
        const roomKey = gameType + '_' + code;
        try {
            db.ref('activeRooms/' + roomKey).remove().catch(() => {});
        } catch(e) {}
    };

    window.initRoomDiscovery = function(gameType, callback) {
        // متوافق مع الاستدعاءات القديمة في صفحات الألعاب
    };

    function bootAuthUi() {
        updateHeaderAuthUI();
        setupAuthListener();
        injectRoomCreateFields();
        loadCloudFriends();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAuthUi);
    } else {
        bootAuthUi();
    }
})();

