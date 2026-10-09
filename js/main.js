// Shared site behaviour
document.addEventListener("DOMContentLoaded", function () {
  // --- Mobile navigation toggle ---
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    // Close the menu after tapping a link
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("open");
    });
  }

  // --- Dark-mode toggle ---
  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    function syncThemeIcon() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      themeBtn.textContent = dark ? "\u2600\uFE0F" : "\uD83C\uDF19"; // ☀️ / 🌙
      themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      themeBtn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    }
    syncThemeIcon();
    themeBtn.addEventListener("click", function () {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      if (dark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      }
      syncThemeIcon();
    });
  }

  // --- Current year in footer ---
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- Contact form (front-end demo: opens visitor's email client) ---
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("cf-name").value.trim();
      var email = document.getElementById("cf-email").value.trim();
      var message = document.getElementById("cf-message").value.trim();
      var address = form.dataset.email || "";

      var subject = "Hello from your website, from " + name;
      var body = message + "\n\n— " + name + " (" + email + ")";
      window.location.href =
        "mailto:" + address + "?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      var success = document.getElementById("form-success");
      if (success) {
        success.textContent =
          "Thanks, " + name + "! Your email app should now open — just hit send.";
        success.classList.add("show");
      }
      form.reset();
    });
  }

  // --- To-do app (projects page, backed by Supabase with localStorage fallback) ---
  var SUPABASE_URL = "https://yenyzpnahhjzjnfmghfd.supabase.co";
  var SUPABASE_KEY = "sb_publishable_efNyjRmQw1Kd3pXgWn5eMw_Lt-o_QAq";
  var STORAGE_KEY = "sabrin-todos-v1";
  var TABLE = "todos";

  var todoForm = document.getElementById("todo-form");
  var todoList = document.getElementById("todo-list");
  var todoEmpty = document.getElementById("todo-empty");
  var todoText = document.getElementById("todo-text");
  var todoDate = document.getElementById("todo-date");
  var todoAddBtn = document.getElementById("todo-add-btn");
  var todoStatus = document.getElementById("todo-status");

  var supabase = null;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) { supabase = null; }
  }

  // --- Priority + emoji pickers ---
  var selectedPriority = "medium";
  var selectedEmoji = null;
  var priorityChips = document.querySelectorAll(".pri-chip");
  var emojiChips = document.querySelectorAll(".emoji-chip");
  priorityChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      priorityChips.forEach(function (c) {
        c.classList.remove("is-selected");
        c.setAttribute("aria-checked", "false");
      });
      chip.classList.add("is-selected");
      chip.setAttribute("aria-checked", "true");
      selectedPriority = chip.dataset.priority;
    });
  });
  emojiChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      emojiChips.forEach(function (c) {
        c.classList.remove("is-selected");
        c.setAttribute("aria-checked", "false");
      });
      chip.classList.add("is-selected");
      chip.setAttribute("aria-checked", "true");
      var val = chip.dataset.emoji;
      selectedEmoji = (val === "none") ? null : val;
    });
  });

  if (todoForm && todoList && todoText && todoDate) {
    function setStatus(msg, kind) {
      if (!todoStatus) return;
      todoStatus.textContent = msg || "";
      todoStatus.classList.remove("info", "error");
      if (!msg) return;
      if (kind === "error") todoStatus.classList.add("error");
      else if (kind === "info") todoStatus.classList.add("info");
    }

    function setBusy(busy) {
      if (!todoAddBtn) return;
      todoAddBtn.disabled = !!busy;
      todoAddBtn.textContent = busy ? "Saving…" : "Add";
    }

    function todayISO() {
      var d = new Date();
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    }
    if (!todoDate.value) todoDate.value = todayISO();

    // ---------- LocalStorage fallback ----------
    function lsLoad() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
      catch (e) { return []; }
    }
    function lsSave(todos) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }

    function formatDate(iso) {
      if (!iso) return "";
      var d = new Date(String(iso).slice(0, 10) + "T00:00:00");
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
      });
    }

    // ---------- Cloud-first data layer ----------
    async function fetchTodos() {
      if (!supabase) return { todos: lsLoad(), cloud: false };
      try {
        var { data, error } = await supabase
          .from(TABLE)
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (data && Array.isArray(data)) {
          return { todos: data.map(normalizeRow), cloud: true };
        }
        return { todos: [], cloud: true };
      } catch (err) {
        console.warn("[todo] Supabase read failed, falling back to localStorage:", err);
        return { todos: lsLoad(), cloud: false };
      }
    }

    function normalizeRow(r) {
      return {
        id: r.id,
        text: r.text || "",
        date: (r.date || "").slice ? r.date.slice(0, 10) : (r.date || ""),
        done: !!r.done,
        priority: r.priority || "medium",
        emoji: r.emoji || null,
        created_at: r.created_at
      };
    }

    async function insertTodo(row) {
      if (supabase) {
        try {
          var { data, error } = await supabase.from(TABLE).insert([{
            text: row.text, date: row.date, done: false,
            priority: row.priority || "medium",
            emoji: row.emoji || null
          }]).select();
          if (error) throw error;
          if (data && data[0]) return normalizeRow(data[0]);
        } catch (err) {
          console.warn("[todo] Supabase insert failed:", err);
        }
      }
      // Fallback
      var localId = "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      var local = {
        id: localId,
        text: row.text,
        date: row.date,
        done: false,
        priority: row.priority || "medium",
        emoji: row.emoji || null,
        created_at: new Date().toISOString()
      };
      var all = lsLoad();
      all.push(local);
      lsSave(all);
      return local;
    }

    async function updateDone(id, done) {
      if (supabase) {
        try {
          var { error } = await supabase.from(TABLE).update({ done: done }).eq("id", id);
          if (error) throw error;
          return true;
        } catch (err) {
          console.warn("[todo] Supabase update failed:", err);
        }
      }
      var all = lsLoad();
      var item = all.find(function (x) { return x.id === id; });
      if (item) { item.done = done; lsSave(all); }
      return true;
    }

    async function updateText(id, text) {
      if (supabase) {
        try {
          var { error } = await supabase.from(TABLE).update({ text: text }).eq("id", id);
          if (error) throw error;
          return true;
        } catch (err) {
          console.warn("[todo] Supabase update failed:", err);
        }
      }
      var all = lsLoad();
      var item = all.find(function (x) { return x.id === id; });
      if (item) { item.text = text; lsSave(all); }
      return true;
    }

    async function deleteTodo(id) {
      if (supabase) {
        try {
          var { error } = await supabase.from(TABLE).delete().eq("id", id);
          if (error) throw error;
          return true;
        } catch (err) {
          console.warn("[todo] Supabase delete failed:", err);
        }
      }
      var all = lsLoad().filter(function (x) { return x.id !== id; });
      lsSave(all);
      return true;
    }

    // ---------- Rendering ----------
    var counterEl = document.getElementById("todo-counter");

    function renderCounter(todos) {
      if (!counterEl) return;
      var total = todos.length;
      var done = todos.filter(function (t) { return t.done; }).length;
      var pct = total === 0 ? 0 : Math.round((done / total) * 100);
      counterEl.innerHTML =
        '<span class="count-nums">' + done + ' of ' + total + '</span>' +
        '<span>tasks completed</span>' +
        '<div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '">' +
          '<div class="progress-fill" style="width:' + pct + '%"></div>' +
        '</div>';
    }

    function renderList(todos) {
      todos = todos.slice().sort(function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.created_at || "").localeCompare(b.created_at || "");
      });

      todoList.innerHTML = "";
      if (todos.length === 0) {
        todoEmpty.classList.remove("hidden");
        renderCounter(todos);
        return;
      }
      renderCounter(todos);
      todoEmpty.classList.add("hidden");

      todos.forEach(function (t) {
        var li = document.createElement("li");
        li.className = "todo-item" + (t.done ? " done" : "");
        li.dataset.id = t.id;

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "todo-checkbox";
        cb.checked = !!t.done;
        cb.setAttribute("aria-label", "Mark '" + t.text + "' as done");
        cb.addEventListener("change", async function () {
          var prev = li.classList.contains("done");
          li.classList.toggle("done");
          cb.checked = !prev;
          t.done = cb.checked;
          renderCounter(todos);
          await updateDone(t.id, cb.checked);
        });

        var body = document.createElement("div");
        body.className = "todo-body";

        var spanText = document.createElement("span");
        spanText.className = "todo-text";
        spanText.textContent = t.text;
        spanText.setAttribute("role", "button");
        spanText.setAttribute("tabindex", "0");
        spanText.setAttribute("aria-label", "Click to edit task: " + t.text);

        function enterEditMode() {
          if (li.classList.contains("editing")) return;
          li.classList.add("editing");
          var input = document.createElement("input");
          input.type = "text";
          input.className = "todo-text-input";
          input.value = t.text;
          input.maxLength = 120;

          function exitEdit(save) {
            var newVal = input.value.trim();
            if (save && newVal && newVal !== t.text) {
              t.text = newVal;
              spanText.textContent = newVal;
              spanText.setAttribute("aria-label", "Click to edit task: " + newVal);
              updateText(t.id, newVal);
            }
            li.classList.remove("editing");
            input.replaceWith(spanText);
          }

          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); exitEdit(true); }
            else if (e.key === "Escape") { e.preventDefault(); exitEdit(false); }
          });
          input.addEventListener("blur", function () { exitEdit(true); });

          spanText.replaceWith(input);
          input.focus();
          input.select();
        }

        spanText.addEventListener("click", enterEditMode);
        spanText.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enterEditMode(); }
        });

        body.appendChild(spanText);

        if (t.emoji) {
          var spanEmoji = document.createElement("span");
          spanEmoji.className = "todo-emoji-prefix";
          spanEmoji.textContent = t.emoji;
          body.insertBefore(spanEmoji, spanText);
        }

        if (t.date) {
          var spanDate = document.createElement("span");
          spanDate.className = "todo-date-badge";
          spanDate.textContent = formatDate(t.date);
          body.appendChild(spanDate);
        }

        if (t.priority && t.priority !== "medium") {
          var spanPri = document.createElement("span");
          spanPri.className = "todo-prio-badge " + t.priority;
          spanPri.textContent = t.priority;
          body.appendChild(spanPri);
        }

        var del = document.createElement("button");
        del.type = "button";
        del.className = "todo-delete";
        del.textContent = "×";
        del.setAttribute("aria-label", "Delete '" + t.text + "'");
        del.addEventListener("click", async function () {
          li.style.opacity = "0.45";
          await deleteTodo(t.id);
          await loadAndRender();
        });

        li.appendChild(cb);
        li.appendChild(body);
        li.appendChild(del);
        todoList.appendChild(li);
      });
    }

    var currentTodos = [];
    var cloudConnected = false;

    async function loadAndRender() {
      setStatus("Loading…", "info");
      setBusy(true);
      var result = await fetchTodos();
      currentTodos = result.todos;
      cloudConnected = result.cloud;
      renderList(currentTodos);
      setBusy(false);
      if (!supabase) {
        setStatus("Running in offline mode (Supabase SDK not loaded).", "info");
      } else if (!result.cloud) {
        setStatus("Offline — can't reach Supabase right now. Data saved locally until the connection is back.", "error");
      } else {
        setStatus("");
      }
    }

    // ---------- Submit ----------
    todoForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var text = todoText.value.trim();
      var date = todoDate.value;
      if (!text || !date) return;
      setBusy(true);
      var row = await insertTodo({
        text: text, date: date,
        priority: selectedPriority, emoji: selectedEmoji
      });
      todoText.value = "";
      todoText.focus();
      currentTodos.push(row);
      renderList(currentTodos);
      setBusy(false);
      if (!cloudConnected) {
        setStatus("Saved locally (can't reach Supabase). Will sync when reconnected.", "error");
      }
    });

    // Initial load
    loadAndRender();
  }
});
