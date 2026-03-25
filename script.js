document.addEventListener("DOMContentLoaded", () => {
  const hero = document.getElementById("hero");
  const blackHole = document.getElementById("blackHole");
  const astronautLayer = document.getElementById("astronautLayer");
  const counterValue = document.getElementById("counterValue");
  const counterBox = document.querySelector(".hero-counter");
  const holeWord = document.getElementById("holeWord");
  const bgSound = document.getElementById("bgSound");

  const astroScreen = document.getElementById("astroScreen");
  const balloonsLayer = document.getElementById("balloonsLayer");

  const spiralStage = document.getElementById("spiralStage");
  const spiralImage = document.getElementById("spiralImage");

  let suckedCount = 0;
  let astronautId = 0;

  const astronauts = new Map();
  const balloons = [];

  const pointer = {
    active: false,
    pressed: false,
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    vx: 0,
    vy: 0,
    initialized: false,
  };

  const spiralState = {
    dragging: false,
    hoverActive: false,
    pointerId: null,

    rotation: 0,
    velocity: 0,

    lastPointerAngle: 0,
    hoverTargetVelocity: 0,

    centerX: 0,
    centerY: 0,
  };

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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep01(t) {
    const v = clamp(t, 0, 1);
    return v * v * (3 - 2 * v);
  }

  function shortestAngleDelta(a, b) {
    let delta = b - a;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function getHeroRect() {
    return hero.getBoundingClientRect();
  }

  function getBlackHoleRect() {
    return blackHole.getBoundingClientRect();
  }

  function getAstroRect() {
    return astroScreen.getBoundingClientRect();
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
      playPromise.catch(() => {});
    }
  }

  function unlockBackgroundSound() {
    if (!bgSound || !bgSound.paused) return;
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
      heroRect.width * (isMobile() ? 0.26 : 0.18),
      120,
      300,
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
      holeWord.style.top = "50%";
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

  function tickAstronauts() {
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

  function handleAstronautResize() {
    const heroRect = getHeroRect();

    astronauts.forEach((state) => {
      state.x = clamp(state.x, -100, heroRect.width + 100);
      state.y = clamp(state.y, -200, heroRect.height + 200);

      state.el.style.left = `${state.x}px`;
      state.el.style.top = `${state.y}px`;
    });
  }

  function createBalloonElement() {
    const balloon = document.createElement("div");
    balloon.className = "balloon";

    const visual = document.createElement("div");
    visual.className = "balloon-visual";

    const img = document.createElement("img");
    img.src = "шарик.svg";
    img.alt = "шарик";

    const string = document.createElement("div");
    string.className = "balloon-string";

    visual.appendChild(img);
    balloon.appendChild(visual);
    balloon.appendChild(string);

    return balloon;
  }

  function getBalloonPresets() {
    if (window.innerWidth <= 768) {
      return [
        {
          x: 0.18,
          y: 0.4,
          size: 250,
          string: 150,
          field: 1.18,
          follow: 0.05,
          settle: 0.02,
          drag: 0.9,
          floatX: 1.0,
          floatY: 2.0,
          rotAmp: 0.12,
          weight: 1.0,
        },
        {
          x: 0.62,
          y: 0.39,
          size: 265,
          string: 160,
          field: 1.18,
          follow: 0.048,
          settle: 0.019,
          drag: 0.9,
          floatX: 1.0,
          floatY: 2.0,
          rotAmp: 0.12,
          weight: 1.0,
        },
        {
          x: 0.88,
          y: 0.4,
          size: 270,
          string: 158,
          field: 1.18,
          follow: 0.048,
          settle: 0.019,
          drag: 0.9,
          floatX: 1.0,
          floatY: 2.0,
          rotAmp: 0.12,
          weight: 1.0,
        },
        {
          x: 0.09,
          y: 0.63,
          size: 225,
          string: 162,
          field: 1.08,
          follow: 0.056,
          settle: 0.022,
          drag: 0.895,
          floatX: 0.8,
          floatY: 1.6,
          rotAmp: 0.1,
          weight: 0.92,
        },
        {
          x: 0.36,
          y: 0.57,
          size: 245,
          string: 170,
          field: 1.1,
          follow: 0.054,
          settle: 0.021,
          drag: 0.895,
          floatX: 0.8,
          floatY: 1.6,
          rotAmp: 0.1,
          weight: 0.94,
        },
        {
          x: 0.75,
          y: 0.73,
          size: 235,
          string: 152,
          field: 1.14,
          follow: 0.06,
          settle: 0.024,
          drag: 0.89,
          floatX: 0.7,
          floatY: 1.4,
          rotAmp: 0.08,
          weight: 0.9,
        },
        {
          x: 0.18,
          y: 0.82,
          size: 228,
          string: 146,
          field: 1.14,
          follow: 0.06,
          settle: 0.024,
          drag: 0.89,
          floatX: 0.7,
          floatY: 1.4,
          rotAmp: 0.08,
          weight: 0.9,
        },
        {
          x: 0.53,
          y: 0.88,
          size: 220,
          string: 142,
          field: 1.12,
          follow: 0.062,
          settle: 0.025,
          drag: 0.888,
          floatX: 0.65,
          floatY: 1.3,
          rotAmp: 0.07,
          weight: 0.88,
        },
        {
          x: 0.89,
          y: 0.88,
          size: 224,
          string: 144,
          field: 1.12,
          follow: 0.062,
          settle: 0.025,
          drag: 0.888,
          floatX: 0.65,
          floatY: 1.3,
          rotAmp: 0.07,
          weight: 0.88,
        },
      ];
    }

    return [
      {
        x: 0.165,
        y: 0.4,
        size: 500,
        string: 350,
        field: 1.2,
        follow: 0.046,
        settle: 0.018,
        drag: 0.905,
        floatX: 1.4,
        floatY: 2.4,
        rotAmp: 0.1,
        weight: 1.0,
      },
      {
        x: 0.6,
        y: 0.39,
        size: 520,
        string: 362,
        field: 1.2,
        follow: 0.045,
        settle: 0.017,
        drag: 0.905,
        floatX: 1.4,
        floatY: 2.4,
        rotAmp: 0.1,
        weight: 1.0,
      },
      {
        x: 0.89,
        y: 0.4,
        size: 535,
        string: 356,
        field: 1.2,
        follow: 0.045,
        settle: 0.017,
        drag: 0.905,
        floatX: 1.4,
        floatY: 2.4,
        rotAmp: 0.1,
        weight: 1.0,
      },
      {
        x: 0.085,
        y: 0.63,
        size: 420,
        string: 315,
        field: 1.1,
        follow: 0.052,
        settle: 0.02,
        drag: 0.898,
        floatX: 1.1,
        floatY: 1.9,
        rotAmp: 0.085,
        weight: 0.94,
      },
      {
        x: 0.365,
        y: 0.57,
        size: 455,
        string: 326,
        field: 1.12,
        follow: 0.05,
        settle: 0.019,
        drag: 0.898,
        floatX: 1.1,
        floatY: 1.9,
        rotAmp: 0.085,
        weight: 0.95,
      },
      {
        x: 0.75,
        y: 0.73,
        size: 355,
        string: 255,
        field: 1.16,
        follow: 0.058,
        settle: 0.023,
        drag: 0.892,
        floatX: 0.95,
        floatY: 1.6,
        rotAmp: 0.07,
        weight: 0.9,
      },
      {
        x: 0.18,
        y: 0.82,
        size: 340,
        string: 242,
        field: 1.16,
        follow: 0.058,
        settle: 0.023,
        drag: 0.892,
        floatX: 0.95,
        floatY: 1.6,
        rotAmp: 0.07,
        weight: 0.9,
      },
      {
        x: 0.535,
        y: 0.9,
        size: 320,
        string: 228,
        field: 1.14,
        follow: 0.06,
        settle: 0.024,
        drag: 0.89,
        floatX: 0.85,
        floatY: 1.45,
        rotAmp: 0.06,
        weight: 0.88,
      },
      {
        x: 0.89,
        y: 0.9,
        size: 326,
        string: 232,
        field: 1.14,
        follow: 0.06,
        settle: 0.024,
        drag: 0.89,
        floatX: 0.85,
        floatY: 1.45,
        rotAmp: 0.06,
        weight: 0.88,
      },
    ];
  }

  function updateBalloonView(state) {
    state.el.style.left = `${state.baseX}px`;
    state.el.style.top = `${state.baseY}px`;
    state.el.style.width = `${state.size}px`;
    state.el.style.zIndex = String(state.z);

    const floatX = Math.sin(state.phase + state.phaseOffset) * state.floatAmpX;
    const floatY =
      Math.cos(state.phase * 0.82 + state.phaseOffset) * state.floatAmpY;

    const totalX = state.offsetX + floatX;
    const totalY = state.offsetY + floatY;

    state.el.style.transform = `translate(-50%, -50%) translate(${totalX}px, ${totalY}px) rotate(${state.rotation}deg)`;
  }

  function createBalloonState(preset, index) {
    const rect = getAstroRect();
    const el = createBalloonElement();

    const state = {
      el,
      baseX: rect.width * preset.x,
      baseY: rect.height * preset.y,
      size: preset.size,
      string: preset.string,
      field: preset.field,
      follow: preset.follow,
      settle: preset.settle,
      drag: preset.drag,
      floatAmpX: preset.floatX,
      floatAmpY: preset.floatY,
      rotAmp: preset.rotAmp,
      weight: preset.weight,
      phase: randomBetween(0, Math.PI * 2),
      phaseOffset: randomBetween(0, Math.PI * 2),
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      vx: 0,
      vy: 0,
      targetX: 0,
      targetY: 0,
      z: 10 + index,
    };

    const string = el.querySelector(".balloon-string");
    string.style.height = `${preset.string}px`;

    balloonsLayer.appendChild(el);
    balloons.push(state);
    updateBalloonView(state);
  }

  function initBalloons() {
    balloons.length = 0;
    balloonsLayer.innerHTML = "";

    const presets = getBalloonPresets();
    presets.forEach((preset, index) => createBalloonState(preset, index));
  }

  function updatePointerPosition(clientX, clientY) {
    const rect = getAstroRect();
    pointer.active = true;
    pointer.tx = clientX - rect.left;
    pointer.ty = clientY - rect.top;

    if (!pointer.initialized) {
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
      pointer.initialized = true;
    }
  }

  function clearPointer() {
    pointer.active = false;
    pointer.pressed = false;
  }

  astroScreen.addEventListener("pointermove", (e) => {
    updatePointerPosition(e.clientX, e.clientY);
  });

  astroScreen.addEventListener("pointerdown", (e) => {
    updatePointerPosition(e.clientX, e.clientY);
    pointer.pressed = true;
    unlockBackgroundSound();
  });

  astroScreen.addEventListener("pointerup", () => {
    pointer.pressed = false;
  });

  astroScreen.addEventListener("pointerleave", clearPointer);
  astroScreen.addEventListener("pointercancel", clearPointer);

  function tickPointer() {
    if (!pointer.initialized) return;

    const targetX = pointer.active ? pointer.tx : pointer.x;
    const targetY = pointer.active ? pointer.ty : pointer.y;

    pointer.vx += (targetX - pointer.x) * 0.08;
    pointer.vy += (targetY - pointer.y) * 0.08;

    pointer.vx *= 0.74;
    pointer.vy *= 0.74;

    pointer.x += pointer.vx;
    pointer.y += pointer.vy;
  }

  function applySoftBalloonCoupling() {
    for (let i = 0; i < balloons.length; i += 1) {
      const a = balloons[i];

      for (let j = i + 1; j < balloons.length; j += 1) {
        const b = balloons[j];

        const ax = a.baseX + a.offsetX;
        const ay = a.baseY + a.offsetY;
        const bx = b.baseX + b.offsetX;
        const by = b.baseY + b.offsetY;

        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const minDist = a.size * 0.14 + b.size * 0.14;

        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.012;
          const nx = dx / dist;
          const ny = dy / dist;

          a.vx -= nx * overlap * a.weight;
          a.vy -= ny * overlap * a.weight;
          b.vx += nx * overlap * b.weight;
          b.vy += ny * overlap * b.weight;
        }
      }
    }
  }

  function tickBalloons() {
    tickPointer();

    const baseRadius = isMobile() ? 190 : 300;
    const baseStrength = pointer.pressed
      ? isMobile()
        ? 34
        : 92
      : isMobile()
        ? 16
        : 42;

    balloons.forEach((balloon) => {
      let influenceX = 0;
      let influenceY = 0;

      if (pointer.active) {
        const dx = balloon.baseX - pointer.x;
        const dy = balloon.baseY - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const radius = baseRadius * balloon.field;

        if (dist < radius) {
          const t = 1 - dist / radius;
          const eased = smoothstep01(t) ** 1.6;
          const strength = baseStrength * eased;

          const dirX = dx / dist;
          const dirY = dy / dist;

          influenceX = dirX * strength;
          influenceY = dirY * strength * 0.92;
        }
      }

      balloon.targetX = lerp(balloon.targetX, influenceX, balloon.follow);
      balloon.targetY = lerp(balloon.targetY, influenceY, balloon.follow);

      balloon.vx += (balloon.targetX - balloon.offsetX) * balloon.settle;
      balloon.vy += (balloon.targetY - balloon.offsetY) * balloon.settle;

      balloon.vx *= balloon.drag;
      balloon.vy *= balloon.drag;

      balloon.offsetX += balloon.vx;
      balloon.offsetY += balloon.vy;

      balloon.phase += 0.009;
      balloon.rotation =
        Math.sin(balloon.phase * 0.68 + balloon.phaseOffset) * balloon.rotAmp;
    });

    applySoftBalloonCoupling();

    balloons.forEach((balloon) => {
      updateBalloonView(balloon);
    });
  }

  function handleBalloonResize() {
    const presets = getBalloonPresets();
    const rect = getAstroRect();

    balloons.forEach((balloon, index) => {
      const preset = presets[index];
      if (!preset) return;

      balloon.baseX = rect.width * preset.x;
      balloon.baseY = rect.height * preset.y;
      balloon.size = preset.size;
      balloon.field = preset.field;
      balloon.follow = preset.follow;
      balloon.settle = preset.settle;
      balloon.drag = preset.drag;
      balloon.floatAmpX = preset.floatX;
      balloon.floatAmpY = preset.floatY;
      balloon.rotAmp = preset.rotAmp;
      balloon.weight = preset.weight;

      const string = balloon.el.querySelector(".balloon-string");
      string.style.height = `${preset.string}px`;
    });
  }

  function updateSpiralCenter() {
    const rect = spiralImage.getBoundingClientRect();
    spiralState.centerX = rect.left + rect.width / 2;
    spiralState.centerY = rect.top + rect.height / 2;
  }

  function getPointerAngle(clientX, clientY) {
    const dx = clientX - spiralState.centerX;
    const dy = clientY - spiralState.centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  function updateSpiralTransform() {
    spiralImage.style.transform = `translate(-50%, -50%) rotate(${spiralState.rotation}deg)`;
  }

  function handleSpiralPointerDown(e) {
    unlockBackgroundSound();
    updateSpiralCenter();

    spiralState.dragging = true;
    spiralState.hoverActive = true;
    spiralState.pointerId = e.pointerId;
    spiralState.lastPointerAngle = getPointerAngle(e.clientX, e.clientY);

    if (spiralStage.setPointerCapture) {
      spiralStage.setPointerCapture(e.pointerId);
    }
  }

  function handleSpiralPointerMove(e) {
    updateSpiralCenter();

    const currentAngle = getPointerAngle(e.clientX, e.clientY);

    if (spiralState.dragging && spiralState.pointerId === e.pointerId) {
      const delta = shortestAngleDelta(
        spiralState.lastPointerAngle,
        currentAngle,
      );

      spiralState.rotation += delta;
      spiralState.velocity = delta * 0.55;
      spiralState.lastPointerAngle = currentAngle;
      return;
    }

    const dx = e.clientX - spiralState.centerX;
    const dy = e.clientY - spiralState.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.42;
    const influence = clamp(distance / maxRadius, 0, 1);
    const side = dx >= 0 ? 1 : -1;

    spiralState.hoverActive = true;
    spiralState.hoverTargetVelocity = side * (0.18 + influence * 1.35);
  }

  function handleSpiralPointerUp(e) {
    if (spiralState.pointerId !== e.pointerId) return;

    spiralState.dragging = false;
    spiralState.pointerId = null;
  }

  function handleSpiralPointerLeave() {
    spiralState.hoverActive = false;
    spiralState.hoverTargetVelocity = 0;

    if (!spiralState.dragging) {
      spiralState.pointerId = null;
    }
  }

  function tickSpiral() {
    if (!spiralState.dragging) {
      const target = spiralState.hoverActive
        ? spiralState.hoverTargetVelocity
        : 0;
      spiralState.velocity = lerp(spiralState.velocity, target, 0.05);
      spiralState.velocity *= 0.985;
      spiralState.rotation += spiralState.velocity;
    } else {
      spiralState.velocity *= 0.96;
    }

    updateSpiralTransform();
  }

  spiralStage.addEventListener("pointerdown", handleSpiralPointerDown);
  spiralStage.addEventListener("pointermove", handleSpiralPointerMove);
  spiralStage.addEventListener("pointerup", handleSpiralPointerUp);
  spiralStage.addEventListener("pointercancel", handleSpiralPointerUp);
  spiralStage.addEventListener("pointerleave", handleSpiralPointerLeave);

  function masterTick() {
    tickAstronauts();
    tickBalloons();
    tickSpiral();
    requestAnimationFrame(masterTick);
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
  initBalloons();
  updateSpiralCenter();
  updateSpiralTransform();
  masterTick();

  setInterval(maintainPopulation, 1600);

  window.addEventListener("resize", () => {
    handleAstronautResize();
    handleBalloonResize();
    updateSpiralCenter();
  });
});
