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
    fbReady = true;
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
      renderGate();
    }
  });
}

// هل يقدر يشوف المحتوى؟
function fbCanSeeContent() {
  return fbUser && fbStatus === "approved";
}

// بوابة الدخول: صفحة مستقلة تمامًا قبل أي محتوى
const gateInput = "width:100%; padding:12px 14px; border-radius:12px; border:1px solid rgba(148,163,184,.35); background:rgba(15,23,42,.7); color:#e2e8f0; font-family:inherit; font-size:15px; margin-bottom:10px; box-sizing:border-box; direction:ltr; text-align:left;";

function renderGate() {
  app.innerHTML = `
    <div class="hdr" style="text-align:center; margin-top:48px;">
      <h1>دروس البرمجة والذكاء الاصطناعي</h1>
      <div class="fact">مع م. اسامه حسن عسس</div>
    </div>
    <div class="group" style="max-width:480px; margin:24px auto;">
      ${!fbReady ? `<p class="intro" style="text-align:center;">ثانية واحدة، بنجهز صفحة الدخول...</p>` : `
      <p class="intro" style="text-align:center;">الموقع ده خاص بالطلاب المسجلين بس. سجّل دخولك، ولو أول مرة اعمل حساب وهيوصل طلبك للمهندس يوافق عليه الأول.</p>
      <div class="group-label">تسجيل الدخول</div>
      <input id="li-email" type="email" placeholder="الإيميل" style="${gateInput}">
      <input id="li-pass" type="password" placeholder="الباسورد" style="${gateInput}">
      <button type="button" class="btn" id="li-btn" style="width:100%; justify-content:center;">دخول</button>
      <div class="group-label" style="margin-top:18px;">أول مرة هنا؟ اعمل حساب جديد</div>
      <input id="rg-name" type="text" placeholder="اسمك بالكامل" style="${gateInput} direction:rtl; text-align:right;">
      <input id="rg-email" type="email" placeholder="الإيميل" style="${gateInput}">
      <input id="rg-pass" type="password" placeholder="اختار باسورد (6 حروف أو أكتر)" style="${gateInput}">
      <button type="button" class="btn blue" id="rg-btn" style="width:100%; justify-content:center;">إنشاء الحساب</button>
      <p class="progress" style="margin-top:8px;">الحساب الجديد بيستنى موافقة المهندس قبل ما تدخل الدروس.</p>
      <p class="progress bad" id="gate-msg" style="min-height:1em;"></p>
      <div style="text-align:center; margin-top:6px; border-top:1px solid rgba(148,163,184,.2); padding-top:14px;">
        <button type="button" class="btn ghost small" id="gate-google">أو الدخول بحساب جوجل</button>
      </div>`}
    </div>
    ${closing()}`;
  const g = document.getElementById("gate-google");
  if (g) g.onclick = signIn;
  const li = document.getElementById("li-btn");
  if (li) li.onclick = signInEmail;
  const rg = document.getElementById("rg-btn");
  if (rg) rg.onclick = registerEmail;
  window.scrollTo(0, 0);
}

function gateMsg(t) {
  const m = document.getElementById("gate-msg");
  if (m) m.textContent = t || "";
}

function authErrAr(e) {
  const c = (e && e.code) || "";
  if (c.includes("user-not-found") || c.includes("wrong-password") || c.includes("invalid-credential")) return "الإيميل أو الباسورد غلط.";
  if (c.includes("email-already-in-use")) return "الإيميل ده متسجل قبل كده، جرّب تسجيل الدخول.";
  if (c.includes("invalid-email")) return "الإيميل مش مكتوب صح.";
  if (c.includes("weak-password")) return "الباسورد ضعيف، خليه 6 حروف أو أرقام على الأقل.";
  if (c.includes("too-many-requests")) return "محاولات كتير، استنى شوية وجرّب تاني.";
  if (c.includes("network")) return "مشكلة في النت، اتأكد من الاتصال وجرّب تاني.";
  return "حصلت مشكلة، جرّب تاني.";
}

async function signInEmail() {
  const email = document.getElementById("li-email").value.trim();
  const pass = document.getElementById("li-pass").value;
  if (!email || !pass) return gateMsg("اكتب الإيميل والباسورد الأول.");
  gateMsg("");
  try {
    await fbAuth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    gateMsg(authErrAr(e));
  }
}

async function registerEmail() {
  const name = document.getElementById("rg-name").value.trim();
  const email = document.getElementById("rg-email").value.trim();
  const pass = document.getElementById("rg-pass").value;
  if (!name || !email || !pass) return gateMsg("اكتب اسمك والإيميل والباسورد.");
  gateMsg("");
  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    // ثبّت الاسم في سجل الطالب (onAuthStateChanged ممكن يكون اتنفذ قبل updateProfile)
    await fbDb.collection("students").doc(cred.user.uid).set({ name }, { merge: true });
  } catch (e) {
    gateMsg(authErrAr(e));
  }
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
      ? rows.map((r, i) => `<tr><td>${esc(r.name)}</td><td style="direction:ltr;">${esc(r.email)}</td><td>${r.points}</td><td>${r.done} / ${LESSONS.length}</td><td>${r.badges}</td><td>${r.status === "rejected" ? "مرفوض" : "مقبول"}</td><td><button type="button" class="btn ghost small" id="rs-${i}">إعادة ضبط الباسورد</button></td></tr>`).join("")
      : `<tr><td colspan="7">لسه مفيش طلاب سجّلوا</td></tr>`;
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
        <thead><tr><th>الاسم</th><th>الإيميل</th><th>النقاط</th><th>الدروس المكتملة</th><th>الشارات</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
      <p class="progress" id="rs-msg"></p>`;
    rows.forEach((r, i) => {
      const rs = document.getElementById("rs-" + i);
      if (rs) rs.onclick = async () => {
        rs.disabled = true;
        const m = document.getElementById("rs-msg");
        try {
          await fbAuth.sendPasswordResetEmail(r.email);
          if (m) m.textContent = `اتبعت إيميل إعادة الضبط لـ ${r.email} — الطالب هيفتح اللينك اللي فيه ويختار باسورد جديد.`;
        } catch (e) {
          if (m) m.textContent = "فشل إرسال الإيميل: " + (e.message || e);
          rs.disabled = false;
        }
      };
    });
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
