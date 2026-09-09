/* ---------- 폰트 로딩 전 텍스트 노출 방지 ---------- */

document.documentElement.classList.add("fonts-loading");

const fontsReadyPromise = Promise.race([
  document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

/* ---------- 스크롤 / 우클릭 / 이미지 드래그 방지 ---------- */

document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dragstart", (e) => e.preventDefault());

const SCROLLABLE_SELECTOR = ".char-section, .char-image-wrap";

document.addEventListener(
  "wheel",
  (e) => {
    if (!e.target.closest(SCROLLABLE_SELECTOR)) e.preventDefault();
  },
  { passive: false }
);

document.addEventListener(
  "touchmove",
  (e) => {
    if (!e.target.closest(SCROLLABLE_SELECTOR)) e.preventDefault();
  },
  { passive: false }
);

/* ---------- 엘리먼트 ---------- */

const introPhrase = document.getElementById("intro-phrase");
const carousel = document.getElementById("carousel");
const panel = document.getElementById("char-panel");
const image = document.getElementById("char-image");
const imageWrap = document.getElementById("char-image-wrap");
const catchEl = document.getElementById("char-catch");
const nameEl = document.getElementById("char-name");
const metaEl = document.getElementById("char-meta");
const tabsWrap = document.getElementById("char-tabs");
const sectionsWrap = document.getElementById("char-sections");
const dotsWrap = document.getElementById("dots");
const collapseBtn = document.getElementById("collapse-btn");
const bgmBtn = document.getElementById("bgm-btn");
const bgmVolume = document.getElementById("bgm-volume");
const mobileInfoBtn = document.getElementById("mobile-info-btn");

let characters = [];
let current = 0;

const collapseIcon = collapseBtn.querySelector("i");

collapseBtn.addEventListener("click", () => {
  const collapsed = panel.classList.toggle("collapsed");
  collapseIcon.className = collapsed ? "fa-solid fa-chevron-right" : "fa-solid fa-chevron-left";
});

const mobileInfoIcon = mobileInfoBtn.querySelector("i");

mobileInfoBtn.addEventListener("click", () => {
  const open = panel.classList.toggle("mobile-open");
  mobileInfoIcon.className = open ? "fa-solid fa-xmark" : "fa-solid fa-info";
});

/* ---------- 섹션 본문 내 [이미지경로] 치환 ---------- */

const INLINE_IMAGE_PATTERN = /\[([^\[\]]+\.(?:svg|png|jpe?g|gif|webp))\]/gi;

function renderSectionText(container, text) {
  let lastIndex = 0;
  let match;

  INLINE_IMAGE_PATTERN.lastIndex = 0;
  while ((match = INLINE_IMAGE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const img = document.createElement("img");
    img.className = "section-inline-image";
    img.src = match[1];
    img.alt = "";
    img.draggable = false;
    container.appendChild(img);

    lastIndex = INLINE_IMAGE_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

/* ---------- 캐릭터 렌더링 ---------- */
function renderCharacter(index) {
  const c = characters[index];
  catchEl.textContent = c.catch;
  nameEl.textContent = c.name;
  metaEl.textContent = c.meta;

  syncBgm(c.bgm);

  const sectionNames = Object.keys(c.sections || {});

  tabsWrap.innerHTML = "";
  sectionsWrap.innerHTML = "";

  sectionNames.forEach((sectionName, i) => {
    const sectionEl = document.createElement("div");
    sectionEl.className = "char-section" + (i === 0 ? " active" : "");
    renderSectionText(sectionEl, c.sections[sectionName]);
    sectionsWrap.appendChild(sectionEl);

    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.className = "tab-btn" + (i === 0 ? " active" : "");
    tabBtn.textContent = sectionName;
    tabBtn.addEventListener("click", () => {
      [...tabsWrap.children].forEach((b) => b.classList.remove("active"));
      [...sectionsWrap.children].forEach((s) => s.classList.remove("active"));
      tabBtn.classList.add("active");
      sectionEl.classList.add("active");
    });
    tabsWrap.appendChild(tabBtn);
  });

  [...dotsWrap.children].forEach((dot, i) => dot.classList.toggle("active", i === index));

  panel.classList.remove("enter");
  void panel.offsetWidth;
  panel.classList.add("enter");

  imageWrap.classList.remove("enter");

  const targetSrc = c.image;

  const revealImage = () => {
    image.onload = null;
    image.onerror = null;
    void imageWrap.offsetWidth;
    imageWrap.classList.add("enter");
  };

  const alreadyLoaded = image.getAttribute("src") === targetSrc && image.complete;

  image.alt = c.name;

  if (alreadyLoaded) {
    revealImage();
  } else {
    image.onload = revealImage;
    image.onerror = revealImage;
    image.src = targetSrc;
  }
}

/* ---------- 캐릭터 데이터 로딩 (파일 개수는 유동적) ---------- */

const CHARACTER_FILES = ["characters1.json", "characters2.json", "characters3.json"];

function preloadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });
}

Promise.all([
  Promise.allSettled(
    CHARACTER_FILES.map((file) =>
      fetch(file, { cache: "no-cache" }).then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
    )
  ),
  fontsReadyPromise,
]).then(([results]) => {
  characters = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((c) => c && c.name && c.name.trim());

  characters.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", "캐릭터 " + (i + 1));
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  dotsWrap.hidden = characters.length < 2;

  const firstImage = characters[0] ? preloadImage(characters[0].image) : Promise.resolve();
  const restImages = Promise.all(characters.slice(1).map((c) => preloadImage(c.image)));

  restImages.catch(() => {});

  firstImage.then(playIntro);
});

/* ---------- 배경음악 (캐릭터별 YouTube 링크, 첫 클릭 시 자동 재생) ---------- */

let bgmPlayer = null;
let bgmReady = false;
let bgmApiRequested = false;
let currentBgmUrl = null;
let pendingVideoId = null;

function extractYoutubeId(url) {
  const match = url.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/);
  return match ? match[1] : null;
}

function createBgmPlayer(videoId) {
  window.onYouTubeIframeAPIReady = () => {
    bgmPlayer = new YT.Player("bgm-player", {
      videoId,
      playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: videoId },
      events: {
        onReady: () => {
          bgmReady = true;
          bgmPlayer.setVolume(Number(bgmVolume.value));
          if (pendingVideoId && pendingVideoId !== videoId) {
            bgmPlayer.loadVideoById(pendingVideoId);
          }
          pendingVideoId = null;
          attemptAutoplay();
        },
        onStateChange: (e) => {
          bgmBtn.classList.toggle("playing", e.data === YT.PlayerState.PLAYING);
          if (e.data === YT.PlayerState.ENDED) {
            bgmPlayer.seekTo(0);
            bgmPlayer.playVideo();
          }
        },
      },
    });
  };

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
}

function attemptAutoplay() {
  if (!bgmReady) return;
  bgmPlayer.playVideo();

  const unlock = () => {
    bgmPlayer.playVideo();
  };
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
}

function syncBgm(url) {
  if (!url || url === currentBgmUrl) return;
  currentBgmUrl = url;

  const videoId = extractYoutubeId(url);
  if (!videoId) return;

  if (!bgmApiRequested) {
    bgmApiRequested = true;
    createBgmPlayer(videoId);
  } else if (bgmReady) {
    bgmPlayer.loadVideoById(videoId);
  } else {
    pendingVideoId = videoId;
  }
}

bgmBtn.addEventListener("click", () => {
  if (!bgmPlayer) return;
  const state = bgmPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    bgmPlayer.pauseVideo();
  } else {
    bgmPlayer.playVideo();
  }
});

bgmVolume.addEventListener("input", () => {
  if (!bgmPlayer) return;
  bgmPlayer.setVolume(Number(bgmVolume.value));
});
