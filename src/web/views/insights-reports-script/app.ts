export const insightsReportsScriptApp = `
    function wireGlobalEvents() {
      document.body.addEventListener("change", function(e) {
        if (!e || !e.target) return;
        if (e.target.id === "model-mode") {
          modelState.settings.mode_default = e.target.value === "agent" ? "agent" : e.target.value === "external" ? "external" : "local";
          renderModelConfigPanel();
          syncSelectHeader();
        }
      });

      document.body.addEventListener("input", function(e) {
        if (!e || !e.target) return;
        if (e.target.id === "model-api-key") {
          syncModelHint();
          syncSelectHeader();
        }
      });

      document.body.addEventListener("click", function(e) {
        var saveModelBtn = e.target.closest("#btn-save-model");
        if (saveModelBtn) {
          saveModelConfig();
          return;
        }
        var testModelBtn = e.target.closest("#btn-test-model");
        if (testModelBtn) {
          testModelConfig();
          return;
        }
        var viewBtn = e.target.closest(".view-report");
        if (viewBtn) {
          var card = viewBtn.closest(".report-card[data-report-id]");
          if (!card) return;
          var id = parseInt(card.getAttribute("data-report-id") || "0", 10);
          if (id > 0) openRoute("/insights/" + id);
          return;
        }
        var deleteBtn = e.target.closest(".delete-report");
        if (deleteBtn) {
          var cardDelete = deleteBtn.closest(".report-card[data-report-id]");
          if (!cardDelete) return;
          var idDelete = parseInt(cardDelete.getAttribute("data-report-id") || "0", 10);
          if (idDelete > 0) removeReport(idDelete);
          return;
        }
        var planToggleBtn = e.target.closest(".plan-toggle");
        if (planToggleBtn) {
          var planItem = planToggleBtn.closest(".plan-item[data-plan-id]");
          if (!planItem) return;
          var planId = planItem.getAttribute("data-plan-id") || "";
          var nextStatus = planToggleBtn.getAttribute("data-next-status") === "open" ? "open" : "done";
          if (!planId) return;
          planToggleBtn.disabled = true;
          api("/api/insights/tomorrow-plan/" + encodeURIComponent(planId), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          }).then(function() {
            status("Tomorrow plan updated.", "ok");
            renderListPage();
          }).catch(function(err) {
            status(err.message || "Failed to update tomorrow plan", "err");
          }).finally(function() {
            planToggleBtn.disabled = false;
          });
          return;
        }
        var planDeleteBtn = e.target.closest(".plan-delete");
        if (planDeleteBtn) {
          var planItemDelete = planDeleteBtn.closest(".plan-item[data-plan-id]");
          if (!planItemDelete) return;
          var planIdDelete = planItemDelete.getAttribute("data-plan-id") || "";
          if (!planIdDelete) return;
          if (!window.confirm("Delete this tomorrow plan item?")) return;
          planDeleteBtn.disabled = true;
          api("/api/insights/tomorrow-plan/" + encodeURIComponent(planIdDelete), {
            method: "DELETE",
          }).then(function() {
            status("Tomorrow plan item deleted.", "ok");
            renderListPage();
          }).catch(function(err) {
            status(err.message || "Failed to delete tomorrow plan item", "err");
          }).finally(function() {
            planDeleteBtn.disabled = false;
          });
          return;
        }
        var sourceTab = e.target.closest(".source-tab[data-source]");
        if (sourceTab) {
          insightState.sourceFilter = sourceTab.getAttribute("data-source") || "all";
          var tabHost = document.getElementById("source-tabs");
          if (tabHost) {
            tabHost.querySelectorAll(".source-tab").forEach(function(tab) { tab.classList.remove("active"); });
            sourceTab.classList.add("active");
          }
          var listHost = document.getElementById("candidate-list");
          if (listHost) listHost.innerHTML = renderCandidateList();
          return;
        }
        var candidate = e.target.closest(".candidate-card[data-session-id]");
        if (candidate) {
          var sid = parseInt(candidate.getAttribute("data-session-id") || "0", 10);
          if (!sid) return;
          if (insightState.selected.has(sid)) insightState.selected.delete(sid);
          else insightState.selected.add(sid);
          var listHostToggle = document.getElementById("candidate-list");
          if (listHostToggle) listHostToggle.innerHTML = renderCandidateList();
          syncSelectHeader();
          return;
        }
        var selectAllBtn = e.target.closest("#btn-select-all");
        if (selectAllBtn) {
          var filtered = (insightState.candidates || []).filter(function(item) {
            return insightState.sourceFilter === "all" || item.source === insightState.sourceFilter;
          });
          var allSelected = filtered.length > 0 && filtered.every(function(item) { return insightState.selected.has(item.id); });
          if (allSelected) {
            filtered.forEach(function(item) { insightState.selected.delete(item.id); });
          } else {
            filtered.forEach(function(item) { insightState.selected.add(item.id); });
          }
          var listHostSelectAll = document.getElementById("candidate-list");
          if (listHostSelectAll) listHostSelectAll.innerHTML = renderCandidateList();
          syncSelectHeader();
          return;
        }
        var generateBtn = e.target.closest("#btn-generate-report");
        if (generateBtn) {
          generateFromSelected();
          return;
        }
        var addTomorrowBtn = e.target.closest("#btn-add-tomorrow");
        if (addTomorrowBtn) {
          var action = safeText(addTomorrowBtn.getAttribute("data-action") || "").trim();
          var reportId = parseInt(addTomorrowBtn.getAttribute("data-report-id") || "0", 10) || null;
          if (!action) {
            status("Missing action text.", "err");
            return;
          }
          addTomorrowBtn.disabled = true;
          api("/api/insights/tomorrow-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: action, source_report_id: reportId }),
          }).then(function(out) {
            if (out && out.deduped) {
              status("Already in tomorrow plan.", "ok");
            } else {
              status("Added to tomorrow plan.", "ok");
            }
          }).catch(function(err) {
            status(err.message || "Failed to add tomorrow plan", "err");
          }).finally(function() {
            addTomorrowBtn.disabled = false;
          });
          return;
        }
        var tab = e.target.closest(".tab[data-tab]");
        if (tab) {
          var route = getRouteInfo();
          if (route.view !== "detail") return;
          insightState.tab = tab.getAttribute("data-tab") || "at_a_glance";
          renderDetailPage(route.id);
          return;
        }
        var copyBtn = e.target.closest(".copy-btn");
        if (copyBtn) {
          var parent = copyBtn.parentElement;
          if (!parent) return;
          var text = parent.textContent ? parent.textContent.replace("⧉", "").trim() : "";
          if (text && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
              status("Copied.", "ok");
            }).catch(function() {});
          }
        }
      });
    }

    function renderRoute() {
      var route = getRouteInfo();
      if (route.view === "new") {
        renderNewPageLayout();
        void Promise.all([loadModelConfig(), loadCandidates()]);
        return;
      }
      if (route.view === "detail") {
        if (!route.id) {
          renderRoot('<div class="empty">Invalid report id.</div>');
          return;
        }
        renderDetailPage(route.id);
        return;
      }
      renderListPage();
    }

    wireGlobalEvents();
    renderRoute();
`;
