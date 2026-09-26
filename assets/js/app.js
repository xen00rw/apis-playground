const cardsContainer = document.querySelector("#cardsContainer");
const searchInput = document.querySelector("#searchInput");
const resultsCount = document.querySelector("#resultsCount");
const apiChips = document.querySelector("#apiChips");
const apiCardTemplate = document.querySelector("#apiCardTemplate");
const commandTemplate = document.querySelector("#commandTemplate");
const commandDividerTemplate = document.querySelector("#commandDividerTemplate");
const backToTop = document.querySelector("#backToTop");
const codeModal = document.querySelector("#codeModal");
const codeModalTitle = document.querySelector("#codeModalTitle");
const codeModalCode = document.querySelector("#codeModalCode");
const codeModalCopy = document.querySelector("#codeModalCopy");

const COLLAPSE_THRESHOLD = 3;

let apiCatalog = [];
let activeModalCommand = null;

const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const fillTemplate = (text, values) =>
  text.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => values[key] || `{{${key}}}`);

const slugify = (value) =>
  normalize(value)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const highlightText = (text) => {
  const fragment = document.createDocumentFragment();
  const tokenRegex = /\b(curl|for|do|done|echo|javascript)\b|(--?[a-zA-Z][\w-]*)|(https?:\/\/[^\s'"\\>{}]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const span = document.createElement("span");

    if (match[1]) {
      span.className = "sh-cmd";
    } else if (match[2]) {
      span.className = "sh-flag";
    } else if (match[3]) {
      span.className = "sh-url";
    }

    span.textContent = match[0];
    fragment.appendChild(span);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
};

const createInlineEditor = (template, codeElement, values, updateCopyHandler) => {
  const placeholderInputs = new Map();
  const regex = /{{\s*([\w-]+)\s*}}/g;
  let cursor = 0;
  let match;

  codeElement.innerHTML = "";

  while ((match = regex.exec(template)) !== null) {
    const [rawMatch, key] = match;
    const textBefore = template.slice(cursor, match.index);

    if (textBefore) {
      codeElement.appendChild(highlightText(textBefore));
    }

    const input = document.createElement("input");
    input.className = "inline-token";
    input.type = key.toLowerCase().includes("token") || key.toLowerCase().includes("key")
      ? "password"
      : "text";
    input.placeholder = key;
    input.value = values[key] || "";
    input.autocomplete = "off";

    if (!placeholderInputs.has(key)) {
      placeholderInputs.set(key, []);
    }

    placeholderInputs.get(key).push(input);

    input.addEventListener("input", (event) => {
      const nextValue = event.target.value;
      values[key] = nextValue;

      placeholderInputs.get(key).forEach((relatedInput) => {
        if (relatedInput !== event.target) {
          relatedInput.value = nextValue;
        }
      });

      updateCopyHandler();
    });

    codeElement.appendChild(input);
    cursor = match.index + rawMatch.length;
  }

  const trailingText = template.slice(cursor);
  if (trailingText) {
    codeElement.appendChild(highlightText(trailingText));
  }
};

const copyCommand = async (button, command) => {
  const icon = button.querySelector(".copy-icon");
  const originalMarkup = icon ? icon.innerHTML : null;

  try {
    await navigator.clipboard.writeText(command);
    if (icon) {
      icon.textContent = "\u2713";
      button.classList.add("copied");
    } else {
      button.textContent = "Copied!";
      button.classList.add("copied");
    }
  } catch {
    if (icon) {
      icon.textContent = "\u2717";
      button.classList.add("copy-error");
    } else {
      button.textContent = "Error";
      button.classList.add("copy-error");
    }
  }

  window.setTimeout(() => {
    if (icon) {
      icon.innerHTML = originalMarkup;
    } else {
      button.textContent = "Copy command";
    }
    button.classList.remove("copied", "copy-error");
  }, 1800);
};

const openCodeModal = (title, template, values) => {
  codeModalTitle.textContent = title;
  activeModalCommand = { template, values };

  const resolved = fillTemplate(template, values);
  codeModalCode.innerHTML = "";
  codeModalCode.appendChild(highlightText(resolved));

  codeModal.hidden = false;
  document.body.style.overflow = "hidden";
};

const closeCodeModal = () => {
  codeModal.hidden = true;
  document.body.style.overflow = "";
  activeModalCommand = null;
};

const renderCommand = (command) => {
  const fragment = commandTemplate.content.cloneNode(true);
  const section = fragment.querySelector(".command-block");
  const nameEl = fragment.querySelector(".command-name");
  const description = fragment.querySelector(".command-description");
  const codeElement = fragment.querySelector(".command-code");
  const copyButton = fragment.querySelector(".copy-button");
  const codeWrapper = fragment.querySelector(".code-wrapper");

  const strong = document.createElement("strong");
  strong.textContent = command.title;
  nameEl.appendChild(strong);

  if (command.method) {
    const badge = document.createElement("span");
    badge.className = `method-badge method-${command.method.toLowerCase()}`;
    badge.textContent = command.method;
    nameEl.appendChild(badge);
  }

  description.textContent = command.description || "";

  const codeHeader = document.createElement("div");
  codeHeader.className = "code-header";

  const langLabel = document.createElement("span");
  langLabel.className = "code-lang";
  langLabel.textContent = command.template.startsWith("javascript:") ? "js" : "bash";
  codeHeader.appendChild(langLabel);

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "expand-button";
  expandBtn.setAttribute("aria-label", "Expand command");
  expandBtn.title = "Expand";
  expandBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  codeHeader.appendChild(expandBtn);

  const preElement = codeWrapper.querySelector("pre");
  codeWrapper.insertBefore(codeHeader, preElement);

  const values = {};

  const updateCodePreview = () => {
    copyButton.onclick = () => copyCommand(copyButton, fillTemplate(command.template, values));
  };

  expandBtn.addEventListener("click", () => {
    openCodeModal(command.title, command.template, values);
  });

  createInlineEditor(command.template, codeElement, values, updateCodePreview);
  updateCodePreview();
  return section;
};

const renderCards = (items) => {
  cardsContainer.innerHTML = "";
  resultsCount.textContent = `${items.length} API${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    const emptyState = document.createElement("article");
    emptyState.className = "empty-state";

    const heading = document.createElement("h3");
    heading.textContent = "No API found";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Try another search term.";

    emptyState.appendChild(heading);
    emptyState.appendChild(paragraph);
    cardsContainer.appendChild(emptyState);
    return;
  }

  const elements = items.map((api) => {
    const fragment = apiCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".api-card");
    card.id = `api-${slugify(api.name)}`;

    fragment.querySelector(".api-name").textContent = api.name;
    fragment.querySelector(".api-description").innerHTML = api.description || "";

    const badge = fragment.querySelector(".billing-badge");
    badge.textContent = api.billing;
    badge.classList.add(api.billing.toLowerCase() === "free" ? "free" : "paid");

    const detailsLink = fragment.querySelector(".details-link");
    detailsLink.href = api.detailsUrl;
    detailsLink.textContent = api.detailsUrl;

    const pricingLink = fragment.querySelector(".pricing-link");
    pricingLink.href = api.pricingUrl;
    pricingLink.textContent = api.pricingUrl;

    fragment.querySelector(".service-type").textContent = api.billing;

    const commandsList = fragment.querySelector(".commands-list");
    const shouldCollapse = api.commands.length > COLLAPSE_THRESHOLD;

    api.commands.forEach((command, index) => {
      if (index > 0) {
        const divider = commandDividerTemplate.content.cloneNode(true);
        commandsList.appendChild(divider);
      }

      const rendered = renderCommand(command);
      if (shouldCollapse && index >= COLLAPSE_THRESHOLD) {
        rendered.classList.add("hidden-command");
      }
      commandsList.appendChild(rendered);
    });

    if (shouldCollapse) {
      commandsList.classList.add("commands-collapsed");

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "toggle-commands";

      const hiddenCount = api.commands.length - COLLAPSE_THRESHOLD;
      toggleBtn.innerHTML = `Show ${hiddenCount} more command${hiddenCount > 1 ? "s" : ""} <span class="toggle-chevron">\u25BC</span>`;

      toggleBtn.addEventListener("click", () => {
        const isCollapsed = commandsList.classList.contains("commands-collapsed");

        if (isCollapsed) {
          commandsList.classList.remove("commands-collapsed");
          commandsList.classList.add("commands-expanded");
          toggleBtn.innerHTML = `Show less <span class="toggle-chevron">\u25BC</span>`;
        } else {
          commandsList.classList.remove("commands-expanded");
          commandsList.classList.add("commands-collapsed");
          toggleBtn.innerHTML = `Show ${hiddenCount} more command${hiddenCount > 1 ? "s" : ""} <span class="toggle-chevron">\u25BC</span>`;
        }
      });

      commandsList.appendChild(toggleBtn);
    }

    return card;
  });

  cardsContainer.append(...elements);
};

const renderApiChips = (items) => {
  apiChips.innerHTML = "";

  const chips = items.map((api) => {
    const link = document.createElement("a");
    link.className = "api-chip";
    link.href = `#api-${slugify(api.name)}`;

    const nameSpan = document.createTextNode(api.name);
    link.appendChild(nameSpan);

    if (api.commands.length > 1) {
      const count = document.createElement("span");
      count.className = "chip-count";
      count.textContent = `\u00B7 ${api.commands.length}`;
      link.appendChild(count);
    }

    return link;
  });

  apiChips.append(...chips);
};

let searchTimeout;
const applySearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const term = normalize(searchInput.value.trim());

    if (!term) {
      renderCards(apiCatalog);
      return;
    }

    const filtered = apiCatalog.filter((api) => {
      const haystack = [
        api.name,
        api.description,
        api.billing,
        ...(api.tags || []),
      ]
        .filter(Boolean)
        .map(normalize)
        .join(" ");

      return haystack.includes(term);
    });

    renderCards(filtered);
  }, 150);
};

const loadApis = async () => {
  try {
    const response = await fetch("assets/apis.json");
    if (!response.ok) {
      throw new Error("Could not load the API catalog.");
    }

    const data = await response.json();
    apiCatalog = data.apis || [];
    renderApiChips(apiCatalog);
    renderCards(apiCatalog);
  } catch (error) {
    const emptyState = document.createElement("article");
    emptyState.className = "empty-state";

    const heading = document.createElement("h3");
    heading.textContent = "Failed to load data";
    const paragraph = document.createElement("p");
    paragraph.textContent = error.message;

    emptyState.appendChild(heading);
    emptyState.appendChild(paragraph);
    cardsContainer.appendChild(emptyState);
  }
};

const initBackToTop = () => {
  let ticking = false;

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        backToTop.classList.toggle("visible", window.scrollY > 400);
        ticking = false;
      });
      ticking = true;
    }
  });

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
};

const initCodeModal = () => {
  codeModal.querySelector(".code-modal-backdrop").addEventListener("click", closeCodeModal);
  codeModal.querySelector(".code-modal-close").addEventListener("click", closeCodeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !codeModal.hidden) {
      closeCodeModal();
    }
  });

  codeModalCopy.addEventListener("click", () => {
    if (!activeModalCommand) return;
    const resolved = fillTemplate(activeModalCommand.template, activeModalCommand.values);
    copyCommand(codeModalCopy, resolved);
  });
};

searchInput.addEventListener("input", applySearch);
initBackToTop();
initCodeModal();
loadApis();
