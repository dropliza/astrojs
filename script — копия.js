document.addEventListener("DOMContentLoaded", () => {
  const hero = document.getElementById("hero");
  const blackHole = document.getElementById("blackHole");
  const astronautLayer = document.getElementById("astronautLayer");
  const counterValue = document.getElementById("counterValue");
  const counterBox = document.querySelector(".hero-counter");
  const holeWord = document.getElementById("holeWord");
  const bgSound = document.getElementById("bgSound");

  let suckedCount = 0;
  let astronautId = 0;
  const astronauts = new Map();

  const settings = {
    desktop: {
      initialCount: 7,
      maxCount: 9,
    },
    mobile: {
      initialCount: 4,
      maxCount: 5,
    },
  };

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function getLimits() {
    return isMobile() ? settings.mobile : settings.desktop;
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getHeroRect() {
    return hero.getBoundingClientRect();
  }

  function getBlackHoleRect() {
    return blackHole.getBoundingClientRect();
  }

  function getElementCenter(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function getBlackHoleCenterInsideHero() {
    const holeRect = getBlackHoleRect();
    const heroRect = getHeroRect();

    return {
      x: holeRect.left + holeRect.width / 2 - heroRect.left,
      y: holeRect.top + holeRect.height / 2 - heroRect.top,
    };
  }

  function updateCounter() {
    counterValue.textContent = suckedCount;
    counterBox.classList.remove("counter-bump");
    void counterBox.offsetWidth;
    counterBox.classList.add("counter-bump");
  }

  function tryPlayBackgroundSound() {
    if (!bgSound) return;

    bgSound.volume = 0.45;

    const playPromise = bgSound.play();

    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => {
        /* браузер мог заблокировать autoplay */
      });
    }
  }

  function unlockBackgroundSound() {
    if (!bgSound) return;
    if (!bgSound.paused) return;

    tryPlayBackgroundSound();
  }

  function isOverBlackHole(el, factor = 0.38) {
    const center = getElementCenter(el);
    const holeRect = getBlackHoleRect();

    const holeCenterX = holeRect.left + holeRect.width / 2;
    const holeCenterY = holeRect.top + holeRect.height / 2;

    const dx = center.x - holeCenterX;
    const dy = center.y - holeCenterY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const holeRadius = holeRect.width * factor;

    return distance <= holeRadius;
  }

  function createAstronautElement() {
    const astronaut = document.createElement("div");
    astronaut.className = "astronaut";

    const img = document.createElement("img");
    img.src = "astronaut1.svg";
    img.alt = "astronaut";

    astronaut.appendChild(img);
    astronaut.draggable = false;

    return astronaut;
  }

  function spawnAstronaut() {
    const heroRect = getHeroRect();
    const el = createAstronautElement();
    const id = ++astronautId;

    const sizeGuess = clamp(
      heroRect.width * (isMobile() ? 0.18 : 0.11),
      84,
      210,
    );

    const startX = randomBetween(
      sizeGuess * 0.6,
      heroRect.width - sizeGuess * 0.6,
    );

    const startY = -sizeGuess;
    const driftX = randomBetween(-0.22, 0.22);
    const speedY = randomBetween(
      isMobile() ? 0.42 : 0.38,
      isMobile() ? 0.86 : 0.74,
    );
    const rotation = randomBetween(-26, 26);
    const rotationSpeed = randomBetween(-0.35, 0.35);

    const state = {
      id,
      el,
      x: startX,
      y: startY,
      driftX,
      speedY,
      currentRotation: rotation,
      rotationSpeed,
      dragging: false,
      sucked: false,
      pointerId: null,
      offsetX: 0,
      offsetY: 0,
    };

    el.style.left = `${state.x}px`;
    el.style.top = `${state.y}px`;
    el.style.setProperty("--start-rotate", `${state.currentRotation}deg`);
    el.style.transform = `translate(-50%, -50%) rotate(${state.currentRotation}deg)`;

    astronautLayer.appendChild(el);
    astronauts.set(id, state);

    attachAstronautDrag(state);
  }

  function attachAstronautDrag(state) {
    const { el } = state;

    el.addEventListener("pointerdown", (e) => {
      unlockBackgroundSound();

      if (state.sucked) return;

      state.dragging = true;
      state.pointerId = e.pointerId;
      el.classList.add("dragging");

      const heroRect = getHeroRect();
      state.offsetX = e.clientX - heroRect.left - state.x;
      state.offsetY = e.clientY - heroRect.top - state.y;

      if (el.setPointerCapture) {
        el.setPointerCapture(e.pointerId);
      }
    });

    el.addEventListener("pointermove", (e) => {
      if (!state.dragging || state.pointerId !== e.pointerId || state.sucked) {
        return;
      }

      const heroRect = getHeroRect();
      state.x = e.clientX - heroRect.left - state.offsetX;
      state.y = e.clientY - heroRect.top - state.offsetY;

      el.style.left = `${state.x}px`;
      el.style.top = `${state.y}px`;
    });

    const finishDrag = (e) => {
      if (!state.dragging || state.pointerId !== e.pointerId || state.sucked) {
        return;
      }

      state.dragging = false;
      el.classList.remove("dragging");

      if (isOverBlackHole(el, 0.39)) {
        suckAstronaut(state);
      }
    };

    el.addEventListener("pointerup", finishDrag);
    el.addEventListener("pointercancel", finishDrag);
    el.addEventListener("dragstart", (e) => e.preventDefault());
  }

  function suckAstronaut(state) {
    const { el } = state;
    const center = getBlackHoleCenterInsideHero();

    state.sucked = true;

    el.style.left = `${state.x}px`;
    el.style.top = `${state.y}px`;
    el.style.setProperty("--hole-x", `${center.x}px`);
    el.style.setProperty("--hole-y", `${center.y}px`);
    el.style.setProperty("--start-rotate", `${state.currentRotation}deg`);
    el.classList.add("sucking");

    suckedCount += 1;
    updateCounter();

    window.setTimeout(() => {
      astronauts.delete(state.id);
      el.remove();

      const limits = getLimits();
      if (astronauts.size < limits.maxCount) {
        spawnAstronaut();
      }
    }, 900);
  }

  function attachHoleWordDrag() {
    const wordState = {
      dragging: false,
      sucked: false,
      pointerId: null,
      x: 0,
      y: 0,
      offsetX: 0,
      offsetY: 0,
    };

    function setWordToDefaultPosition() {
      holeWord.style.left = "50%";
      holeWord.style.top = "55%";
      holeWord.style.transform = "translate(-50%, -50%)";
    }

    function fixCurrentWordPosition() {
      const heroRect = getHeroRect();
      const rect = holeWord.getBoundingClientRect();

      wordState.x = rect.left + rect.width / 2 - heroRect.left;
      wordState.y = rect.top + rect.height / 2 - heroRect.top;

      holeWord.style.left = `${wordState.x}px`;
      holeWord.style.top = `${wordState.y}px`;
      holeWord.style.transform = "translate(-50%, -50%)";
    }

    holeWord.addEventListener("pointerdown", (e) => {
      unlockBackgroundSound();

      if (wordState.sucked) return;

      fixCurrentWordPosition();

      wordState.dragging = true;
      wordState.pointerId = e.pointerId;
      holeWord.classList.add("dragging");

      const heroRect = getHeroRect();
      wordState.offsetX = e.clientX - heroRect.left - wordState.x;
      wordState.offsetY = e.clientY - heroRect.top - wordState.y;

      if (holeWord.setPointerCapture) {
        holeWord.setPointerCapture(e.pointerId);
      }
    });

    holeWord.addEventListener("pointermove", (e) => {
      if (
        !wordState.dragging ||
        wordState.pointerId !== e.pointerId ||
        wordState.sucked
      ) {
        return;
      }

      const heroRect = getHeroRect();
      wordState.x = e.clientX - heroRect.left - wordState.offsetX;
      wordState.y = e.clientY - heroRect.top - wordState.offsetY;

      holeWord.style.left = `${wordState.x}px`;
      holeWord.style.top = `${wordState.y}px`;
      holeWord.style.transform = "translate(-50%, -50%)";
    });

    const finishWordDrag = (e) => {
      if (
        !wordState.dragging ||
        wordState.pointerId !== e.pointerId ||
        wordState.sucked
      ) {
        return;
      }

      wordState.dragging = false;
      holeWord.classList.remove("dragging");

      if (isOverBlackHole(holeWord, 0.34)) {
        suckHoleWord(wordState);
      } else {
        setWordToDefaultPosition();
      }
    };

    holeWord.addEventListener("pointerup", finishWordDrag);
    holeWord.addEventListener("pointercancel", finishWordDrag);
    holeWord.addEventListener("dragstart", (e) => e.preventDefault());

    setWordToDefaultPosition();
  }

  function suckHoleWord(wordState) {
    const center = getBlackHoleCenterInsideHero();
    wordState.sucked = true;

    holeWord.style.setProperty("--hole-x", `${center.x}px`);
    holeWord.style.setProperty("--hole-y", `${center.y}px`);
    holeWord.classList.add("sucking");

    window.setTimeout(() => {
      holeWord.remove();
    }, 950);
  }

  function tick() {
    const heroRect = getHeroRect();

    astronauts.forEach((state) => {
      if (state.dragging || state.sucked) return;

      state.y += state.speedY;
      state.x += state.driftX;
      state.currentRotation += state.rotationSpeed;

      if (state.x < -80) state.x = heroRect.width + 80;
      if (state.x > heroRect.width + 80) state.x = -80;

      state.el.style.left = `${state.x}px`;
      state.el.style.top = `${state.y}px`;
      state.el.style.transform = `translate(-50%, -50%) rotate(${state.currentRotation}deg)`;

      if (state.y - 160 > heroRect.height) {
        state.el.remove();
        astronauts.delete(state.id);
        spawnAstronaut();
      }
    });

    requestAnimationFrame(tick);
  }

  function fillInitialAstronauts() {
    const limits = getLimits();

    for (let i = 0; i < limits.initialCount; i += 1) {
      spawnAstronaut();
    }
  }

  function maintainPopulation() {
    const limits = getLimits();

    while (astronauts.size < limits.maxCount) {
      spawnAstronaut();
    }
  }

  function handleResize() {
    const heroRect = getHeroRect();

    astronauts.forEach((state) => {
      state.x = clamp(state.x, -100, heroRect.width + 100);
      state.y = clamp(state.y, -200, heroRect.height + 200);

      state.el.style.left = `${state.x}px`;
      state.el.style.top = `${state.y}px`;
    });
  }

  tryPlayBackgroundSound();

  window.addEventListener("pointerdown", unlockBackgroundSound, {
    passive: true,
  });
  window.addEventListener("touchstart", unlockBackgroundSound, {
    passive: true,
  });
  window.addEventListener("keydown", unlockBackgroundSound);

  fillInitialAstronauts();
  attachHoleWordDrag();
  tick();

  setInterval(maintainPopulation, 1600);
  window.addEventListener("resize", handleResize);
});
