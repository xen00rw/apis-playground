const cardsContainer = document.querySelector("#cardsContainer");
const searchInput = document.querySelector("#searchInput");
const resultsCount = document.querySelector("#resultsCount");
const apiChips = document.querySelector("#apiChips");
const apiCardTemplate = document.querySelector("#apiCardTemplate");
const commandTemplate = document.querySelector("#commandTemplate");
const commandDividerTemplate = document.querySelector("#commandDividerTemplate");

let apiCatalog = [];

const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const extractPlaceholders = (text) => {
  const matches = text.match(/{{\s*[\w-]+\s*}}/g) || [];
  return [...new Set(matches.map((match) => match.replace(/[{}]/g, "").trim()))];
};

const fillTemplate = (text, values) =>
  text.replace(/{{\s*([\w-]+)\s*}}/g, (_, key) => values[key] || `{{${key}}}`);

const slugify = (value) =>
  normalize(value)
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

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
      codeElement.appendChild(document.createTextNode(textBefore));
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
    codeElement.appendChild(document.createTextNode(trailingText));
  }
};

const copyCommand = async (button, command) => {
  const icon = button.querySelector(".copy-icon");
  const originalMarkup = icon.innerHTML;

  try {
    await navigator.clipboard.writeText(command);
    icon.textContent = "OK";
  } catch (error) {
    icon.textContent = "!";
  }

  window.setTimeout(() => {
    icon.innerHTML = originalMarkup;
  }, 1800);
};

const renderCommand = (command) => {
  const fragment = commandTemplate.content.cloneNode(true);
  const section = fragment.querySelector(".command-block");
  const name = fragment.querySelector(".command-name");
  const description = fragment.querySelector(".command-description");
  const codeElement = fragment.querySelector(".command-code");
  const copyButton = fragment.querySelector(".copy-button");

  name.innerHTML = `<strong>${command.title}</strong>${command.method ? ` <span style="color:#8d8a84;font-weight:500;">(${command.method})</span>` : ""}`;
  description.textContent = command.description || "";

  const values = {};

  const updateCodePreview = () => {
    copyButton.onclick = () => copyCommand(copyButton, fillTemplate(command.template, values));
  };

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
    emptyState.innerHTML = "<h3>No API found</h3><p>Try another search term.</p>";
    cardsContainer.appendChild(emptyState);
    return;
  }

  const elements = items.map((api) => {
    const fragment = apiCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".api-card");
    card.id = `api-${slugify(api.name)}`;

    fragment.querySelector(".api-name").textContent = api.name;
    fragment.querySelector(".api-description").textContent = api.description || "";

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
    api.commands.forEach((command, index) => {
      if (index > 0) {
        commandsList.appendChild(commandDividerTemplate.content.cloneNode(true));
      }

      commandsList.appendChild(renderCommand(command));
    });

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
    link.textContent = api.name;
    return link;
  });

  apiChips.append(...chips);
};

const applySearch = () => {
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
};

const loadApis = async () => {
  try {
    const response = await fetch("./assets/apis.json");
    if (!response.ok) {
      throw new Error("Could not load the API catalog.");
    }

    const data = await response.json();
    apiCatalog = data.apis || [];
    renderApiChips(apiCatalog);
    renderCards(apiCatalog);
  } catch (error) {
    cardsContainer.innerHTML = `
      <article class="empty-state">
        <h3>Failed to load data</h3>
        <p>${error.message}</p>
      </article>
    `;
  }
};

searchInput.addEventListener("input", applySearch);
loadApis();
