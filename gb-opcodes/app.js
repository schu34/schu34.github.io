const CATEGORY_CLASSES = [
  { name: "misc", test: (op) => ["NOP", "STOP", "HALT", "DI", "EI", "PREFIX"].includes(op.mnemonic) },
  { name: "jump", test: (op) => ["JR", "JP", "CALL", "RET", "RETI", "RST"].includes(op.mnemonic) },
  { name: "load16", test: (op) => op.mnemonic === "PUSH" || op.mnemonic === "POP" || touchesAny(op, ["BC", "DE", "HL", "SP", "AF", "n16"]) && ["LD", "INC", "DEC"].includes(op.mnemonic) },
  { name: "load8", test: (op) => ["LD", "LDH"].includes(op.mnemonic) },
  { name: "alu16", test: (op) => op.mnemonic === "ADD" && touchesAny(op, ["HL", "SP"]) },
  { name: "alu8", test: (op) => ["INC", "DEC", "ADD", "ADC", "SUB", "SBC", "AND", "XOR", "OR", "CP", "DAA", "CPL", "SCF", "CCF"].includes(op.mnemonic) },
  { name: "bit", test: (op) => ["RLCA", "RRCA", "RLA", "RRA", "RLC", "RRC", "RL", "RR", "SLA", "SRA", "SWAP", "SRL", "BIT", "RES", "SET"].includes(op.mnemonic) },
];

const FLAG_ORDER = ["Z", "N", "H", "C"];
const FLAG_NAMES = {
  Z: "Zero flag",
  N: "Subtract flag",
  H: "Half carry flag",
  C: "Carry flag",
};

const FLAG_VALUE_DESCRIPTIONS = {
  "-": "left unchanged",
  "0": "reset to 0",
  "1": "set to 1",
};

document.querySelector(".theme-toggle").addEventListener("click", (event) => {
  const isLight = document.body.classList.toggle("light");
  event.currentTarget.setAttribute("aria-pressed", String(!isLight));
  event.currentTarget.querySelector("span:last-child").textContent = isLight ? "Light" : "Dark";
});

fetch("opcodes.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Unable to load opcodes.json: ${response.status}`);
    return response.json();
  })
  .then((data) => {
    renderTable(document.querySelector("#unprefixed-table"), data.unprefixed);
    renderTable(document.querySelector("#prefixed-table"), data.cbprefixed);
  })
  .catch((error) => {
    document.querySelector("main").insertAdjacentHTML(
      "afterbegin",
      `<p class="load-error">${escapeHtml(error.message)}</p>`
    );
  });

function renderTable(container, opcodes) {
  const table = document.createElement("table");
  table.className = "opcode-table";
  table.appendChild(renderHeader());

  const body = document.createElement("tbody");
  for (let row = 0; row < 32; row += 1) {
    const tr = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = `${row.toString(8)}x`;
    tr.appendChild(label);

    for (let column = 0; column < 8; column += 1) {
      const value = row * 8 + column;
      const key = `0x${value.toString(16).toUpperCase().padStart(2, "0")}`;
      const cell = document.createElement("td");
      const opcode = opcodes[key];
      cell.appendChild(opcode ? renderInstruction(key, opcode) : renderEmpty());
      tr.appendChild(cell);
    }

    body.appendChild(tr);
  }

  table.appendChild(body);
  container.replaceChildren(table);
}

function renderHeader() {
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  row.appendChild(document.createElement("th"));

  for (let index = 0; index < 8; index += 1) {
    const th = document.createElement("th");
    th.textContent = `x${index}`;
    row.appendChild(th);
  }

  head.appendChild(row);
  return head;
}

function renderInstruction(key, opcode) {
  const wrapper = document.createElement("div");
  wrapper.className = `instruction ${categoryFor(opcode)}`;

  const code = document.createElement("div");
  code.className = "opcode";
  const hex = document.createElement("span");
  hex.textContent = key;
  const separator = document.createElement("span");
  separator.textContent = " / ";
  const binary = document.createElement("span");
  binary.className = "binary-opcode";
  binary.textContent = formatBinaryOpcode(key);
  code.append(hex, separator, binary);

  const mnemonic = document.createElement("div");
  mnemonic.className = "mnemonic";
  mnemonic.textContent = formatInstruction(opcode);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(renderTooltipToken(`${opcode.bytes}`, `${opcode.bytes} byte${opcode.bytes === 1 ? "" : "s"}`));
  meta.appendChild(renderTooltipToken(`${opcode.cycles.join("/")}`, `${formatCycles(opcode.cycles)} T-states`));
  meta.appendChild(renderFlags(opcode.flags));

  wrapper.append(code, mnemonic, meta);
  return wrapper;
}

function renderFlags(flags) {
  const flagList = document.createElement("span");
  flagList.className = "flags";

  for (const flag of FLAG_ORDER) {
    const value = document.createElement("span");
    value.className = "flag";
    value.textContent = flags[flag] ?? "-";
    value.tabIndex = 0;
    value.dataset.tooltip = describeFlag(flag, value.textContent);
    value.setAttribute("aria-label", value.dataset.tooltip);
    flagList.appendChild(value);
  }

  return flagList;
}

function renderTooltipToken(text, tooltip) {
  const token = document.createElement("span");
  token.className = "meta-token";
  token.textContent = text;
  token.tabIndex = 0;
  token.dataset.tooltip = tooltip;
  token.setAttribute("aria-label", tooltip);
  return token;
}

function renderEmpty() {
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = "-";
  return empty;
}

function formatInstruction(opcode) {
  if (!opcode.operands.length) return opcode.mnemonic;

  return `${opcode.mnemonic} ${opcode.operands.map(formatOperand).join(", ")}`;
}

function formatOperand(operand) {
  return operand.immediate ? operand.name : `[${operand.name}]`;
}

function formatBinaryOpcode(key) {
  const value = Number.parseInt(key.slice(2), 16);
  const bits = value.toString(2).padStart(8, "0");
  return `0b${bits.replace(/(\d{2})(\d{3})(\d{3})/, "$1 $2 $3")}`;
}

function formatCycles(cycles) {
  return cycles.length === 1 ? `${cycles[0]}` : `${cycles[0]} if taken, ${cycles[1]} if not taken`;
}

function describeFlag(flag, value) {
  const base = `${flag}: ${FLAG_NAMES[flag]}`;
  const effect = FLAG_VALUE_DESCRIPTIONS[value] ?? `updated from result as ${value}`;
  return `${base}; ${effect}`;
}

function categoryFor(opcode) {
  const category = CATEGORY_CLASSES.find(({ test }) => test(opcode));
  return category ? category.name : "misc";
}

function touchesAny(opcode, names) {
  return opcode.operands.some((operand) => names.includes(operand.name));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}
