# Tata Motors Smart Vehicle Key Management System (VKMS) – Frontend

React + Vite touchscreen kiosk prototype. The app has three top-level screens: operation selection, biometric verification for KEY IN, and the operation-specific workflow. KEY OUT uses EP-number lookup and does not ask for biometric verification.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173/`). The default `.env.example` uses demo mode. Demo mode is visibly labelled and does not operate physical hardware.

## Current workflows

### KEY OUT
1. Driver enters the vehicle EP number (the vehicle ID).
2. Backend looks up the vehicle, its recorded parking area, and the occupied key-holder slot.
3. The UI displays the parking area and slot; the backend/controller is asked to blink the slot indicator and unlock that holder.
4. A 30-second countdown starts after the unlock command is accepted. The controller must enforce its own 30-second safety timeout too.
5. The frontend polls holder state. It completes the transaction only after the slot sensor/RFID confirms key removal. If the timeout expires, it asks the controller to relock and does not complete the transaction.

### KEY IN
1. Driver completes biometric verification.
2. Driver ID and the driver's currently issued vehicle/EP number are loaded automatically.
3. Driver selects only the parking area where the vehicle was parked.
4. Backend allocates an empty, healthy holder slot automatically.
5. The frontend asks the controller to turn that slot's location LED ON.
6. The transaction completes only after the holder sensor/RFID confirms the correct key deposit. The indicator is then switched OFF.

The transaction screens intentionally show only operationally useful details. The backend remains the source of truth; frontend demo state is not production hardware integration.

## Environment

- `VITE_DEMO_MODE=true`: local simulated workflow; clearly labelled in the UI.
- `VITE_DEMO_MODE=false`: use the FastAPI service configured by `VITE_API_BASE_URL`.
- `VITE_API_BASE_URL`: backend origin, e.g. `http://127.0.0.1:8000`.
- `VITE_API_TOKEN`: prototype-only bearer token setting. Do not put long-lived privileged secrets in a public frontend build; use short-lived scoped sessions in production.
- `VITE_IDLE_TIMEOUT_MS`: idle timeout for the entry screens. Active key transactions are not interrupted by the UI idle timeout.

## Backend API contract expected by this frontend

All endpoints below are examples of the contract the FastAPI backend must implement. Adapt them to the actual database and controller firmware.

- `POST /api/biometric/verify` → `{ verified, driver: { driver_id } }` (KEY IN only)
- `GET /api/drivers/{driver_id}` → driver record including `driver_id`, `name`
- `GET /api/drivers/{driver_id}/vehicles?operation=KEY_IN` → array of vehicles; KEY IN must return the driver's currently issued vehicle, including `vehicle_id` (EP number), `key_id`
- `GET /api/parking-locations` → `[{ location_id, name }]`
- `GET /api/vehicles/by-ep/{ep_number}` → flat vehicle record including `vehicle_id` (same as EP number), `key_id`, `key_status`, `parking_location`, `slot_id`
- `POST /api/key-in/allocate-slot` body `{ vehicle_id, parking_location_id }` → `{ slot_id, allocation_id }`; allocation must be atomic and only choose an empty, healthy slot
- `POST /api/hardware/unlock` body `{ operation, slot_id, vehicle_id, indicator: "blink", timeout_seconds: 30 }` → accepted command
- `POST /api/hardware/guide-slot` body `{ operation, slot_id, vehicle_id, indicator: "on" | "off" }` → accepted command
- `POST /api/hardware/lock` body `{ slot_id, vehicle_id }` → accepted relock command
- `GET /api/slots/{slot_id}/state` → current physical state; for KEY OUT, `status: "available"` confirms removal; for KEY IN, `status: "occupied"` and matching `key_id` confirms deposit
- `POST /api/transactions/complete` body includes operation, vehicle_id, slot_id and (for KEY IN) driver_id, parking_location_id, allocation_id

## Hardware safety requirements

- The ESP32/controller must enforce the 30-second KEY OUT relock timeout independently of the browser.
- A browser timer is only a user display, never the safety mechanism.
- Never mark a key issued/deposited based only on an unlock, LED command, or button click.
- Confirm physical state using RFID and/or slot occupancy sensors; verify that the deposited RFID belongs to the expected key.
- Use authenticated, authorized, idempotent backend operations and prevent concurrent transactions on the same key/slot.
- On network loss or timeout, reconcile the physical holder state before changing database state. A failed UI request does not prove the physical lock is closed.

## GitHub Pages

The Vite `base` is configured as `/TATA/` for the public repository `hub-soham/TATA`. A GitHub Actions workflow is included at `.github/workflows/deploy.yml`. In repository Settings → Pages, set Source to **GitHub Actions**.
