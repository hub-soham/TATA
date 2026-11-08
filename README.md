# Tata Motors Smart Vehicle Key Management System — Kiosk Frontend

React + Tailwind touch-first kiosk UI for a 600 × 1024 portrait display.

## Run

Requires Node.js 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Build with `npm run build`.

## Demo vs real hardware

- `VITE_DEMO_MODE=true`: visibly displays **SIMULATION MODE** and uses sample driver, vehicle, parking and slot data. Fingerprint and lock/sensor responses are simulated. Never use this setting in production.
- `VITE_DEMO_MODE=false`: calls FastAPI endpoints configured by `VITE_API_BASE_URL`. The browser does not pretend to read a fingerprint scanner; it waits for backend biometric verification. The transaction is committed only after backend-reported slot state confirmation.

## Main pages

1. Main operation selection
2. Biometric verification
3. Smart key workflow (KEY IN / KEY OUT are steps within this page)

## FastAPI contract expected

JSON endpoints; optionally sends `Authorization: Bearer <VITE_API_TOKEN>`:

| Method | Endpoint | Expected response / purpose |
|---|---|---|
| POST | `/api/biometric/verify` | `{verified, driver, session_token}`; resolve real fingerprint event |
| GET | `/api/drivers/{driver_id}` | Driver details |
| GET | `/api/drivers/{driver_id}/vehicles?operation=KEY_IN` | Eligible vehicle list for operation |
| GET | `/api/parking-locations` | Array of `{location_id,name,available_spaces,occupied_spaces}` |
| GET | `/api/slots` | Array of `{slot_id,status,key_id}`; status available/occupied/faulty |
| POST | `/api/key-in/allocate-slot` | `{vehicle_id,parking_location_id,slot_id}` → `{slot_id,allocation_id}` |
| POST | `/api/hardware/unlock` | `{operation,slot_id,vehicle_id}` → `{accepted,command_id}` |
| GET | `/api/slots/{slot_id}/state` | Confirmed physical state, e.g. `{status:'occupied'}` |
| POST | `/api/transactions/complete` | Commit after confirmed movement; returns transaction receipt |

For KEY OUT, selected occupied slot must contain the selected vehicle's key ID. For KEY IN, only an available slot may be reserved. The backend/controller must independently enforce all rules; frontend validation is not a security boundary.

## Production integration requirements

- Connect the fingerprint reader to a trusted local controller/service. A normal browser cannot directly and securely read a UART/USB fingerprint module. The scanner/backend must perform the actual biometric match and return an authenticated driver identity.
- ESP32/key-holder controller must report RFID UID and occupancy/removal events to FastAPI. Backend validates the expected UID, slot, reservation, driver authorization and transaction before updating state.
- Use WebSocket/SSE events for production rather than polling; current frontend has a 30-second slot-state polling fallback.
- Enforce API authentication, authorization, idempotency, database transactions/locking, duplicate-issue prevention, slot reservation, audit logs, timeout recovery and safe reconciliation after network/power loss.
- Do not put a long-lived privileged API secret in browser code in production. Use short-lived scoped kiosk sessions.
- The frontend intentionally does not offer manual EP number entry or a numeric keypad.
