(() => {
  const state = {
    data: null,
    range: "30",
    model: "all",
    platform: "all"
  };

  const elements = Object.fromEntries(
    [
      "agencyName",
      "publishedAt",
      "dataThrough",
      "dataFreshness",
      "rangeControl",
      "modelFilter",
      "platformFilter",
      "loadingState",
      "errorState",
      "errorMessage",
      "dashboard",
      "arrivalsMetric",
      "arrivalsMeta",
      "paidMetric",
      "paidMeta",
      "viewsMetric",
      "viewsMeta",
      "clicksMetric",
      "conversionMetric",
      "earningsCard",
      "earningsMetric",
      "messagesCard",
      "messagesMetric",
      "growthChart",
      "clicksChart",
      "sourcesList",
      "pageCount",
      "pagesTable",
      "linkCount",
      "linksTable"
    ].map((id) => [id, document.querySelector(`#${id}`)])
  );

  const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatNumber = (value) =>
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: Number.isInteger(number(value)) ? 0 : 1
    }).format(number(value));

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(number(value));

  const formatDate = (value) => {
    if (!value) return "—";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(`${value}T00:00:00Z`));
  };

  const formatTimestamp = (value) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "ещё не обновлялось";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const addDays = (iso, days) => {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

  function latestDate() {
    const candidates = [
      ...(state.data?.pages || []).flatMap((page) =>
        (page.series || []).map((entry) => entry.date)
      ),
      ...(state.data?.clicks?.daily || []).map((entry) => entry.date)
    ].filter(Boolean);
    return candidates.sort().at(-1) || state.data?.range?.to || "";
  }

  function activeRange() {
    const to = latestDate();
    if (!to || state.range === "all") {
      return { from: state.data?.range?.from || "", to };
    }
    return {
      from: addDays(to, -(Number(state.range) - 1)),
      to
    };
  }

  function inRange(date, range) {
    return (
      date &&
      (!range.from || date >= range.from) &&
      (!range.to || date <= range.to)
    );
  }

  function filteredPages() {
    return (state.data?.pages || []).filter(
      (page) =>
        (state.model === "all" || page.modelName === state.model) &&
        (state.platform === "all" || page.platform === state.platform)
    );
  }

  function pageRows(page, range) {
    return (page.series || []).filter((entry) => inRange(entry.date, range));
  }

  function aggregateDaily(pages, range) {
    const byDate = new Map();
    for (const page of pages) {
      for (const entry of pageRows(page, range)) {
        const row = byDate.get(entry.date) || {
          date: entry.date,
          arrivals: 0,
          paidSubscriptions: 0,
          earnings: 0,
          unansweredMessages: null
        };
        row.arrivals += number(entry.arrivals);
        row.paidSubscriptions += number(entry.paidSubscriptions);
        row.earnings += number(entry.earnings);
        if (
          entry.unansweredMessages !== null &&
          entry.unansweredMessages !== undefined
        ) {
          row.unansweredMessages =
            number(row.unansweredMessages) + number(entry.unansweredMessages);
        }
        byDate.set(entry.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function aggregateClicks(range) {
    return (state.data?.clicks?.daily || [])
      .filter(
        (entry) =>
          inRange(entry.date, range) &&
          (state.model === "all" || entry.modelName === state.model)
      )
      .map((entry) => ({
        ...entry,
        totalClicks:
          state.platform === "onlyfans"
            ? number(entry.onlyFans)
            : state.platform === "fansly"
              ? number(entry.fansly)
              : number(entry.totalClicks)
      }));
  }

  function total(rows, key) {
    return rows.reduce((sum, row) => sum + number(row[key]), 0);
  }

  function svgNode(name, attributes = {}) {
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg",
      name
    );
    for (const [key, value] of Object.entries(attributes)) {
      node.setAttribute(key, String(value));
    }
    return node;
  }

  function renderChart(container, rows, series) {
    container.replaceChildren();
    if (!rows.length || !series.some((item) => total(rows, item.key))) {
      const empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = "Нет данных за выбранный период";
      container.append(empty);
      return;
    }
    const width = 1000;
    const height = container.classList.contains("chart-compact") ? 300 : 350;
    const padding = { left: 24, right: 20, top: 26, bottom: 42 };
    const values = series.flatMap((item) => rows.map((row) => number(row[item.key])));
    const maximum = Math.max(1, ...values);
    const x = (index) =>
      padding.left +
      (index / Math.max(1, rows.length - 1)) *
        (width - padding.left - padding.right);
    const y = (value) =>
      height -
      padding.bottom -
      (number(value) / maximum) * (height - padding.top - padding.bottom);
    const svg = svgNode("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": series.map((item) => item.label).join(" и ")
    });
    for (let index = 0; index <= 4; index += 1) {
      const lineY =
        padding.top +
        (index / 4) * (height - padding.top - padding.bottom);
      svg.append(
        svgNode("line", {
          x1: padding.left,
          x2: width - padding.right,
          y1: lineY,
          y2: lineY,
          class: "chart-grid-line"
        })
      );
    }
    for (const item of series) {
      const points = rows
        .map((row, index) => `${x(index)},${y(row[item.key])}`)
        .join(" ");
      const area = svgNode("polygon", {
        points: `${x(0)},${height - padding.bottom} ${points} ${x(
          rows.length - 1
        )},${height - padding.bottom}`,
        fill: item.color,
        class: "chart-area"
      });
      const line = svgNode("polyline", {
        points,
        stroke: item.color,
        class: "chart-line"
      });
      svg.append(area, line);
    }
    const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
    for (const index of labelIndexes) {
      const label = svgNode("text", {
        x: x(index),
        y: height - 13,
        "text-anchor": index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle",
        class: "chart-label"
      });
      label.textContent = formatDate(rows[index].date);
      svg.append(label);
    }
    container.append(svg);
  }

  function renderSources(pages, range) {
    const grouped = new Map();
    for (const page of pages) {
      for (const entry of pageRows(page, range)) {
        for (const source of entry.arrivalSources || []) {
          grouped.set(
            source.label,
            (grouped.get(source.label) || 0) + number(source.value)
          );
        }
      }
    }
    const items = [...grouped.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    elements.sourcesList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "chart-empty";
      empty.textContent = "Источники пока не собраны";
      elements.sourcesList.append(empty);
      return;
    }
    const maximum = Math.max(...items.map((item) => item.value), 1);
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "rank-row";
      const label = document.createElement("span");
      label.textContent = item.label;
      const track = document.createElement("div");
      track.className = "rank-track";
      const fill = document.createElement("div");
      fill.className = "rank-fill";
      fill.style.width = `${Math.max(3, (item.value / maximum) * 100)}%`;
      track.append(fill);
      const value = document.createElement("strong");
      value.textContent = formatNumber(item.value);
      row.append(label, track, value);
      elements.sourcesList.append(row);
    }
  }

  function pageTotals(page, range) {
    const rows = pageRows(page, range);
    return {
      arrivals: total(rows, "arrivals"),
      paidSubscriptions: total(rows, "paidSubscriptions")
    };
  }

  function renderPages(pages, range) {
    elements.pagesTable.replaceChildren();
    const rows = pages
      .map((page) => ({ page, totals: pageTotals(page, range) }))
      .sort(
        (a, b) =>
          b.totals.arrivals - a.totals.arrivals ||
          a.page.modelName.localeCompare(b.page.modelName, "ru")
      );
    for (const { page, totals } of rows) {
      const row = document.createElement("tr");
      const identity = document.createElement("td");
      identity.className = "identity";
      const title = document.createElement("strong");
      title.textContent = `${page.modelName} · ${page.pageName}`;
      const username = document.createElement("small");
      username.textContent = page.username ? `@${page.username}` : "Без ника";
      identity.append(title, username);
      const platformCell = document.createElement("td");
      const platform = document.createElement("span");
      platform.className = `platform-badge platform-${page.platform}`;
      platform.textContent =
        page.platform === "fansly" ? "Fansly" : "OnlyFans";
      platformCell.append(platform);
      const arrivals = document.createElement("td");
      arrivals.textContent = formatNumber(totals.arrivals);
      const paid = document.createElement("td");
      paid.textContent = formatNumber(totals.paidSubscriptions);
      const date = document.createElement("td");
      date.textContent = formatDate(page.dataThrough);
      row.append(identity, platformCell, arrivals, paid, date);
      elements.pagesTable.append(row);
    }
    elements.pageCount.textContent = `${rows.length} стр.`;
  }

  function filteredLinks() {
    return (state.data?.clicks?.links || []).filter((link) => {
      if (state.model === "all") return true;
      return link.modelName === state.model;
    });
  }

  function renderLinks() {
    const links = filteredLinks().slice(0, 50);
    elements.linksTable.replaceChildren();
    for (const link of links) {
      const row = document.createElement("tr");
      const values = [
        link.label,
        formatNumber(link.views),
        formatNumber(
          state.platform === "onlyfans"
            ? link.onlyFans
            : state.platform === "fansly"
              ? link.fansly
              : link.totalClicks
        ),
        formatNumber(link.onlyFans),
        formatNumber(link.fansly),
        `${formatNumber(link.conversion)}%`
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      elements.linksTable.append(row);
    }
    elements.linkCount.textContent = `${links.length} ссылок`;
  }

  function render() {
    if (!state.data) return;
    const range = activeRange();
    const pages = filteredPages();
    const daily = aggregateDaily(pages, range);
    const clicksDaily = aggregateClicks(range);
    const arrivals = total(daily, "arrivals");
    const paid = total(daily, "paidSubscriptions");
    const views = total(clicksDaily, "views");
    const clicks = total(clicksDaily, "totalClicks");
    const conversion = views ? (clicks / views) * 100 : 0;
    elements.arrivalsMetric.textContent = formatNumber(arrivals);
    elements.paidMetric.textContent = formatNumber(paid);
    elements.viewsMetric.textContent = formatNumber(views);
    elements.clicksMetric.textContent = formatNumber(clicks);
    elements.conversionMetric.textContent = `Конверсия ${formatNumber(
      conversion
    )}%`;
    const periodLabel =
      state.range === "all"
        ? "за всё доступное время"
        : `за ${state.range} дней`;
    elements.arrivalsMeta.textContent = periodLabel;
    elements.paidMeta.textContent = periodLabel;
    elements.viewsMeta.textContent = periodLabel;

    const showEarnings = state.data.privacy?.earnings === true;
    elements.earningsCard.hidden = !showEarnings;
    if (showEarnings) {
      elements.earningsMetric.textContent = formatCurrency(
        total(daily, "earnings")
      );
    }
    const showMessages = state.data.privacy?.messages === true;
    elements.messagesCard.hidden = !showMessages;
    if (showMessages) {
      const latest = daily
        .filter((entry) => entry.unansweredMessages !== null)
        .at(-1);
      elements.messagesMetric.textContent = latest
        ? formatNumber(latest.unansweredMessages)
        : "—";
    }

    renderChart(elements.growthChart, daily, [
      { key: "arrivals", label: "Приходы", color: "#6ee79d" },
      {
        key: "paidSubscriptions",
        label: "Платные подписки",
        color: "#ad99ff"
      }
    ]);
    renderChart(elements.clicksChart, clicksDaily, [
      { key: "views", label: "Просмотры", color: "#81b9ff" },
      { key: "totalClicks", label: "Клики", color: "#ff9182" }
    ]);
    renderSources(pages, range);
    renderPages(pages, range);
    renderLinks();
  }

  function populateFilters() {
    const models = [
      ...new Set((state.data.pages || []).map((page) => page.modelName))
    ].sort((a, b) => a.localeCompare(b, "ru"));
    elements.modelFilter.replaceChildren(
      new Option("Все модели", "all"),
      ...models.map((model) => new Option(model, model))
    );
  }

  async function load() {
    try {
      const response = await fetch(`./data/latest.json?t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.schemaVersion !== 1 || !Array.isArray(data.pages)) {
        throw new Error("Неверный формат данных");
      }
      state.data = data;
      document.title = data.site?.agencyName
        ? `${data.site.agencyName} · James Statistics`
        : "James Statistics";
      elements.agencyName.textContent =
        data.site?.agencyName || "Публичная аналитика";
      elements.publishedAt.textContent = `Обновлено ${formatTimestamp(
        data.publishedAt
      )}`;
      const through = latestDate();
      elements.dataThrough.textContent = formatDate(through);
      elements.dataFreshness.textContent = data.dataGeneratedAt
        ? `Снимок James от ${formatTimestamp(data.dataGeneratedAt)}`
        : "Опубликованный снимок James";
      populateFilters();
      elements.loadingState.hidden = true;
      elements.errorState.hidden = true;
      elements.dashboard.hidden = false;
      render();
    } catch (error) {
      elements.loadingState.hidden = true;
      elements.dashboard.hidden = true;
      elements.errorState.hidden = false;
      elements.errorMessage.textContent =
        "James ещё не опубликовал первый снимок. Попробуйте обновить страницу позже.";
      console.error("James Statistics:", error);
    }
  }

  elements.rangeControl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-range]");
    if (!button) return;
    state.range = button.dataset.range;
    elements.rangeControl
      .querySelectorAll("[data-range]")
      .forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });
  elements.modelFilter.addEventListener("change", () => {
    state.model = elements.modelFilter.value;
    render();
  });
  elements.platformFilter.addEventListener("change", () => {
    state.platform = elements.platformFilter.value;
    render();
  });

  load();
})();
