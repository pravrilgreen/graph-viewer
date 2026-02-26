"""
Seed script to populate the graph with sample data
"""

import json

def build_seed_data():
    screen_ids = [
        "home",
        "nav_menu",
        "search",
        "settings",
        "profile",
        "notifications",
        "help_center",
        "display_settings",
        "audio_settings",
        "connectivity_settings",
        "privacy_settings",
        "vehicle_settings",
        "media_player",
        "phone",
        "messages",
        "calendar",
        "camera",
        "navigation",
        "trip_planner",
        "charging_map",
        "climate_control",
        "energy_dashboard",
        "drive_modes",
        "confirmation",
        "error_modal",
        "onboarding",
        "wifi_setup",
        "bluetooth_pairing",
        "update_center",
        "diagnostics",
        "dummy_screen_1",
        "dummy_screen_2",
    ]

    screens = [{"screen_id": screen_id, "imagePath": f"/mock-screens/{screen_id}.svg"} for screen_id in screen_ids]

    transitions = []
    default_condition_ids = ["condition_id_1", "condition_id_2"]

    def add_transition(
        from_screen,
        to_screen,
        action_type,
        description,
        weight=1,
        condition_ids=None,
        action_params=None,
    ):
        params = {}
        for raw in action_params or []:
            if "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            key = key.strip()
            value = value.strip()
            if key:
                params[key] = value

        if "param1" not in params:
            params["param1"] = "value1"
        if "param2" not in params:
            params["param2"] = "value2"

        transitions.append(
            {
                "from_screen": from_screen,
                "to_screen": to_screen,
                "conditionIds": list(dict.fromkeys([*default_condition_ids, *(condition_ids or [])])),
                "weight": weight,
                "action": {
                    "type": action_type,
                    "description": description,
                    "params": params,
                },
            }
        )

    for entry in [
        "nav_menu",
        "search",
        "settings",
        "media_player",
        "phone",
        "navigation",
        "climate_control",
        "notifications",
        "profile",
    ]:
        add_transition("home", entry, "click", f"Open {entry}")
        add_transition(entry, "home", "hardware_button", "Back to home")

    for section in [
        "navigation",
        "trip_planner",
        "charging_map",
        "media_player",
        "phone",
        "messages",
        "calendar",
        "camera",
        "help_center",
        "update_center",
        "diagnostics",
    ]:
        add_transition("nav_menu", section, "click", f"Navigate to {section}")

    add_transition("search", "navigation", "click", "Open route result", 2, ["search_query_ready"], ["result_index=0"])
    add_transition("search", "phone", "click", "Call contact from search", 2, ["contact_has_phone"], ["contact_type=mobile"])
    add_transition("search", "settings", "click", "Open settings from search", 2, [], ["entry=quick_setting"])
    add_transition("nav_menu", "settings", "click", "Navigate to settings")

    for sub in [
        "audio_settings",
        "connectivity_settings",
        "display_settings",
    ]:
        add_transition("settings", sub, "click", f"Open {sub}")
        add_transition(sub, "settings", "click", "Back to settings")

    add_transition("connectivity_settings", "wifi_setup", "click", "Configure Wi-Fi", 1, ["wifi_available"], ["source=connectivity"])
    add_transition("connectivity_settings", "bluetooth_pairing", "click", "Pair Bluetooth", 1, ["bluetooth_enabled"], ["pair_mode=manual"])
    add_transition("wifi_setup", "connectivity_settings", "click", "Save Wi-Fi setup")
    add_transition("bluetooth_pairing", "connectivity_settings", "click", "Finish Bluetooth pairing")

    add_transition("vehicle_settings", "drive_modes", "click", "Set drive mode", 1, ["vehicle_in_park"], ["mode_target=sport"])
    add_transition("vehicle_settings", "energy_dashboard", "click", "Open energy dashboard")
    add_transition("drive_modes", "vehicle_settings", "click", "Back to vehicle settings")

    add_transition("media_player", "phone", "swipe", "Swipe to phone widget")
    add_transition("phone", "media_player", "swipe", "Swipe to media widget")
    add_transition("phone", "messages", "click", "Open recent message")
    add_transition("messages", "phone", "hardware_button", "Back to phone")
    add_transition("messages", "calendar", "click", "Schedule from message")
    add_transition("calendar", "navigation", "click", "Navigate to event", 2, ["event_has_location"], ["route_mode=fastest"])

    add_transition("navigation", "trip_planner", "click", "Open planner")
    add_transition("trip_planner", "navigation", "click", "Start navigation")
    add_transition("navigation", "charging_map", "click", "Find charging station")
    add_transition("charging_map", "navigation", "click", "Route to station")
    add_transition("charging_map", "energy_dashboard", "click", "Show charging stats")

    add_transition("climate_control", "energy_dashboard", "swipe", "Swipe to energy panel")
    add_transition("energy_dashboard", "climate_control", "swipe", "Back to climate panel")

    add_transition("dummy_screen_1", "dummy_screen_2", "swipe", "Go to dummy screen 2")
    add_transition(
        "dummy_screen_1",
        "dummy_screen_2",
        "click",
        "Open dummy screen 2 via shortcut",
        2,
        ["shortcut_enabled"],
        ["entry=shortcut_button"],
    )
    add_transition(
        "dummy_screen_1",
        "dummy_screen_2",
        "hardware_button",
        "Jump to dummy screen 2 via hardware key",
        3,
        ["hardware_key_mapped"],
        ["key=F1"],
    )
    add_transition("dummy_screen_2", "dummy_screen_1", "swipe", "Back to dummy screen 1")
    add_transition(
        "dummy_screen_2",
        "dummy_screen_1",
        "click",
        "Return to dummy screen 1 from quick action",
        2,
        ["quick_action_available"],
        ["entry=quick_return"],
    )
    add_transition(
        "dummy_screen_2",
        "dummy_screen_1",
        "hardware_button",
        "Return to dummy screen 1 via hardware key",
        3,
        ["hardware_key_mapped"],
        ["key=F2"],
    )

    add_transition("onboarding", "wifi_setup", "click", "Setup internet first")
    add_transition("onboarding", "home", "click", "Skip onboarding")
    add_transition("update_center", "confirmation", "click", "Confirm update")
    add_transition("confirmation", "update_center", "hardware_button", "Back to update center")
    add_transition(
        "diagnostics",
        "error_modal",
        "auto",
        "Trigger issue screen",
        3,
        ["fault_detected", "severity_high"],
        ["modal=critical_fault"],
    )
    add_transition("error_modal", "diagnostics", "click", "Dismiss issue panel")
    add_transition("error_modal", "help_center", "click", "Open troubleshooting")
    add_transition("help_center", "home", "hardware_button", "Return to home")

    return {"screens": screens, "transitions": transitions}


SEED_DATA = build_seed_data()


def create_seed_file():
    """Create seed data JSON file"""
    with open("graph_data.json", "w") as f:
        json.dump(SEED_DATA, f, indent=2)
    print("Seed data created: graph_data.json")


if __name__ == "__main__":
    create_seed_file()
