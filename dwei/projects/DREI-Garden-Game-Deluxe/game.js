(() => {
  "use strict";

  const SAVE_KEY = "dreiGardenSaveV1";
  const WELCOME_KEY = "dreiGardenTutorialV2";
  const ENERGY_RECHARGE_MS = 12_000;
  const MAX_PLOTS = 16;

  const crops = {
    tomato: {
      name: "Tomato", cost: 6, sell: 16, growthMs: 8_000,
      stages: ["02_seed", "03_sprout", "04_young", "05_growing", "06_flowering", "07_fruiting", "08_mature"]
    },
    carrot: {
      name: "Carrot", cost: 4, sell: 11, growthMs: 7_000,
      stages: ["02_seed", "03_sprout", "04_young", "05_growing", "06_flowering", "07_fruiting", "08_mature"]
    },
    sunflower: {
      name: "Sunflower", cost: 8, sell: 20, growthMs: 10_000,
      stages: ["02_seed", "03_sprout", "04_young", "05_growing", "06_flowering", "07_fruiting", "08_mature"]
    },
    pumpkin: {
      name: "Pumpkin", cost: 12, sell: 30, growthMs: 12_000,
      stages: ["02_seed", "03_sprout", "04_young", "05_growing", "06_flowering", "07_fruiting", "08_mature"]
    }
  };

  const weatherData = {
    sunny: { label: "Sunny", icon: "assets/weather/sunny.png" },
    cloudy: { label: "Cloudy", icon: "assets/weather/cloudy.png" },
    rainy: { label: "Rainy", icon: "assets/weather/rainy.png" },
    night: { label: "Cool Night", icon: "assets/weather/night.png" }
  };

  const toolCopy = {
    plant: ["Plant tool selected.", "Choose a seed, then tap an empty plot."],
    water: ["Watering can selected.", "Tap a dry growing crop to water it."],
    harvest: ["Harvest basket selected.", "Tap a glowing mature crop to collect it."],
    info: ["Inspect tool selected.", "Tap any plot to view detailed information."]
  };

  const tutorialSteps = [
    {
      title: "Choose what to grow",
      text: "Pick Tomato, Carrot, Sunflower, or Pumpkin from your seed bag.",
      image: "assets/tools/seed_bag.png"
    },
    {
      title: "Plant and water",
      text: "Select the Plant tool for empty soil. Select Water whenever a crop becomes dry.",
      image: "assets/tools/watering_can.png"
    },
    {
      title: "Watch every stage grow",
      text: "Watered crops grow with time. You can also end the day to advance all watered crops.",
      image: "assets/crops/tomato/06_flowering.png"
    },
    {
      title: "Harvest, earn, repeat",
      text: "Mature plots glow green. Harvest them for coins, then buy better seeds in the shop.",
      image: "assets/tools/harvest_basket.png"
    }
  ];

  const $ = (selector) => document.querySelector(selector);
  const garden = $("#garden");
  const field = $("#field");
  const effectLayer = $("#effectLayer");
  const weatherLayer = $("#weatherLayer");
  const seedList = $("#seedList");
  const shopGrid = $("#shopGrid");
  const coinsValue = $("#coinsValue");
  const energyValue = $("#energyValue");
  const dayValue = $("#dayValue");
  const weatherValue = $("#weatherValue");
  const weatherIcon = $("#weatherIcon");
  const harvestValue = $("#harvestValue");
  const earnedValue = $("#earnedValue");
  const energyTimer = $("#energyTimer");
  const energyMeter = $("#energyMeter");
  const farmerStage = $("#farmerStage");
  const farmerSprite = $("#farmerSprite");
  const actionBubble = $("#actionBubble");
  const shopModal = $("#shopModal");
  const welcomeModal = $("#welcomeModal");
  const toastStack = $("#toastStack");
  const soundBtn = $("#soundBtn");
  const dayTransition = $("#dayTransition");

  let state = loadState();
  let activeTool = "plant";
  let selectedPlot = null;
  let soundEnabled = true;
  let actionTimer = 0;
  let farmerFrameTimer = 0;
  let audioContext = null;
  let tutorialIndex = 0;
  let dayChanging = false;

  function freshState() {
    return {
      coins: 35,
      energy: 20,
      maxEnergy: 20,
      lastEnergyAt: Date.now(),
      selectedSeed: "tomato",
      inventory: { tomato: 4, carrot: 5, sunflower: 2, pumpkin: 1 },
      plots: Array.from({ length: MAX_PLOTS }, () => emptyPlot()),
      day: 1,
      weather: "sunny",
      stats: { harvested: 0, earned: 0 },
      lastSavedAt: Date.now()
    };
  }

  function emptyPlot() {
    return { crop: null, stage: 0, watered: false, nextGrowthAt: 0 };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      const base = freshState();
      return {
        ...base,
        ...parsed,
        inventory: { ...base.inventory, ...(parsed.inventory || {}) },
        stats: { ...base.stats, ...(parsed.stats || {}) },
        plots: Array.from({ length: MAX_PLOTS }, (_, i) => ({ ...emptyPlot(), ...(parsed.plots?.[i] || {}) }))
      };
    } catch (error) {
      console.warn("Could not load save:", error);
      return freshState();
    }
  }

  function saveState() {
    state.lastSavedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Could not save:", error);
    }
  }

  function cropImage(cropKey, stageIndex) {
    const crop = crops[cropKey];
    const stageFile = crop.stages[Math.max(0, Math.min(stageIndex - 1, crop.stages.length - 1))];
    return `assets/crops/${cropKey}/${stageFile}.png`;
  }

  function isReady(plot) {
    return Boolean(plot.crop) && plot.stage >= crops[plot.crop].stages.length;
  }

  function useEnergy(amount) {
    updateEnergy();
    if (state.energy < amount) {
      toast("Not enough energy. End the day or wait for it to recharge.", "warn");
      playSound("error");
      return false;
    }
    state.energy -= amount;
    if (state.energy < state.maxEnergy && !state.lastEnergyAt) state.lastEnergyAt = Date.now();
    return true;
  }

  function updateEnergy() {
    if (state.energy >= state.maxEnergy) {
      state.energy = state.maxEnergy;
      state.lastEnergyAt = Date.now();
      return;
    }
    const now = Date.now();
    const elapsed = now - state.lastEnergyAt;
    if (elapsed >= ENERGY_RECHARGE_MS) {
      const gained = Math.floor(elapsed / ENERGY_RECHARGE_MS);
      state.energy = Math.min(state.maxEnergy, state.energy + gained);
      state.lastEnergyAt += gained * ENERGY_RECHARGE_MS;
    }
  }

  function renderAll() {
    updateEnergy();
    renderHeader();
    renderSeeds();
    renderGarden();
    renderProgress();
    renderShop();
    renderToolbar();
    renderInspector();
    renderWeather();
    updateFieldMessage();
  }

  function renderHeader() {
    coinsValue.textContent = state.coins;
    energyValue.textContent = `${state.energy}/${state.maxEnergy}`;
    dayValue.textContent = `Day ${state.day}`;
    const weather = weatherData[state.weather] || weatherData.sunny;
    weatherValue.textContent = weather.label;
    weatherIcon.src = weather.icon;
    weatherIcon.alt = weather.label;
  }

  function renderWeather() {
    field.classList.remove("weather-sunny", "weather-cloudy", "weather-rainy", "weather-night");
    field.classList.add(`weather-${state.weather}`);
    weatherLayer.className = "weather-layer";
    if (state.weather === "rainy") weatherLayer.classList.add("rain");
    if (state.weather === "cloudy") weatherLayer.classList.add("clouds");
    if (state.weather === "night") weatherLayer.classList.add("night");
  }

  function renderSeeds() {
    seedList.innerHTML = "";
    Object.entries(crops).forEach(([key, crop]) => {
      const count = state.inventory[key] || 0;
      const button = document.createElement("button");
      button.className = `seed-card${state.selectedSeed === key ? " selected" : ""}${count < 1 ? " sold-out" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <img src="assets/crops/${key}/09_harvest.png" alt="${crop.name}">
        <div><strong>${crop.name}</strong><span>Sells for ${crop.sell} coins</span></div>
        <b class="seed-count">×${count}</b>`;
      button.addEventListener("click", () => {
        state.selectedSeed = key;
        activeTool = "plant";
        saveState();
        renderSeeds();
        renderToolbar();
        updateFieldMessage();
        toast(`${crop.name} selected. Plant tool is ready.`, "good");
        playSound("select");
      });
      seedList.appendChild(button);
    });
  }

  function renderGarden() {
    garden.innerHTML = "";
    state.plots.forEach((plot, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const dryClass = plot.crop && !plot.watered && !isReady(plot) ? " dry" : "";
      button.className = `plot${plot.watered ? " watered" : ""}${isReady(plot) ? " ready" : ""}${selectedPlot === index ? " selected" : ""}${dryClass}`;
      button.dataset.index = index;
      button.setAttribute("aria-label", plot.crop ? `${crops[plot.crop].name} plot` : "Empty garden plot");

      if (plot.crop) {
        const stageCount = crops[plot.crop].stages.length;
        const progress = plot.watered && plot.nextGrowthAt
          ? Math.max(0, Math.min(100, 100 - ((plot.nextGrowthAt - Date.now()) / crops[plot.crop].growthMs) * 100))
          : 0;
        button.innerHTML = `
          <img class="crop-img" src="${cropImage(plot.crop, plot.stage)}" alt="${crops[plot.crop].name}">
          <span class="plot-state">${plot.stage}/${stageCount}</span>
          ${plot.watered && !isReady(plot) ? `<span class="water-drop">💧</span><span class="timer-ring"><i style="width:${progress}%"></i></span>` : ""}
          ${isReady(plot) ? `<span class="ready-label">HARVEST</span>` : ""}`;
      } else {
        button.innerHTML = `<span class="plot-state">＋</span>`;
      }

      button.addEventListener("click", () => handlePlotClick(index));
      garden.appendChild(button);
    });
    renderSelectedHud();
  }

  function renderSelectedHud() {
    const hud = $("#selectedHud");
    if (selectedPlot === null) {
      hud.hidden = true;
      return;
    }
    const plot = state.plots[selectedPlot];
    hud.hidden = false;
    $("#selectedHudLabel").textContent = `Plot ${selectedPlot + 1}`;
    if (!plot.crop) {
      $("#selectedHudTitle").textContent = "Empty soil — ready to plant";
    } else if (isReady(plot)) {
      $("#selectedHudTitle").textContent = `${crops[plot.crop].name} — ready to harvest`;
    } else if (plot.watered) {
      $("#selectedHudTitle").textContent = `${crops[plot.crop].name} — growing`;
    } else {
      $("#selectedHudTitle").textContent = `${crops[plot.crop].name} — needs water`;
    }
  }

  function renderToolbar() {
    document.querySelectorAll(".tool-btn[data-tool]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.tool === activeTool);
      button.setAttribute("aria-pressed", String(button.dataset.tool === activeTool));
    });
  }

  function updateFieldMessage() {
    const [title, text] = toolCopy[activeTool] || toolCopy.plant;
    $("#fieldMessageTitle").textContent = title;
    $("#fieldMessageText").textContent = text;
  }

  function selectPlot(index) {
    selectedPlot = index;
    renderGarden();
    renderInspector();
  }

  function handlePlotClick(index) {
    selectPlot(index);
    if (activeTool === "info") {
      openInfoSheet();
      playSound("select");
      return;
    }
    if (activeTool === "plant") return plantCrop(index);
    if (activeTool === "water") return waterCrop(index);
    if (activeTool === "harvest") return harvestCrop(index);
  }

  function plantCrop(index) {
    const plot = state.plots[index];
    const key = state.selectedSeed;
    const crop = crops[key];
    if (plot.crop) {
      toast("That plot is already occupied. Use Water, Harvest, or Inspect.", "warn");
      playSound("error");
      return;
    }
    if ((state.inventory[key] || 0) < 1) {
      toast(`You are out of ${crop.name} seeds. Open the Seed Shop.`, "warn");
      openShop();
      return;
    }
    if (!useEnergy(1)) return;

    state.inventory[key] -= 1;
    state.plots[index] = { crop: key, stage: 1, watered: false, nextGrowthAt: 0 };
    saveState();
    renderAll();
    animatePlot(index, "dirt", "action-pop");
    moveFarmerToPlot(index, `Planted ${crop.name}!`, "dig");
    toast(`${crop.name} planted. Select Water when you are ready.`, "good");
    playSound("plant");
  }

  function waterCrop(index) {
    const plot = state.plots[index];
    if (!plot.crop) {
      toast("There is no crop here. Select Plant first.", "warn");
      playSound("error");
      return;
    }
    if (isReady(plot)) {
      toast("This crop is mature. Select Harvest.", "warn");
      return;
    }
    if (plot.watered) {
      const seconds = Math.max(1, Math.ceil((plot.nextGrowthAt - Date.now()) / 1000));
      toast(`${crops[plot.crop].name} is already watered — ${seconds}s remaining.`, "warn");
      return;
    }
    if (!useEnergy(1)) return;

    plot.watered = true;
    plot.nextGrowthAt = Date.now() + crops[plot.crop].growthMs;
    saveState();
    renderAll();
    animatePlot(index, "water", "action-pop");
    moveFarmerToPlot(index, "Watered!", "water");
    toast(`${crops[plot.crop].name} is growing now.`, "good");
    playSound("water");
  }

  function harvestCrop(index) {
    const plot = state.plots[index];
    if (!plot.crop) {
      toast("There is nothing to harvest here.", "warn");
      playSound("error");
      return;
    }
    if (!isReady(plot)) {
      toast(`${crops[plot.crop].name} is not mature yet.`, "warn");
      playSound("error");
      return;
    }
    if (!useEnergy(1)) return;

    const cropKey = plot.crop;
    const crop = crops[cropKey];
    const startRect = getPlotRect(index);
    const cropSrc = `assets/crops/${cropKey}/09_harvest.png`;
    state.coins += crop.sell;
    state.stats.harvested += 1;
    state.stats.earned += crop.sell;
    state.plots[index] = emptyPlot();
    saveState();
    renderAll();
    flyToCoins(cropSrc, startRect);
    animatePlot(index, "leaf", "action-pop");
    moveFarmerToPlot(index, `+${crop.sell} coins!`, "harvest");
    bump($("#coinChip"));
    toast(`${crop.name} harvested for ${crop.sell} coins!`, "good");
    playSound("harvest");
  }

  function processGrowth() {
    updateEnergy();
    const now = Date.now();
    const grewIndices = [];

    state.plots.forEach((plot, index) => {
      if (!plot.crop || !plot.watered || !plot.nextGrowthAt || isReady(plot)) return;
      if (now >= plot.nextGrowthAt) {
        plot.stage += 1;
        plot.watered = false;
        plot.nextGrowthAt = 0;
        grewIndices.push(index);
      }
    });

    if (grewIndices.length) {
      saveState();
      renderAll();
      grewIndices.forEach((index, position) => {
        setTimeout(() => animatePlot(index, "leaf", "grow-pop"), position * 90);
      });
      toast(`${grewIndices.length === 1 ? "A crop has" : `${grewIndices.length} crops have`} grown! Water the new stage.`, "good");
      playSound("grow");
    } else {
      renderHeader();
      renderProgress();
      updateLivePlotTimers();
      renderInspector();
    }
  }

  function updateLivePlotTimers() {
    const now = Date.now();
    state.plots.forEach((plot, index) => {
      if (!plot.crop || !plot.watered || !plot.nextGrowthAt || isReady(plot)) return;
      const bar = garden.querySelector(`[data-index="${index}"] .timer-ring i`);
      if (!bar) return;
      const progress = Math.max(0, Math.min(100, 100 - ((plot.nextGrowthAt - now) / crops[plot.crop].growthMs) * 100));
      bar.style.width = `${progress}%`;
    });
  }

  function renderProgress() {
    harvestValue.textContent = state.stats.harvested;
    earnedValue.textContent = `${state.stats.earned} coins`;
    const percentage = (state.energy / state.maxEnergy) * 100;
    energyMeter.style.width = `${percentage}%`;

    if (state.energy >= state.maxEnergy) {
      energyTimer.textContent = "Full";
    } else {
      const elapsed = Date.now() - state.lastEnergyAt;
      const remaining = Math.max(0, ENERGY_RECHARGE_MS - (elapsed % ENERGY_RECHARGE_MS));
      energyTimer.textContent = `+1 in ${Math.ceil(remaining / 1000)}s`;
    }
  }

  function renderInspector() {
    const empty = $("#inspectorEmpty");
    const content = $("#inspectorContent");
    if (selectedPlot === null) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    empty.hidden = true;
    content.hidden = false;
    const plot = state.plots[selectedPlot];
    $("#inspectorPlotNumber").textContent = selectedPlot + 1;
    const status = $("#inspectorStatus");
    status.className = "status-pill";

    if (!plot.crop) {
      $("#inspectorImage").src = "assets/tiles/soil_dry.png";
      $("#inspectorImage").alt = "Empty soil";
      $("#inspectorTitle").textContent = "Empty Plot";
      status.textContent = "Ready to plant";
      $("#inspectorGrowth").textContent = "0%";
      $("#inspectorWater").textContent = "No crop";
      $("#inspectorTime").textContent = "—";
      $("#inspectorValue").textContent = "—";
      $("#inspectorMeter").style.width = "0%";
      $("#inspectorTip").textContent = `Selected seed: ${crops[state.selectedSeed].name}. Planting costs 1 energy.`;
      $("#inspectorActionBtn").textContent = `Plant ${crops[state.selectedSeed].name}`;
      $("#inspectorActionBtn").dataset.action = "plant";
      return;
    }

    const crop = crops[plot.crop];
    const totalStages = crop.stages.length;
    const stagePercent = Math.round((plot.stage / totalStages) * 100);
    $("#inspectorImage").src = cropImage(plot.crop, plot.stage);
    $("#inspectorImage").alt = crop.name;
    $("#inspectorTitle").textContent = crop.name;
    $("#inspectorGrowth").textContent = `${plot.stage}/${totalStages} (${stagePercent}%)`;
    $("#inspectorWater").textContent = plot.watered ? "Yes" : "No";
    $("#inspectorValue").textContent = `${crop.sell} coins`;
    $("#inspectorMeter").style.width = `${stagePercent}%`;

    if (isReady(plot)) {
      status.classList.add("ready");
      status.textContent = "Ready to harvest";
      $("#inspectorTime").textContent = "Ready now";
      $("#inspectorTip").textContent = "This crop is fully mature. Harvest it to earn coins.";
      $("#inspectorActionBtn").textContent = "Harvest crop";
      $("#inspectorActionBtn").dataset.action = "harvest";
    } else if (plot.watered) {
      status.classList.add("watered");
      status.textContent = "Watered and growing";
      const seconds = Math.max(1, Math.ceil((plot.nextGrowthAt - Date.now()) / 1000));
      $("#inspectorTime").textContent = `${seconds}s`;
      $("#inspectorTip").textContent = "This crop is growing. You can wait or end the day.";
      $("#inspectorActionBtn").textContent = "Growing…";
      $("#inspectorActionBtn").dataset.action = "info";
    } else {
      status.classList.add("dry");
      status.textContent = "Needs water";
      $("#inspectorTime").textContent = "After watering";
      $("#inspectorTip").textContent = "Water this stage to continue growing.";
      $("#inspectorActionBtn").textContent = "Water crop";
      $("#inspectorActionBtn").dataset.action = "water";
    }
  }

  function renderShop() {
    shopGrid.innerHTML = "";
    Object.entries(crops).forEach(([key, crop]) => {
      const item = document.createElement("article");
      item.className = "shop-item";
      item.innerHTML = `
        <img src="assets/crops/${key}/09_harvest.png" alt="${crop.name}">
        <div>
          <h3>${crop.name} Seeds</h3>
          <p>${crop.stages.length} growth stages • ${Math.round(crop.growthMs / 1000)} seconds per stage</p>
          <div class="shop-meta"><span>Cost: ${crop.cost}</span><span>Sell: ${crop.sell}</span><span>Owned: ${state.inventory[key] || 0}</span></div>
          <button class="buy-btn" data-crop="${key}" ${state.coins < crop.cost ? "disabled" : ""}>Buy 1 seed</button>
        </div>`;
      item.querySelector("button").addEventListener("click", () => buySeed(key));
      shopGrid.appendChild(item);
    });
  }

  function buySeed(key) {
    const crop = crops[key];
    if (state.coins < crop.cost) {
      toast("You do not have enough coins.", "bad");
      playSound("error");
      return;
    }
    state.coins -= crop.cost;
    state.inventory[key] = (state.inventory[key] || 0) + 1;
    state.selectedSeed = key;
    activeTool = "plant";
    saveState();
    renderAll();
    bump($("#coinChip"));
    toast(`Bought 1 ${crop.name} seed.`, "good");
    playSound("buy");
  }

  async function endDay() {
    if (dayChanging) return;
    dayChanging = true;
    dayTransition.classList.add("active");
    $("#transitionDay").textContent = `Day ${state.day + 1}`;
    $("#transitionWeather").textContent = "The garden rests beneath the moon…";
    playSound("night");

    await wait(620);

    state.day += 1;
    state.energy = state.maxEnergy;
    state.lastEnergyAt = Date.now();
    let grew = 0;
    state.plots.forEach((plot) => {
      if (plot.crop && plot.watered && !isReady(plot)) {
        plot.stage += 1;
        plot.watered = false;
        plot.nextGrowthAt = 0;
        grew += 1;
      }
    });

    const options = ["sunny", "sunny", "cloudy", "rainy", "night"];
    state.weather = options[Math.floor(Math.random() * options.length)];
    let rainCount = 0;
    if (state.weather === "rainy") {
      state.plots.forEach((plot) => {
        if (plot.crop && !plot.watered && !isReady(plot)) {
          plot.watered = true;
          plot.nextGrowthAt = Date.now() + crops[plot.crop].growthMs;
          rainCount += 1;
        }
      });
    }

    const dayBonus = 5;
    state.coins += dayBonus;
    saveState();
    renderAll();
    $("#transitionWeather").textContent = `${weatherData[state.weather].label} • +${dayBonus} daily coins`;
    playSound("day");

    await wait(650);
    dayTransition.classList.remove("active");
    dayChanging = false;
    bump($("#coinChip"));
    showFarmerAtCurrent(`Day ${state.day}!`, "idle_front");
    toast(`New day! ${grew ? `${grew} crop${grew > 1 ? "s" : ""} grew. ` : ""}+${dayBonus} coins.${rainCount ? ` Rain watered ${rainCount} crops.` : ""}`, "good");
  }

  function renderTutorial() {
    const step = tutorialSteps[tutorialIndex];
    $("#tutorialImage").src = step.image;
    $("#welcomeTitle").textContent = step.title;
    $("#tutorialText").textContent = step.text;
    $("#tutorialBackBtn").disabled = tutorialIndex === 0;
    $("#tutorialBackBtn").style.opacity = tutorialIndex === 0 ? ".45" : "1";
    $("#startBtn").textContent = tutorialIndex === tutorialSteps.length - 1 ? "Start Planting" : "Next";
    const dots = $("#tutorialDots");
    dots.innerHTML = tutorialSteps.map((_, i) => `<i class="${i === tutorialIndex ? "active" : ""}"></i>`).join("");
  }

  function openTutorial(force = false) {
    tutorialIndex = 0;
    renderTutorial();
    welcomeModal.hidden = false;
    document.body.classList.add("modal-open");
    if (force) playSound("select");
  }

  function finishTutorial() {
    welcomeModal.hidden = true;
    document.body.classList.remove("modal-open");
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch (_) {}
    playSound("day");
  }

  function moveFarmerToPlot(index, message, action) {
    const plotEl = garden.querySelector(`[data-index="${index}"]`);
    if (!plotEl) {
      showFarmerAtCurrent(message, action);
      return;
    }
    const fieldRect = field.getBoundingClientRect();
    const plotRect = plotEl.getBoundingClientRect();
    const mobile = window.matchMedia("(max-width:700px)").matches;
    const farmerWidth = mobile ? 88 : 145;
    const x = Math.max(0, Math.min(fieldRect.width - farmerWidth, plotRect.left - fieldRect.left + plotRect.width / 2 - farmerWidth / 2));
    const yOffset = mobile ? 75 : 115;
    const y = Math.max(76, Math.min(fieldRect.height - farmerWidth - 20, plotRect.top - fieldRect.top - yOffset));

    farmerStage.style.left = `${x}px`;
    farmerStage.style.top = `${y}px`;
    farmerStage.style.bottom = "auto";
    farmerStage.classList.add("walking");
    window.setTimeout(() => {
      farmerStage.classList.remove("walking");
      showFarmerAtCurrent(message, action);
    }, 520);
  }

  function showFarmerAtCurrent(message, action) {
    clearTimeout(actionTimer);
    clearInterval(farmerFrameTimer);
    actionBubble.textContent = message;
    actionBubble.classList.add("show");

    const sequences = {
      water: ["water_1", "water_2", "water_1", "water_2"],
      dig: ["dig_1", "dig_2", "dig_1", "dig_2"],
      harvest: ["harvest_1", "harvest_2", "harvest_1", "harvest_2"],
      idle_front: ["idle_front"]
    };
    const frames = sequences[action] || sequences.idle_front;
    let frame = 0;
    farmerSprite.src = `assets/characters/farmer/${frames[0]}.png`;
    farmerFrameTimer = window.setInterval(() => {
      frame += 1;
      if (frame >= frames.length) {
        clearInterval(farmerFrameTimer);
        farmerSprite.src = "assets/characters/farmer/idle_front.png";
        return;
      }
      farmerSprite.src = `assets/characters/farmer/${frames[frame]}.png`;
    }, 170);

    actionTimer = window.setTimeout(() => actionBubble.classList.remove("show"), 1700);
  }

  function getPlotRect(index) {
    return garden.querySelector(`[data-index="${index}"]`)?.getBoundingClientRect() || null;
  }

  function animatePlot(index, particleType, className) {
    const plotEl = garden.querySelector(`[data-index="${index}"]`);
    if (!plotEl) return;
    plotEl.classList.add(className);
    window.setTimeout(() => plotEl.classList.remove(className), 700);
    emitParticles(plotEl, particleType);
  }

  function emitParticles(element, type) {
    const fieldRect = field.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const centerX = rect.left - fieldRect.left + rect.width / 2;
    const centerY = rect.top - fieldRect.top + rect.height / 2;
    const count = type === "water" ? 12 : 9;
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement("i");
      particle.className = `particle ${type}`;
      particle.style.left = `${centerX + (Math.random() - .5) * 24}px`;
      particle.style.top = `${centerY + (Math.random() - .5) * 18}px`;
      particle.style.setProperty("--x", `${(Math.random() - .5) * 85}px`);
      particle.style.setProperty("--y", `${-25 - Math.random() * 75}px`);
      effectLayer.appendChild(particle);
      window.setTimeout(() => particle.remove(), 750);
    }
  }

  function flyToCoins(src, startRect) {
    if (!startRect) return;
    const target = $("#coinChip").getBoundingClientRect();
    const img = document.createElement("img");
    img.className = "flying-crop";
    img.src = src;
    img.alt = "";
    img.style.left = `${startRect.left}px`;
    img.style.top = `${startRect.top}px`;
    img.style.width = `${Math.max(58, startRect.width)}px`;
    img.style.height = `${Math.max(58, startRect.height)}px`;
    img.style.setProperty("--target-x", `${target.left + target.width / 2}px`);
    img.style.setProperty("--target-y", `${target.top + target.height / 2}px`);
    document.body.appendChild(img);
    window.setTimeout(() => img.remove(), 900);
  }

  function bump(element) {
    if (!element) return;
    element.classList.remove("bump");
    void element.offsetWidth;
    element.classList.add("bump");
    window.setTimeout(() => element.classList.remove("bump"), 500);
  }

  function toast(message, type = "good") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    toastStack.appendChild(el);
    window.setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      window.setTimeout(() => el.remove(), 220);
    }, 2800);
  }

  function openShop() {
    renderShop();
    shopModal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeShop() {
    shopModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function openInfoSheet() {
    if (selectedPlot === null) {
      toast("Select a plot first.", "warn");
      return;
    }
    document.body.classList.add("info-open");
  }

  function closeInfoSheet() {
    document.body.classList.remove("info-open");
  }

  function playSound(kind) {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const presets = {
        select: [420, .045], plant: [260, .08], water: [510, .08], grow: [650, .12],
        harvest: [780, .16], buy: [610, .09], day: [520, .18], night: [260, .22], error: [150, .12]
      };
      const [frequency, duration] = presets[kind] || [400, .07];
      osc.type = kind === "error" ? "sawtooth" : "square";
      osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      osc.connect(gain).connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    } catch (_) {}
  }

  function resetGame() {
    if (!window.confirm("Reset all coins, crops, inventory, and progress?")) return;
    state = freshState();
    activeTool = "plant";
    selectedPlot = null;
    closeInfoSheet();
    saveState();
    renderAll();
    showFarmerAtCurrent("Fresh start!", "idle_front");
    toast("Garden reset.", "warn");
  }

  function runInspectorAction() {
    if (selectedPlot === null) return;
    const action = $("#inspectorActionBtn").dataset.action;
    if (action === "plant") {
      activeTool = "plant";
      plantCrop(selectedPlot);
    } else if (action === "water") {
      activeTool = "water";
      waterCrop(selectedPlot);
    } else if (action === "harvest") {
      activeTool = "harvest";
      harvestCrop(selectedPlot);
    } else {
      toast("This crop is still growing.", "warn");
    }
    renderToolbar();
    updateFieldMessage();
  }

  function initEvents() {
    document.querySelectorAll(".tool-btn[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        activeTool = button.dataset.tool;
        renderToolbar();
        updateFieldMessage();
        if (activeTool === "info" && selectedPlot !== null) openInfoSheet();
        playSound("select");
      });
    });

    $("#shopBtn").addEventListener("click", openShop);
    $("#shopDockBtn").addEventListener("click", openShop);
    $("#closeShopBtn").addEventListener("click", closeShop);
    shopModal.addEventListener("click", (event) => { if (event.target === shopModal) closeShop(); });
    $("#endDayBtn").addEventListener("click", endDay);
    $("#nextDayDockBtn").addEventListener("click", endDay);
    $("#resetBtn").addEventListener("click", resetGame);
    $("#openInfoBtn").addEventListener("click", openInfoSheet);
    $("#closeInfoBtn").addEventListener("click", closeInfoSheet);
    $("#inspectorActionBtn").addEventListener("click", runInspectorAction);
    $("#tutorialBtn").addEventListener("click", () => openTutorial(true));

    $("#backBtn").addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.href = "../../project.html";
    });

    soundBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      soundBtn.textContent = soundEnabled ? "🔊 Sound" : "🔇 Muted";
      soundBtn.setAttribute("aria-pressed", String(soundEnabled));
      if (soundEnabled) playSound("select");
    });

    $("#startBtn").addEventListener("click", () => {
      if (tutorialIndex < tutorialSteps.length - 1) {
        tutorialIndex += 1;
        renderTutorial();
        playSound("select");
      } else {
        finishTutorial();
      }
    });
    $("#tutorialBackBtn").addEventListener("click", () => {
      if (tutorialIndex > 0) {
        tutorialIndex -= 1;
        renderTutorial();
        playSound("select");
      }
    });
    $("#skipTutorialBtn").addEventListener("click", finishTutorial);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!shopModal.hidden) closeShop();
      else if (!welcomeModal.hidden) finishTutorial();
      else closeInfoSheet();
    });
    window.addEventListener("beforeunload", saveState);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        processGrowth();
        renderAll();
      }
    });
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function init() {
    initEvents();
    processGrowth();
    renderAll();
    window.setInterval(processGrowth, 500);
    window.setInterval(() => {
      updateEnergy();
      renderHeader();
      renderProgress();
      renderInspector();
      saveState();
    }, 1000);

    let welcomed = false;
    try { welcomed = localStorage.getItem(WELCOME_KEY) === "1"; } catch (_) {}
    if (!welcomed) openTutorial();
  }

  init();
})();
