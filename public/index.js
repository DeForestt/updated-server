const setupHero = () => {
  const line = document.getElementById("welcome-line");
  const heroButtons = Array.from(document.querySelectorAll(".hero .pill[data-message]"));
  if (!line || !heroButtons.length) return;
  heroButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const message = button.getAttribute("data-message") || "";
      line.textContent = message;
    });
  });
};

const setupCommands = () => {
  const buttons = Array.from(document.querySelectorAll(".command-button"));
  const title = document.getElementById("command-title");
  const description = document.getElementById("command-description");
  const tip = document.getElementById("command-tip");
  if (!buttons.length || !title || !description || !tip) return;

  const activate = (button) => {
    buttons.forEach((btn) => btn.classList.toggle("active", btn === button));
    title.textContent = button.dataset.title || button.textContent;
    description.textContent = button.dataset.description || "";
    tip.textContent = button.dataset.tip || "";
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button));
  });

  activate(buttons[0]);
};

const setupFilters = () => {
  const filters = Array.from(document.querySelectorAll(".filter-pill"));
  const cards = Array.from(document.querySelectorAll(".module-card"));
  if (!filters.length || !cards.length) return;

  const apply = (filter) => {
    filters.forEach((pill) => pill.classList.toggle("active", pill.dataset.filter === filter));
    cards.forEach((card) => {
      const group = card.dataset.group || "all";
      if (filter === "all" || group === filter) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });
  };

  filters.forEach((pill) => {
    pill.addEventListener("click", () => apply(pill.dataset.filter || "all"));
  });

  apply("all");
};

const setupTutorialSteps = () => {
  const buttons = Array.from(document.querySelectorAll(".step-button"));
  const stage = document.getElementById("tutorial-stage");
  const prevBtn = document.getElementById("tutorial-prev");
  const nextBtn = document.getElementById("tutorial-next");
  if (!buttons.length || !stage || !prevBtn || !nextBtn) return;

  const order = buttons.map((btn) => btn.dataset.step).filter(Boolean);
  const cache = {};
  let currentStep = order[0];

  const updateNavState = () => {
    const index = order.indexOf(currentStep);
    buttons.forEach((btn) => btn.classList.toggle("active", btn.dataset.step === currentStep));
    const prevTarget = index > 0 ? order[index - 1] : "";
    prevBtn.disabled = !prevTarget;
    prevBtn.dataset.target = prevTarget;

    if (index === order.length - 1) {
      nextBtn.textContent = "Browse examples";
      nextBtn.dataset.target = "";
      nextBtn.dataset.examples = "true";
    } else {
      nextBtn.textContent = "Next step";
      nextBtn.dataset.examples = "false";
      nextBtn.dataset.target = order[index + 1] || "";
    }
  };

  const renderStep = (step, html) => {
    stage.innerHTML = html;
    currentStep = step;
    updateNavState();
  };

  const loadStep = (step) => {
    if (cache[step]) {
      renderStep(step, cache[step]);
      return;
    }
    fetch(`/tutorial/steps/${step}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load tutorial step");
        return res.text();
      })
      .then((html) => {
        cache[step] = html;
        renderStep(step, html);
      })
      .catch(() => {
        renderStep(step, '<article class="tutorial-section"><p>Unable to load this step.</p></article>');
      });
  };

  const show = (step) => {
    if (!step || step === currentStep) return;
    loadStep(step);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.step || ""));
  });

  prevBtn.addEventListener("click", () => {
    const target = prevBtn.dataset.target;
    if (target) show(target);
  });

  nextBtn.addEventListener("click", () => {
    if (nextBtn.dataset.examples === "true") {
      window.location.href = "/examples";
      return;
    }
    const target = nextBtn.dataset.target;
    if (target) show(target);
  });

  loadStep(order[0]);
};

const ready = () => {
  setupHero();
  setupCommands();
  setupFilters();
  setupTutorialSteps();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ready);
} else {
  ready();
}
