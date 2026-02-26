# MongoDB Sample Collection (Full Cases)

This file provides MongoDB sample data that covers all payload cases currently supported by the backend parser.

## 1) Suggested collection

- `db`: `graph_viewer`
- `collection`: `graphs`
- `graph_id`: `sample_full_cases`

The backend reads data by `graph_id` using the `MONGO_GRAPH_ID` environment variable.

## 2) Mongosh script to create sample data

```javascript
use graph_viewer;

db.graphs.deleteOne({ graph_id: "sample_full_cases" });

db.graphs.insertOne({
  graph_id: "sample_full_cases",
  screens: [
    { screen_id: "home", imagePath: "/mock-screens/home.svg" },
    { screen_id: "settings", imagePath: "/mock-screens/settings.svg" },
    { screen_id: "search", imagePath: "/mock-screens/search.svg" },
    { screen_id: "profile", imagePath: "/mock-screens/profile.svg" },
    { screen_id: "diagnostics", imagePath: "/mock-screens/diagnostics.svg" },
    { screen_id: "error_modal", imagePath: "/mock-screens/error_modal.svg" },

    // Legacy-compatible screen case: no imagePath, using media.imageUrl
    { screen_id: "legacy_screen", media: { imageUrl: "/mock-screens/legacy_screen.svg" } }
  ],
  transitions: [
    // Case 1: full canonical format (action object + params object + conditionIds + weight)
    {
      transition_id: "t_home_settings_click",
      from_screen: "home",
      to_screen: "settings",
      conditionIds: ["cond_user_logged_in", "cond_vehicle_ready"],
      weight: 1,
      action: {
        type: "click",
        description: "Open settings",
        params: { entry: "main_menu", source: "home" }
      }
    },

    // Case 2: multi-edge on same from/to pair (transition_id needed for disambiguation)
    {
      transition_id: "t_home_settings_hardware",
      from_screen: "home",
      to_screen: "settings",
      conditionIds: [],
      weight: 2,
      action: {
        type: "hardware_button",
        description: "Open settings via hard key",
        params: { key: "MENU" }
      }
    },

    // Case 3: legacy fields (action_type/description/actionParams) still supported
    {
      transition_id: "t_search_settings_legacy",
      from_screen: "search",
      to_screen: "settings",
      action_type: "click",
      description: "Open settings from search (legacy format)",
      actionParams: { entry: "quick_setting", rank: "1" },
      weight: 2,
      conditionIds: ["cond_search_ready"]
    },

    // Case 4: action.params as key=value list (legacy-compatible)
    {
      transition_id: "t_settings_profile_params_list",
      from_screen: "settings",
      to_screen: "profile",
      weight: 1,
      action: {
        type: "click",
        description: "Open profile tab",
        params: ["tab=account", "mode=compact", "invalid_item_without_equal"]
      }
    },

    // Case 5: condition IDs in conditions.ids object
    {
      transition_id: "t_profile_home_conditions_obj",
      from_screen: "profile",
      to_screen: "home",
      conditions: { ids: ["cond_can_leave_profile"] },
      weight: 1,
      action: {
        type: "hardware_button",
        description: "Back to home",
        params: { button: "BACK" }
      }
    },

    // Case 6: single legacy condition_id merged into conditionIds
    {
      transition_id: "t_diagnostics_error_single_condition",
      from_screen: "diagnostics",
      to_screen: "error_modal",
      condition_id: "cond_fault_detected",
      weight: 3,
      action: {
        type: "auto",
        description: "Show error modal",
        params: { severity: "high" }
      }
    },

    // Case 7: metrics.weight used instead of top-level weight (legacy-compatible)
    {
      transition_id: "t_error_diagnostics_metrics_weight",
      from_screen: "error_modal",
      to_screen: "diagnostics",
      metrics: { weight: 4 },
      action: {
        type: "click",
        description: "Dismiss error modal",
        params: { confirm: "true" }
      }
    },

    // Case 8: transition without transition_id (backend auto-generates one)
    {
      from_screen: "home",
      to_screen: "legacy_screen",
      weight: 1,
      action: {
        type: "click",
        description: "Open legacy screen",
        params: { source: "demo" }
      }
    }
  ],
  conditions: [
    { condition_id: "cond_user_logged_in", name: "User Logged In", type: "boolean", value: "true" },
    { condition_id: "cond_vehicle_ready", name: "Vehicle Ready", type: "boolean", value: "true" },
    { condition_id: "cond_search_ready", name: "Search Ready", type: "boolean", value: "true" },
    { condition_id: "cond_can_leave_profile", name: "Can Leave Profile", type: "boolean", value: "true" },
    { condition_id: "cond_fault_detected", name: "Fault Detected", type: "boolean", value: "true" }
  ]
});
```

## 3) Backend config to load this sample

In `backend/.env`:

```env
GRAPH_DATA_SOURCE=mongodb
MONGO_URI=mongodb://localhost:27017
MONGO_DB=graph_viewer
MONGO_COLLECTION=graphs
MONGO_GRAPH_ID=sample_full_cases
```

## 4) Compatibility notes

- `screens[*].imagePath` is canonical; `media.imageUrl` is supported as fallback.
- `transitions[*].action` is canonical; legacy fields (`action_type`, `description`, `actionParams`, `condition_id`, `metrics.weight`) are still parsed.
- For multiple edges on the same `from_screen -> to_screen`, always include `transition_id`.
