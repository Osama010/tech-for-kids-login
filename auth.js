// تسجيل الدخول بجوجل + مزامنة التقدم عبر Firestore
// بيشتغل جنب التخزين المحلي: المحلي للسرعة، والسحابي للمزامنة بين الأجهزة.

let fbApp = null;
let fbAuth = null;
let fbDb = null;
let fbUser = null;
let fbReady = false;
let fbStatus = null; // pending | approved | rejected
let approvalUnsub = null;

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
    fbStatus = null;
    if (approvalUnsub) { approvalUnsub(); approvalUnsub = null; }
    if (u) {
      fbStatus = await ensureStudent(u);
      if (fbStatus === "approved") {
        await pullProgress(u);
        renderAuthBar();
        route(); // إعادة رسم الصفحة بعد المزامنة
      } else {
        renderPending(u, fbStatus);
        watchApproval(u);
      }
    } else {
      renderAuthBar();
      route();
    }
    fbReady = true;
  });
}

// تسجيل الطالب أول مرة كطلب مستني الموافقة، أو قراءة حالته
async function ensureStudent(u) {
  const ref = fbDb.collection("students").doc(u.uid);
  try {
    if (u.email === TEACHER_EMAIL) {
      // المدرس معتمد دايمًا
      await ref.set({ status: "approved", name: u.displayName || "", email: u.email || "" }, { merge: true });
      return "approved";
    }
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        name: u.displayName || "",
        email: u.email || "",
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        progress: loadProg(),
      });
      return "pending";
    }
    // المسجلين قبل نظام الموافقات معتمدين تلقائيًا
    return snap.data().status || "approved";
  } catch (e) {
    console.warn("فشل تسجيل الطالب", e);
    return "pending";
  }
}

// صفحة انتظار موافقة المدرس
function renderPending(u, status) {
  const rejected = status === "rejected";
  app.innerHTML = `
    <div class="hdr"><h1>${rejected ? "طلب الدخول اترفض" : "طلبك تحت المراجعة"}</h1>
    <p class="intro">${rejected ? "للأسف المهندس مش موافق على طلب الدخول ده. لو تعتقد إن فيه لبس، كلمه من زرار واتساب تحت." : "طلب دخولك وصل للمهندس. أول ما يوافق هتدخل على طول من غير ما تعمل أي حاجة، سيب الصفحة مفتوحة أو ارجع لها بعدين."}</p></div>
    <div class="group" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
      <span class="chip done-chip">${esc(u.displayName || "طالب")}</span>
      <span class="chip" style="direction:ltr;">${esc(u.email || "")}</span>
      <button type="button" class="btn ghost small" id="signout-btn2">تسجيل خروج</button>
    </div>
    ${closing()}`;
  const so = document.getElementById("signout-btn2");
  if (so) so.onclick = signOut;
  window.scrollTo(0, 0);
}

// متابعة حية: أول ما المدرس يوافق، الطالب يدخل لوحده
function watchApproval(u) {
  approvalUnsub = fbDb.collection("students").doc(u.uid).onSnapshot(
    (snap) => {
      const st = snap.exists ? snap.data().status : null;
      if (st === "approved") {
        fbStatus = "approved";
        if (approvalUnsub) { approvalUnsub(); approvalUnsub = null; }
        pullProgress(u).then(() => { renderAuthBar(); route(); });
      } else if (st === "rejected") {
        renderPending(u, "rejected");
      }
    },
    () => {}
  );
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
    const isTeacher = fbUser.email === TEACHER_EMAIL;
    el.innerHTML = `
      <span class="chip done-chip">أهلًا ${esc(first || "يا بطل")} — تقدمك محفوظ على حسابك</span>
      ${isTeacher ? `<a class="btn blue small" href="#/teacher">لوحة المدرس</a>` : ""}
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
    const pending = [];
    snap.forEach((d) => {
      const s = d.data();
      const p = s.progress || { points: 0, lessons: {}, badges: [] };
      const done = Object.values(p.lessons || {}).filter((x) => x.quizDone).length;
      const st = s.status || "approved";
      if (st === "pending") {
        pending.push({ id: d.id, name: s.name || "—", email: s.email || "—" });
      } else {
        rows.push({ name: s.name || "—", email: s.email || "—", points: p.points || 0, done, badges: (p.badges || []).length, status: st });
      }
    });
    const body = rows.length
      ? rows.map((r) => `<tr><td>${esc(r.name)}</td><td style="direction:ltr;">${esc(r.email)}</td><td>${r.points}</td><td>${r.done} / ${LESSONS.length}</td><td>${r.badges}</td><td>${r.status === "rejected" ? "مرفوض" : "مقبول"}</td></tr>`).join("")
      : `<tr><td colspan="6">لسه مفيش طلاب سجّلوا</td></tr>`;
    const pendingHTML = pending.length
      ? `<div class="group-label">طلبات مستنية موافقتك (${pending.length})</div>` +
        pending
          .map(
            (r) => `<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px;">
              <span class="chip done-chip">${esc(r.name)}</span>
              <span class="chip" style="direction:ltr;">${esc(r.email)}</span>
              <button type="button" class="btn small" id="ap-${r.id}">موافقة</button>
              <button type="button" class="btn ghost small" id="rj-${r.id}">رفض</button>
            </div>`
          )
          .join("")
      : "";
    document.querySelector(".group").innerHTML = `
      ${pendingHTML}
      <p class="progress">عدد الطلاب المقبولين: ${rows.length}</p>
      <div style="overflow-x:auto;"><table class="ttable">
        <thead><tr><th>الاسم</th><th>الإيميل</th><th>النقاط</th><th>الدروس المكتملة</th><th>الشارات</th><th>الحالة</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
    pending.forEach((r) => {
      const ap = document.getElementById("ap-" + r.id);
      const rj = document.getElementById("rj-" + r.id);
      if (ap) ap.onclick = async () => {
        ap.disabled = true;
        await fbDb.collection("students").doc(r.id).update({ status: "approved" });
        renderTeacher();
      };
      if (rj) rj.onclick = async () => {
        rj.disabled = true;
        await fbDb.collection("students").doc(r.id).update({ status: "rejected" });
        renderTeacher();
      };
    });
  } catch (e) {
    document.querySelector(".group").innerHTML = `<p class="progress bad">فشل تحميل البيانات: ${esc(e.message || String(e))}</p>`;
  }
}
