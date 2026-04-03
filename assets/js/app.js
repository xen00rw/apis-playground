async function loadAPIs() {
  const response = await fetch("assets/apis.json");
  const apis = await response.json();
  const container = document.getElementById("api-container");
  const tagsContainer = document.getElementById("api-tags");

  apis.forEach((api) => {
    const safeId =
      "api-" +
      api.title
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "");

    const tag = document.createElement("a");
    tag.className = "api-tag";
    tag.textContent = api.title;
    tag.href = `#${safeId}`;
    tagsContainer.appendChild(tag);

    const card = document.createElement("div");
    card.className = "card";
    card.id = safeId;

    let pricingLink =
      api.pricing === "N/A"
        ? "N/A"
        : `<a href="${api.pricing}" target="_blank">${api.pricing}</a>`;

    card.innerHTML = `
      <h2>${api.title}</h2>
      <p>${api.details}</p>
      <hr>
      <div class="meta">
        <p><strong>Reference:</strong> <a href="${api.reference}" target="_blank">${api.reference}</a></p>
        <p><strong>Pricing:</strong> ${pricingLink}</p>
        <p><strong>Service Type:</strong> ${api.serviceType}</p>
      </div>
      <hr>
    `;

    api.commands.forEach((cmdObj) => {
      const commandBlock = document.createElement("div");
      commandBlock.className = "command-block";

      const codeSpan = document.createElement("span");
      let escaped = cmdObj.command
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      codeSpan.innerHTML = escaped.replace(
        /(\{\{[A-Z_]+\}\})/g,
        '<span style="color:#ffb347;">$1</span>'
      );

      commandBlock.appendChild(codeSpan);

      const btn = document.createElement("button");
      btn.textContent = "Copy!";
      btn.onclick = () => {
        navigator.clipboard.writeText(cmdObj.command).then(() => {
          btn.textContent = "OK ✓";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "Copy!";
            btn.classList.remove("copied");
          }, 2000);
        });
      };
      commandBlock.appendChild(btn);

      const desc = document.createElement("p");
      desc.style.marginTop = "5px";
      desc.style.fontSize = "0.9em";
      desc.style.color = "#aaaaaa";
      desc.textContent = cmdObj.desc;

      card.appendChild(commandBlock);
      card.appendChild(desc);
    });

    container.appendChild(card);
  });
}

window.onload = loadAPIs;
