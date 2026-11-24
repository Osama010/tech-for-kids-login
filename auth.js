// تسجيل الدخول بجوجل + مزامنة التقدم عبر Firestore
// بيشتغل جنب التخزين المحلي: المحلي للسرعة، والسحابي للمزامنة بين الأجهزة.

let fbApp = null;
let fbAuth = null;
let fbDb = null;
let fbUser = null;
let fbReady = false;

function fbConfigured() {
  return (
    typeof FIREBASE_CONFIG !== "undefined" &&
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.apiKey !== "PASTE_HERE"
  );
}

function initFirebase() {
  if (!fbConfigured()) {
    console.warn("Firebase مش متظبط: املأ firebase-config.js");
    return;
  }
  fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth = firebase.auth();
  fbDb = firebase.firestore();
  fbAuth.onAuthStateChanged(async (u) => {
    fbUser = u;
    if (u) {
      await pullProgress(u);
      renderAuthBar();
      route(); // إعادة رسم الصفحة بعد المزامنة
    } else {
      renderAuthBar();
      route();
    }
    fbReady = true;
  });
}

async function pullProgress(u) {
  try {
    const doc = await fbDb.collection("students").doc(u.uid).get();
    const local = loadProg();
    if (doc.exists) {
      const remote = doc.data().progress;
      if (remote && (remote.points || 0) >= (local.points || 0)) {
        // النسخة السحابية أحدث أو متساوية: اعتمدها
        saveProg(remote);
      } else {
        // المحلي أحدث: ارفعه
        await pushProgress(u);
      }
    } else {
      await pushProgress(u);
    }
  } catch (e) {
    console.warn("فشل تحميل التقدم السحابي", e);
  }
}

async function pushProgress(u) {
  if (!u) return;
  try {
    await fbDb.collection("students").doc(u.uid).set(
      {
        name: u.displayName || "",
        email: u.email || "",
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        progress: loadProg(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("فشل رفع التقدم", e);
  }
}

// بننده على الدالة دي من saveProg عشان أي تغيير يترفع فورًا
function cloudSync() {
  if (fbUser) pushProgress(fbUser);
}

function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(provider).catch((e) => {
    alert("حصلت مشكلة في تسجيل الدخول: " + (e.message || e));
  });
}

function signOut() {
  fbAuth.signOut();
}

function renderAuthBar() {
  const el = document.getElementById("authbar");
  if (!el) return;
  if (!fbConfigured()) {
    el.innerHTML = "";
    return;
  }
  if (fbUser) {
    const first = (fbUser.displayName || "").split(" ")[0];
    el.innerHTML = `
      <span class="chip done-chip">أهلًا ${esc(first || "يا بطل")} — تقدمك محفوظ على حسابك</span>
      <button type="button" class="btn ghost small" id="signout-btn">تسجيل خروج</button>`;
    document.getElementById("signout-btn").onclick = signOut;
  } else {
    el.innerHTML = `
      <span class="progress" style="margin:0;">سجّل دخولك بحساب جوجل علشان تقدمك ونقاطك يتحفظوا ويفتحوا من أي جهاز:</span>
      <button type="button" class="btn blue small" id="signin-btn">تسجيل الدخول بحساب جوجل</button>`;
    document.getElementById("signin-btn").onclick = signIn;
  }
}

/* ---------- لوحة المدرس ---------- */
async function renderTeacher() {
  if (!fbUser || fbUser.email !== TEACHER_EMAIL) {
    app.innerHTML = `
      <div class="topnav"><a class="btn ghost small" href="#/">الرئيسية</a></div>
      <div class="hdr"><h1>لوحة المدرس</h1>
      <p class="intro">الصفحة دي لمدرس المادة بس. سجّل دخولك بالإيميل بتاعك الأول.</p></div>
      <div class="group" id="authbar"></div>
      ${closing()}`;
    renderAuthBar();
    window.scrollTo(0, 0);
    return;
  }
  app.innerHTML = `
    <div class="topnav"><a class="btn ghost small" href="#/">الرئيسية</a></div>
    <div class="hdr"><h1>لوحة المدرس</h1>
    <p class="intro">كل الطلاب المسجلين وتقدمهم، بيتحدث مع كل دخول.</p></div>
    <div class="group"><p class="progress">بيحمّل...</p></div>
    ${closing()}`;
  window.scrollTo(0, 0);
  try {
    const snap = await fbDb.collection("students").orderBy("lastSeen", "desc").get();
    const rows = [];
    snap.forEach((d) => {
      const s = d.data();
      const p = s.progress || { points: 0, lessons: {}, badges: [] };
      const done = Object.values(p.lessons || {}).filter((x) => x.quizDone).length;
      rows.push({ name: s.name || "—", email: s.email || "—", points: p.points || 0, done, badges: (p.badges || []).length });
    });
    const body = rows.length
      ? rows.map((r) => `<tr><td>${esc(r.name)}</td><td style="direction:ltr;">${esc(r.email)}</td><td>${r.points}</td><td>${r.done} / ${LESSONS.length}</td><td>${r.badges}</td></tr>`).join("")
      : `<tr><td colspan="5">لسه مفيش طلاب سجّلوا</td></tr>`;
    document.querySelector(".group").innerHTML = `
      <p class="progress">عدد الطلاب المسجلين: ${rows.length}</p>
      <div style="overflow-x:auto;"><table class="ttable">
        <thead><tr><th>الاسم</th><th>الإيميل</th><th>النقاط</th><th>الدروس المكتملة</th><th>الشارات</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
  } catch (e) {
    document.querySelector(".group").innerHTML = `<p class="progress bad">فشل تحميل البيانات: ${esc(e.message || String(e))}</p>`;
  }
}
