// تطبيق صفحة الدروس - توجيه بالهاش علشان يشتغل على GitHub Pages
const app = document.getElementById("app");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeAr(s) {
  return s
    .trim()
    .replace(/[ً-ْٰ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase();
}

/* ---------- التقدم والنقاط والشارات ---------- */
const STORE_KEY = "t4k-progress-v1";
function loadProg() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY));
    if (p && typeof p === "object") return p;
  } catch (e) {}
  return { points: 0, lessons: {}, badges: [] };
}
function saveProg(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
}
function lesProg(p, slug) {
  if (!p.lessons[slug]) p.lessons[slug] = { quizBest: 0, examBest: 0, matchDone: false, flashDone: false, quizDone: false, examDone: false };
  return p.lessons[slug];
}
function addBadge(p, id, name) {
  if (!p.badges.some((b) => b.id === id)) p.badges.push({ id, name });
}
const LEVELS = [
  { at: 0, name: "مبتدئ" },
  { at: 100, name: "مجتهد" },
  { at: 250, name: "متفوق" },
  { at: 450, name: "بطل المنهج" },
];
function levelOf(points) {
  let l = LEVELS[0];
  for (const x of LEVELS) if (points >= x.at) l = x;
  return l;
}
function nextLevel(points) {
  for (const x of LEVELS) if (points < x.at) return x;
  return null;
}
function doneCount(p) {
  return LESSONS.filter((l) => {
    const x = p.lessons[l.slug];
    return x && x.quizDone;
  }).length;
}
function lessonBySlug(slug) {
  return LESSONS.find((l) => l.slug === slug);
}
function awardQuiz(slug, score, total) {
  const p = loadProg();
  const lp = lesProg(p, slug);
  const l = lessonBySlug(slug);
  if (score > (lp.quizBest || 0)) {
    p.points += (score - (lp.quizBest || 0)) * 10;
    lp.quizBest = score;
  }
  if (score / total >= 0.8 && !lp.quizDone) {
    lp.quizDone = true;
    addBadge(p, "lesson-" + slug, "بطل الدرس " + l.num + " " + String.fromCodePoint(0x1f3c5));
  }
  if (doneCount(p) === LESSONS.length) addBadge(p, "all", "بطل المنهج كله " + String.fromCodePoint(0x1f3c6));
  saveProg(p);
}
function awardExam(slug, score, total) {
  const p = loadProg();
  const lp = lesProg(p, slug);
  const l = lessonBySlug(slug);
  if (score > (lp.examBest || 0)) {
    p.points += (score - (lp.examBest || 0)) * 15;
    lp.examBest = score;
  }
  if (score / total >= 0.6 && !lp.examDone) {
    lp.examDone = true;
    addBadge(p, "exam-" + slug, "ناجح في امتحان الدرس " + l.num + " " + String.fromCodePoint(0x1f393));
  }
  saveProg(p);
}
function awardOnce(slug, key, pts) {
  const p = loadProg();
  const lp = lesProg(p, slug);
  if (!lp[key]) {
    lp[key] = true;
    p.points += pts;
    saveProg(p);
  }
}
function progCardHTML() {
  const p = loadProg();
  const lvl = levelOf(p.points);
  const nxt = nextLevel(p.points);
  const pct = nxt ? Math.min(100, Math.round(((p.points - lvl.at) / (nxt.at - lvl.at)) * 100)) : 100;
  const done = doneCount(p);
  return `<div class="progcard">
    <div class="progrow">
      <span class="chip points-chip">${String.fromCodePoint(0x2b50)} ${p.points} نقطة</span>
      <span class="chip level-chip">المستوى: ${lvl.name}</span>
      <span class="chip done-chip">خلصت ${done} من ${LESSONS.length} دروس</span>
    </div>
    <div class="pbar big"><span style="width:${pct}%"></span></div>
    <p class="progress">${nxt ? "فاضل " + (nxt.at - p.points) + " نقطة لمستوى «" + nxt.name + "»" : "وصلت لأعلى مستوى، برافو!"}</p>
    ${p.badges.length ? `<div class="badges">${p.badges.map((b) => `<span class="badge">${esc(b.name)}</span>`).join("")}</div>` : `<p class="progress">كمّل اختبار أي درس بـ 80% أو أكتر علشان تكسب أول شارة</p>`}
  </div>`;
}
function shareHTML() {
  return `<div class="group">
    <div class="group-label">شارك الموقع</div>
    <div class="sharebox">
      <img class="qr" src="photos/qr-site.png" alt="كود QR للموقع">
      <div class="shareside">
        <p>ابعت الموقع لزمايلك بضغطة، أو خليهم يصوّروا الكود ده بالموبايل.</p>
        <button type="button" class="btn" id="share-btn">شارك الموقع</button>
        <button type="button" class="btn ghost small" id="copy-btn">انسخ اللينك</button>
      </div>
    </div>
    <p class="progress" id="share-msg"></p>
  </div>`;
}
function initShare() {
  const url = location.href.split("#")[0];
  const msg = document.getElementById("share-msg");
  const sb = document.getElementById("share-btn");
  const cb = document.getElementById("copy-btn");
  if (sb) sb.onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "دروس البرمجة والذكاء الاصطناعي", url }); } catch (e) {}
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); msg.textContent = "اللينك اتنسخ، ابعته لزمايلك"; } catch (e) { msg.textContent = url; }
    } else { msg.textContent = url; }
  };
  if (cb) cb.onclick = async () => {
    try { await navigator.clipboard.writeText(url); msg.textContent = "اللينك اتنسخ، ابعته لزمايلك"; }
    catch (e) { msg.textContent = url; }
  };
}
function episodesHTML() {
  return `<div class="group">
    <div class="group-label">الحلقات</div>
    <p style="margin-bottom:12px; font-size:14.5px;">كل حلقات شرح المنهج على قناة Tech for Kids. اتفرج على الحلقة من هنا، واشتراكك في القناة بيوصلك كل حلقة جديدة أول ما تنزل.</p>
    <div class="episodes">${LESSONS.map((l) => `
      <div class="epcard">
        <img src="${l.photo}" alt="${esc(l.photoAlt)}">
        <div class="epbody">
          <p class="eptitle">الدرس ${l.num} | ${esc(l.title)}</p>
          <a class="btn red small" href="${l.video}" target="_blank" rel="noopener">اتفرج على الحلقة</a>
        </div>
      </div>`).join("")}
    </div>
    <a class="btn blue" href="${PLAYLIST}" target="_blank" rel="noopener" style="margin-top:10px;">قائمة تشغيل كل الدروس</a>
  </div>`;
}

function subCTA() {
  return `<div class="sub">
    <p>اشترك في القناة عشان توصلك كل حلقة جديدة أول ما تنزل</p>
    <a class="btn red" href="${SUBSCRIBE}" target="_blank" rel="noopener">اشترك في قناة Tech for Kids</a>
  </div>`;
}

function closing() {
  return `<div class="closing">فكرة وإعداد: مهندس اسامه حسن عسس. الصفحة دي مرجعك لكل دروس المنهج: أي درس جديد بينزل بيتضاف هنا على نفس اللينك.</div>
  <div class="visits">عدد زيارات الموقع: <img src="https://hits.dwyl.com/osama010/tech-for-kids-login.svg?style=flat-square&color=7c3aed" alt="عدد الزيارات" loading="lazy"></div>`;
}

/* ---------- Home ---------- */
function renderHome() {
  const prog = loadProg();
  const cards = LESSONS.map((l) => {
    const lp = prog.lessons[l.slug] || {};
    const doneMark = lp.quizDone ? `<span class="donemark">خلصت الدرس ده ✓</span>` : "";
    const best = lp.quizBest ? `<span class="best">أحسن نتيجة: ${lp.quizBest}/${l.quiz.length}</span>` : "";
    return `
    <a class="bigcard" href="#/lesson/${l.slug}">
      <img src="${l.photo}" alt="${esc(l.photoAlt)}">
      <span class="body">
        <span class="unit">${esc(l.unit)}</span>
        <span class="title">الدرس ${l.num} | ${esc(l.title)}</span>
        <span class="detail">${l.flashcards.length} بطاقات + لعبة توصيل + ${l.quiz.length} سؤال بأفكار مختلفة</span>
        ${doneMark}${best}
        <span class="cta">ابدأ الدرس</span>
      </span>
    </a>`;
  }).join("");

  app.innerHTML = `
    <div class="hdr">
      <h1>دروس البرمجة والذكاء الاصطناعي</h1>
      <div class="fact">${LESSONS.length} دروس متاحة دلوقتي</div>
      <p class="intro">اختار درس من الكروت اللي تحت وابدأ على طول. كل درس فيه حلقة الشرح وبطاقات مصطلحات ولعبة توصيل واختبار كبير بأفكار أسئلة مختلفة.</p>
    </div>
    <div class="group" id="authbar"></div>
    ${progCardHTML()}
    <div class="group">
      <div class="group-label">عن المهندس</div>
      <div class="about">
        <img class="about-photo" src="photos/osama.jpg" alt="مهندس اسامه حسن عسس">
        <p style="margin:0; font-size:14.5px; line-height:1.9;"><strong>مهندس : اسامه حسن عسس</strong><br>معيد وباحث أكاديمي في علوم الحاسب والذكاء الاصطناعي بجامعة MTI، وصاحب قناة Tech for Kids. بشرح البرمجة والذكاء الاصطناعي بأسلوب مبسط، وبشتغل على حلول تقنية بتحل مشاكل حقيقية، وعندي بحث علمي منشور في تصنيف صور تخطيط القلب بالذكاء الاصطناعي.</p>
      </div>
      <div class="skills">
        <span class="skill">الذكاء الاصطناعي</span><span class="skill">تعلم الآلة</span><span class="skill">التعلم العميق</span><span class="skill">الرؤية الحاسوبية</span><span class="skill">تحليل الصور الطبية</span><span class="skill">البرمجة</span><span class="skill">Excel</span><span class="skill">التدريس الجامعي</span>
      </div>
      <div style="margin-top:12px;">
        <button type="button" class="sq-btn" id="aboutmore-btn">اقرأ المزيد ⌄</button>
        <div class="aboutfull" id="aboutfull" hidden>
          <p>أسامة حسن عسس، معيد وباحث أكاديمي في مجال علوم الحاسب والذكاء الاصطناعي، أهتم بالبحث العلمي وتطوير الحلول التقنية التي تسهم في معالجة المشكلات الواقعية باستخدام التقنيات الحديثة.</p>
          <p>تتركز اهتماماتي البحثية في مجالات الذكاء الاصطناعي، وتعلم الآلة، والتعلم العميق، والرؤية الحاسوبية، وتحليل الصور الطبية، مع اهتمام خاص بتوظيف هذه التقنيات في التطبيقات الطبية وتحسين دقة الأنظمة الذكية.</p>
          <p>شاركت في إعداد ونشر بحث علمي بعنوان <a href="https://iapress.org/index.php/soic/article/view/4003/2032" target="_blank" rel="noopener">ECG Image Classification Using Hybrid Machine Learning and Deep Learning Techniques</a> في مجلة Statistics, Optimization & Information Computing (SOIC)، والذي تناول استخدام تقنيات تعلم الآلة والتعلم العميق في تصنيف صور تخطيط القلب الكهربائي.</p>
          <p>وعلى الصعيد الأكاديمي، أهتم بالتدريس الجامعي ونقل المعرفة، ومساعدة الطلاب على تطوير مهاراتهم العلمية والعملية في مجالات البرمجة وتكنولوجيا المعلومات.</p>
        </div>
      </div>
      <div class="contact" style="margin-top:12px;">
        <a class="btn green" href="https://wa.me/201556655614" target="_blank" rel="noopener">تواصل واتساب</a>
        <a class="btn blue" href="https://www.facebook.com/OsamaAsass" target="_blank" rel="noopener">صفحة الفيسبوك</a>
        <a class="btn red" href="https://www.youtube.com/@TechForKidsArabic" target="_blank" rel="noopener">قناة Tech for Kids على يوتيوب</a>
      </div>
    </div>
    <div class="group"><div class="group-label">قبل ما تبدأ</div>${subCTA()}</div>
    ${episodesHTML()}
    <div class="group cards">${cards}</div>
    ${shareHTML()}
    ${closing()}`;
  initShare();
  if (typeof renderAuthBar === "function") renderAuthBar();
  const amb = document.getElementById("aboutmore-btn");
  if (amb) amb.onclick = () => {
    const f = document.getElementById("aboutfull");
    f.hidden = !f.hidden;
    amb.textContent = f.hidden ? "اقرأ المزيد ⌄" : "إخفاء التفاصيل ⌃";
  };
  window.scrollTo(0, 0);
}

/* ---------- Lesson ---------- */
function renderLesson(slug) {
  const i = LESSONS.findIndex((l) => l.slug === slug);
  if (i < 0) return renderHome();
  const l = LESSONS[i];
  const prev = LESSONS[i - 1];
  const next = LESSONS[i + 1];

  app.innerHTML = `
    <div class="topnav"><a class="btn ghost small" href="#/">كل الدروس</a></div>
    <div class="hdr">
      <div class="unit">${esc(l.unit)}</div>
      <h1>الدرس ${l.num} | ${esc(l.title)}</h1>
      <div class="fact">البرمجة والذكاء الاصطناعي</div>
      <p class="intro">اتفرج على الحلقة، اقلب بطاقات المصطلحات، العب لعبة التوصيل، راجع التلخيص الشامل والأسئلة المحلولة، وفي الآخر اختبر نفسك.</p>
    </div>

    <div class="group">
      <div class="group-label">الحلقة</div>
      <img class="watch-photo" src="${l.photo}" alt="${esc(l.photoAlt)}">
      <div class="stack">
        <a class="btn" href="${l.video}" target="_blank" rel="noopener">اتفرج على الحلقة على يوتيوب</a>
        ${subCTA()}
      </div>
    </div>

    <div class="group">
      <h2>بطاقات المصطلحات</h2>
      <div class="fcards" id="fcards"></div>
      <p class="progress" id="fprog"></p>
    </div>

    <div class="group">
      <h2>لعبة التوصيل</h2>
      <p class="progress">دوس على المصطلح، وبعدها دوس على تعريفه الصح</p>
      <div class="match" id="match"></div>
      <p class="progress bad" id="mwrong" style="display:none">مش دي، جرب تاني</p>
      <div id="mdone"></div>
    </div>

    <div class="group">
      <h2>أهم النقط في الدرس</h2>
      <ul class="points">${l.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
    </div>

    <div class="group">
      <h2>التلخيص الشامل للدرس</h2>
      ${l.summary.map((sec) => `
        <div class="sumsec">
          <p class="sumh">${esc(sec.h)}</p>
          <ul class="points sumlist">${sec.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>

    <div class="group">
      <h2>أسئلة محلولة للمراجعة</h2>
      <p class="progress">ذاكر الإجابات دي كويس، مختلفة عن أسئلة الاختبار التفاعلي اللي تحت</p>
      <div id="solved"></div>
      <p class="progress" id="sprog"></p>
    </div>

    <div class="group">
      <h2>وضع الامتحان على نمط الوزارة</h2>
      <p class="progress">محاكي امتحان بوقت محدد على نمط امتحانات الوزارة: أسئلة من الدرس من غير مساعدات، وتصحيح كامل في الآخر. جاهز تبدأ لما تكون مذاكر كويس.</p>
      <a class="btn red" href="#/exam/${l.slug}">ابدأ محاكي الامتحان</a>
      <p class="progress" id="exbest"></p>
    </div>

    <div class="group">
      <h2>اختبر نفسك</h2>
      <p class="progress">${l.quiz.length} سؤال بأفكار مختلفة: اختيار من متعدد وصح أو خطأ وأكمل الفراغ</p>
      <div class="gamebar">
        <span class="chip points" id="chip-points">النقط: 0</span>
        <span class="chip streak" id="chip-streak">السلسلة: 0</span>
        <div class="pbar"><span id="pbar-fill" style="width:0%"></span></div>
      </div>
      <div id="quiz"></div>
      <p class="progress" id="qprog"></p>
      <div id="qdone"></div>
    </div>

    <div class="lessonnav">
      ${prev ? `<a class="btn ghost small" href="#/lesson/${prev.slug}">الدرس اللي قبله: ${esc(prev.title)}</a>` : "<span></span>"}
      ${next ? `<a class="btn ghost small" href="#/lesson/${next.slug}">الدرس اللي بعده: ${esc(next.title)}</a>` : "<span></span>"}
    </div>
    <div class="closing">فكرة وإعداد: مهندس اسامه حسن عسس.</div>`;

  initFlashcards(l);
  initMatching(l);
  initSolved(l);
  initQuiz(l);
  const exb = document.getElementById("exbest");
  const lp0 = loadProg().lessons[l.slug];
  if (exb && lp0 && lp0.examBest) exb.textContent = "أحسن نتيجة في المحاكي: " + lp0.examBest + " من " + l.quiz.length;
  window.scrollTo(0, 0);
}

/* ---------- Flashcards ---------- */
function initFlashcards(l) {
  const wrap = document.getElementById("fcards");
  const prog = document.getElementById("fprog");
  const flipped = l.flashcards.map(() => false);
  wrap.innerHTML = l.flashcards.map((c, i) => `
    <button type="button" class="flip" data-i="${i}">
      <span class="flip-inner">
        <span class="face front">${esc(c.term)}<span class="hint">دوس علشان تشوف المعنى</span></span>
        <span class="face back">${esc(c.def)}</span>
      </span>
    </button>`).join("");
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest(".flip");
    if (!b) return;
    const i = +b.dataset.i;
    flipped[i] = !flipped[i];
    b.classList.toggle("flipped", flipped[i]);
    const n = flipped.filter(Boolean).length;
    prog.textContent =
      n === l.flashcards.length
        ? "قلبت كل البطاقات، جرب لعبة التوصيل تحت"
        : n > 0
          ? `قلبت ${n} من ${l.flashcards.length} بطاقات`
          : "";
    if (n === l.flashcards.length) awardOnce(l.slug, "flashDone", 10);
  });
}

/* ---------- Solved questions ---------- */
function initSolved(l) {
  const wrap = document.getElementById("solved");
  const prog = document.getElementById("sprog");
  const open = l.solved.map(() => false);
  wrap.innerHTML = l.solved.map((s, i) => `
    <div class="sq">
      <div class="sq-top"><span class="sq-num">س${i + 1}</span><p class="sq-q">${esc(s.q)}</p></div>
      <button type="button" class="sq-btn" data-i="${i}">أظهر الإجابة</button>
      <p class="sq-a" data-a="${i}" hidden>${esc(s.a)}</p>
    </div>`).join("");
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest(".sq-btn");
    if (!b) return;
    const i = +b.dataset.i;
    open[i] = !open[i];
    b.textContent = open[i] ? "إخفاء الإجابة" : "أظهر الإجابة";
    wrap.querySelector(`[data-a="${i}"]`).hidden = !open[i];
    const n = open.filter(Boolean).length;
    if (prog) prog.textContent = n === l.solved.length
      ? "راجعت كل الإجابات، يلا اختبر نفسك تحت"
      : `فتحت ${n} من ${l.solved.length} إجابات`;
  });
}

/* ---------- Matching ---------- */
function initMatching(l) {
  const wrap = document.getElementById("match");
  const wrongEl = document.getElementById("mwrong");
  const doneEl = document.getElementById("mdone");
  const defs = l.matching
    .map((p, i) => ({ def: p.def, pair: i }))
    .sort((a, b) => ((a.pair * 7 + 3) % 11) - ((b.pair * 7 + 3) % 11));
  let selected = null;
  const matched = new Set();

  function draw() {
    wrap.innerHTML = `
      <div class="mcol">${l.matching
        .map((p, i) => `<button type="button" class="opt term${selected === i ? " selected" : ""}${matched.has(i) ? " right" : ""}" data-t="${i}">${esc(p.term)}${matched.has(i) ? " ✓" : ""}</button>`)
        .join("")}</div>
      <div class="mcol">${defs
        .map((d) => `<button type="button" class="opt${matched.has(d.pair) ? " right" : ""}" data-d="${d.pair}">${esc(d.def)}${matched.has(d.pair) ? " ✓" : ""}</button>`)
        .join("")}</div>`;
  }
  draw();

  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    wrongEl.style.display = "none";
    if (b.dataset.t !== undefined) {
      const i = +b.dataset.t;
      if (matched.has(i)) return;
      selected = i;
      draw();
      return;
    }
    if (b.dataset.d !== undefined && selected !== null) {
      const pair = +b.dataset.d;
      if (matched.has(pair)) return;
      if (pair === selected) {
        matched.add(pair);
        selected = null;
        draw();
        if (matched.size === l.matching.length) {
          awardOnce(l.slug, "matchDone", 15);
          doneEl.innerHTML = `<div class="score" style="margin-top:12px">
            <p>برافو! وصلت كل مصطلح بتعريفه الصح</p>
            <button type="button" class="btn" id="mretry">العبها من الأول</button>
          </div>`;
          document.getElementById("mretry").onclick = () => {
            matched.clear();
            doneEl.innerHTML = "";
            draw();
          };
        }
      } else {
        wrongEl.style.display = "block";
      }
    }
  });
}

/* ---------- Quiz (3 أنواع أسئلة + نقط وسلسلة) ---------- */
function initQuiz(l) {
  const wrap = document.getElementById("quiz");
  const prog = document.getElementById("qprog");
  const doneEl = document.getElementById("qdone");
  const n = l.quiz.length;
  const answers = new Array(n).fill(null); // true = صح، false = غلط

  const typeLabel = { mcq: "اختيار من متعدد", tf: "صح أو خطأ", fill: "أكمل الفراغ" };
  let points = 0;
  let streak = 0;
  const chipP = document.getElementById("chip-points");
  const chipS = document.getElementById("chip-streak");
  const pfill = document.getElementById("pbar-fill");

  function confetti() {
    const colors = ["#7c3aed", "#ec4899", "#22d3ee", "#f59e0b", "#22c55e"];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.background = colors[i % colors.length];
      c.style.insetInlineStart = Math.random() * 100 + "vw";
      c.style.animationDelay = Math.random() * 0.8 + "s";
      c.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  function answeredCount() {
    return answers.filter((a) => a !== null).length;
  }

  function applyResult(ok) {
    if (ok) {
      points += 10;
      streak += 1;
    } else {
      streak = 0;
    }
    chipP.textContent = "النقط: " + points;
    chipS.textContent =
      "السلسلة: " + streak + (streak >= 3 ? " " + String.fromCodePoint(0x1f525) : "");
    pfill.style.width = (answeredCount() / n) * 100 + "%";
  }

  wrap.innerHTML = l.quiz.map((q, qi) => {
    let body = "";
    if (q.type === "mcq") {
      body = `<div class="opts">${q.options
        .map((o, oi) => `<button type="button" class="opt" data-q="${qi}" data-o="${oi}">${esc(o)}</button>`)
        .join("")}</div>`;
    } else if (q.type === "tf") {
      body = `<div class="tfrow">
        <button type="button" class="opt" data-q="${qi}" data-tf="1">صح</button>
        <button type="button" class="opt" data-q="${qi}" data-tf="0">خطأ</button>
      </div>`;
    } else {
      body = `<div class="fillrow">
          <input type="text" inputmode="text" placeholder="اكتب الإجابة هنا" data-fill="${qi}" aria-label="إجابة السؤال ${qi + 1}">
          <button type="button" class="btn small" data-check="${qi}">تحقق</button>
        </div>
        <div class="fill-answer" id="fans-${qi}"></div>`;
    }
    return `<div class="q">
      <span class="qtype ${q.type}">${typeLabel[q.type]}</span>
      <p class="qtext">${qi + 1}. ${esc(q.q)}</p>
      ${body}
    </div>`;
  }).join("");

  function score() {
    return answers.reduce((s, a) => (a === true ? s + 1 : s), 0);
  }

  function maybeDone() {
    const c = answeredCount();
    prog.textContent = c > 0 && c < n ? `جاوبت ${c} من ${n}` : "";
    if (c === n) {
      const s = score();
      awardQuiz(l.slug, s, n);
      if (s === n) confetti();
      doneEl.innerHTML = `<div class="score" style="margin-top:12px">
        <p>نتيجتك: ${s} من ${n} (${s * 10} نقطة)${
          s === n
            ? " — ممتاز! جاهز للدرس اللي بعده"
            : s >= n / 2
              ? " — كويس، راجع النقط اللي غلطت فيها"
              : " — اتفرج على الحلقة تاني وجرب مرة كمان"
        }</p>
        <button type="button" class="btn" id="qretry">أعد الاختبار</button>
      </div>
      ${subCTA()}`;
      document.getElementById("qretry").onclick = () => location.reload();
    }
  }

  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;

    if (b.dataset.o !== undefined) {
      const qi = +b.dataset.q;
      if (answers[qi] !== null) return;
      const q = l.quiz[qi];
      const oi = +b.dataset.o;
      answers[qi] = oi === q.correct;
      applyResult(answers[qi]);
      wrap.querySelectorAll(`button[data-q="${qi}"]`).forEach((x) => {
        const xo = +x.dataset.o;
        if (xo === q.correct) x.classList.add("right"), (x.textContent = q.options[xo] + " ✓");
        else if (xo === oi) x.classList.add("wrong"), (x.textContent = q.options[xo] + " ✗");
        else x.classList.add("dim");
      });
      maybeDone();
      return;
    }

    if (b.dataset.tf !== undefined) {
      const qi = +b.dataset.q;
      if (answers[qi] !== null) return;
      const q = l.quiz[qi];
      const picked = b.dataset.tf === "1";
      answers[qi] = picked === q.answer;
      applyResult(answers[qi]);
      wrap.querySelectorAll(`button[data-q="${qi}"]`).forEach((x) => {
        const xt = x.dataset.tf === "1";
        if (xt === q.answer) x.classList.add("right"), (x.textContent = (xt ? "صح" : "خطأ") + " ✓");
        else if (xt === picked) x.classList.add("wrong"), (x.textContent = (xt ? "صح" : "خطأ") + " ✗");
        else x.classList.add("dim");
      });
      maybeDone();
      return;
    }

    if (b.dataset.check !== undefined) {
      const qi = +b.dataset.check;
      if (answers[qi] !== null) return;
      const q = l.quiz[qi];
      const inp = wrap.querySelector(`input[data-fill="${qi}"]`);
      const val = normalizeAr(inp.value || "");
      const ok = q.accept.some((a) => normalizeAr(a) === val) && val !== "";
      answers[qi] = ok;
      applyResult(ok);
      const fans = document.getElementById("fans-" + qi);
      inp.disabled = true;
      b.disabled = true;
      if (ok) {
        fans.className = "fill-answer good";
        fans.textContent = "إجابة صحيحة ✓";
        inp.style.borderColor = "#22c55e";
        inp.style.background = "rgba(34,197,94,.15)";
      } else {
        fans.className = "fill-answer bad";
        fans.textContent = "إجابة غلط ✗ الإجابة الصح: " + q.answer;
        inp.style.borderColor = "#ef4444";
        inp.style.background = "rgba(239,68,68,.12)";
      }
      maybeDone();
    }
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.fill !== undefined) {
      e.preventDefault();
      const btn = wrap.querySelector(`button[data-check="${e.target.dataset.fill}"]`);
      if (btn) btn.click();
    }
  });
}

/* ---------- Exam mode (محاكي الوزارة) ---------- */
let examTimer = null;
function renderExam(slug) {
  const l = lessonBySlug(slug);
  if (!l) return renderHome();
  const n = l.quiz.length;
  const totalSec = n * 60; // دقيقة لكل سؤال
  let left = totalSec;
  const picks = new Array(n).fill(null); // mcq: رقم الاختيار، tf: true/false، fill: نص

  app.innerHTML = `
    <div class="topnav"><a class="btn ghost small" href="#/lesson/${l.slug}">ارجع للدرس</a></div>
    <div class="hdr">
      <div class="unit">محاكي الامتحان — على نمط الوزارة</div>
      <h1>امتحان الدرس ${l.num} | ${esc(l.title)}</h1>
      <div class="fact">${n} سؤال في ${n} دقيقة</div>
      <p class="intro">زي امتحان الوزارة بالظبط: جاوب على كل الأسئلة من غير مساعدات، واضغط "سلّم الامتحان" قبل ما الوقت يخلص. التصحيح والدرجة هيظهروا بعد التسليم.</p>
    </div>
    <div class="exambar">
      <span class="chip timer" id="timer"></span>
      <button type="button" class="btn red small" id="submit-exam">سلّم الامتحان</button>
    </div>
    <div id="examq">${l.quiz.map((q, qi) => {
      let body = "";
      if (q.type === "mcq") {
        body = `<div class="opts">${q.options.map((o, oi) => `<button type="button" class="opt" data-q="${qi}" data-o="${oi}">${esc(o)}</button>`).join("")}</div>`;
      } else if (q.type === "tf") {
        body = `<div class="tfrow">
          <button type="button" class="opt" data-q="${qi}" data-tf="1">صح</button>
          <button type="button" class="opt" data-q="${qi}" data-tf="0">خطأ</button>
        </div>`;
      } else {
        body = `<div class="fillrow"><input type="text" placeholder="اكتب الإجابة هنا" data-fill="${qi}" aria-label="إجابة السؤال ${qi + 1}"></div>`;
      }
      return `<div class="q" id="eq-${qi}">
        <span class="qtype ${q.type}">${{ mcq: "اختيار من متعدد", tf: "صح أو خطأ", fill: "أكمل الفراغ" }[q.type]}</span>
        <p class="qtext">السؤال ${qi + 1}: ${esc(q.q)}</p>
        ${body}
        <div class="fill-answer" id="enote-${qi}"></div>
      </div>`;
    }).join("")}</div>
    <div id="examdone"></div>`;

  const timerEl = document.getElementById("timer");
  function tick() {
    const m = Math.floor(left / 60);
    const s = left % 60;
    timerEl.textContent = "الوقت المتبقي: " + m + ":" + (s < 10 ? "0" : "") + s;
    timerEl.classList.toggle("low", left <= 60);
    if (left <= 0) { finish(true); return; }
    left--;
  }
  tick();
  examTimer = setInterval(tick, 1000);

  const wrap = document.getElementById("examq");
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.id === "submit-exam") return;
    const qi = +b.dataset.q;
    if (b.dataset.o !== undefined) {
      picks[qi] = +b.dataset.o;
      wrap.querySelectorAll(`button[data-q="${qi}"]`).forEach((x) => x.classList.toggle("picked", +x.dataset.o === picks[qi]));
    } else if (b.dataset.tf !== undefined) {
      picks[qi] = b.dataset.tf === "1";
      wrap.querySelectorAll(`button[data-q="${qi}"]`).forEach((x) => x.classList.toggle("picked", (x.dataset.tf === "1") === picks[qi]));
    }
  });

  let done = false;
  function finish(timeout) {
    if (done) return;
    done = true;
    clearInterval(examTimer);
    // اقرأ إجابات الفراغات
    wrap.querySelectorAll("input[data-fill]").forEach((inp) => { picks[+inp.dataset.fill] = inp.value || ""; inp.disabled = true; });
    wrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
    document.getElementById("submit-exam").disabled = true;

    let score = 0;
    l.quiz.forEach((q, qi) => {
      let ok = false;
      if (q.type === "mcq") ok = picks[qi] === q.correct;
      else if (q.type === "tf") ok = picks[qi] === q.answer;
      else ok = q.accept.some((a) => normalizeAr(a) === normalizeAr(String(picks[qi] || ""))) && normalizeAr(String(picks[qi] || "")) !== "";
      if (ok) score++;
      const note = document.getElementById("enote-" + qi);
      const card = document.getElementById("eq-" + qi);
      if (ok) { note.className = "fill-answer good"; note.textContent = "إجابة صحيحة ✓"; card.classList.add("ex-right"); }
      else {
        note.className = "fill-answer bad";
        const right = q.type === "mcq" ? q.options[q.correct] : q.type === "tf" ? (q.answer ? "صح" : "خطأ") : q.answer;
        note.textContent = (picks[qi] === null || picks[qi] === "" ? "مجاوبتش ✗ " : "إجابة غلط ✗ ") + "الصح: " + right;
        card.classList.add("ex-wrong");
      }
    });

    awardExam(l.slug, score, n);
    const pct = Math.round((score / n) * 100);
    const grade = pct >= 85 ? "ممتاز" : pct >= 65 ? "جيد جدًا" : pct >= 50 ? "جيد" : "محتاج تراجع الدرس تاني";
    const d = document.getElementById("examdone");
    d.innerHTML = `<div class="score" style="margin-top:14px">
      <p style="font-size:18px; font-weight:800;">${timeout ? "خلص الوقت! " : ""}نتيجتك: ${score} من ${n} (${pct}%) — ${grade}</p>
      <p class="progress">راجع التصحيح فوق: الأخضر إجاباتك الصح، والأحمر اللي محتاج تراجعه.</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <a class="btn" href="#/exam/${l.slug}">أعد المحاكي</a>
        <a class="btn ghost small" href="#/lesson/${l.slug}">ارجع للدرس</a>
        <a class="btn ghost small" href="#/">كل الدروس</a>
      </div>
    </div>`;
    d.scrollIntoView({ behavior: "smooth" });
    if (score === n) {
      const colors = ["#7c3aed", "#ec4899", "#22d3ee", "#f59e0b", "#22c55e"];
      for (let i = 0; i < 60; i++) {
        const c = document.createElement("span");
        c.className = "confetti";
        c.style.background = colors[i % colors.length];
        c.style.insetInlineStart = Math.random() * 100 + "vw";
        c.style.animationDelay = Math.random() * 0.8 + "s";
        c.style.animationDuration = 2.2 + Math.random() * 1.6 + "s";
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4500);
      }
    }
  }
  document.getElementById("submit-exam").onclick = () => finish(false);
  window.scrollTo(0, 0);
}

/* ---------- Router ---------- */
function route() {
  if (examTimer) { clearInterval(examTimer); examTimer = null; }
  const h = location.hash || "#/";
  // بوابة الدخول: مفيش محتوى قبل تسجيل الدخول وموافقة المدرس
  if (typeof fbConfigured === "function" && fbConfigured()) {
    if (!fbUser) return renderGate();
    if (h === "#/teacher" && typeof renderTeacher === "function") return renderTeacher();
    if (fbStatus !== "approved") return renderPending(fbUser, fbStatus || "pending");
  }
  if (h === "#/teacher" && typeof renderTeacher === "function") return renderTeacher();
  const me = h.match(/^#\/exam\/(\w+)/);
  if (me) return renderExam(me[1]);
  const m = h.match(/^#\/lesson\/(\w+)/);
  if (m) renderLesson(m[1]);
  else renderHome();
}
window.addEventListener("hashchange", route);
route();
