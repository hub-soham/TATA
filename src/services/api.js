const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export const DEMO = import.meta.env.VITE_DEMO_MODE === 'true';
const TOKEN = import.meta.env.VITE_API_TOKEN || '';
async function req(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw Error(data?.detail || data?.message || `API error ${response.status}`);
  return data;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const driver = { driver_id: 'DRV-1042', name: 'Aarav Patil', ep_number: 'EP003', biometric_status: 'verified' };
const vehicles = [
  { vehicle_id: 'EP001', model: 'Tata Signa', registration_number: 'MH 14 KT 4821', key_id: 'KEY-001', status: 'Parked', parking_location: 'Parking Zone A', slot_id: '01', key_status: 'Available' },
  { vehicle_id: 'EP002', model: 'Tata Prima', registration_number: 'MH 14 LT 2190', key_id: 'KEY-002', status: 'Parked', parking_location: 'Parking Zone B', slot_id: '02', key_status: 'Available' },
  { vehicle_id: 'EP003', model: 'Tata Intra V30', registration_number: 'MH 14 MT 7362', key_id: 'KEY-003', status: 'In Use', parking_location: 'Parking Zone C', slot_id: '03', key_status: 'Issued' },
  { vehicle_id: 'EP004', model: 'Tata Coral Ace', registration_number: 'MH 14 NT 9004', key_id: 'KEY-004', status: 'Parked', parking_location: 'Parking Zone D', slot_id: '04', key_status: 'Available' },
  { vehicle_id: 'EP005', model: 'Tata LPT 1212', registration_number: 'MH 14 PT 5520', key_id: 'KEY-005', status: 'Parked', parking_location: 'Parking Zone A', slot_id: '05', key_status: 'Available' },
];
const parking = [
  { location_id: 'PZA', name: 'Parking Zone A' }, { location_id: 'PZB', name: 'Parking Zone B' },
  { location_id: 'PZC', name: 'Parking Zone C' }, { location_id: 'PZD', name: 'Parking Zone D' },
];
let slots = [
  { slot_id: '01', status: 'occupied', key_id: 'KEY-001' }, { slot_id: '02', status: 'occupied', key_id: 'KEY-002' },
  { slot_id: '03', status: 'available', key_id: null }, { slot_id: '04', status: 'occupied', key_id: 'KEY-004' },
  { slot_id: '05', status: 'occupied', key_id: 'KEY-005' },
];
let transactionNumber = 2400;
const findVehicle = id => vehicles.find(v => v.vehicle_id === id);
export const api = {
  async verifyBiometric({ signal }) {
    if (!DEMO) return req('/api/biometric/verify', { method: 'POST', body: { operation: 'KEY_IN' }, signal });
    await pause(900); return { verified: true, driver, session_token: 'DEMO-ONLY' };
  },
  async getDriver(id) { if (!DEMO) return req(`/api/drivers/${encodeURIComponent(id)}`); await pause(100); return driver; },
  async getEligibleVehicles(id, operation) { if (!DEMO) return req(`/api/drivers/${encodeURIComponent(id)}/vehicles?operation=${operation}`); await pause(100); return vehicles.filter(v => operation === 'KEY_IN' ? v.key_status === 'Issued' : v.key_status === 'Available'); },
  async getVehicleByEP(ep) {
    if (!DEMO) return req(`/api/vehicles/by-ep/${encodeURIComponent(ep)}`);
    await pause(250);
    const vehicle = findVehicle(ep);
    if (!vehicle) throw Error('EP number not found. Check the number and try again.');
    const holder = slots.find(s => s.key_id === vehicle.key_id && s.status === 'occupied');
    if (!holder) throw Error('The key is not currently present in a holder slot.');
    return { ...vehicle, slot_id: holder.slot_id };
  },
  async getParkingLocations() { if (!DEMO) return req('/api/parking-locations'); return parking; },
  async getSlots() { if (!DEMO) return req('/api/slots'); return slots.map(s => ({ ...s })); },
  async allocateSlot(payload) {
    if (!DEMO) return req('/api/key-in/allocate-slot', { method: 'POST', body: payload });
    await pause(250);
    const free = slots.find(s => s.status === 'available');
    if (!free) throw Error('No empty holder slot available.');
    return { slot_id: free.slot_id, allocation_id: `DEMO-ALLOC-${Date.now()}` };
  },
  async requestUnlock(payload) { if (!DEMO) return req('/api/hardware/unlock', { method: 'POST', body: payload }); await pause(300); return { accepted: true, command_id: `DEMO-CMD-${Date.now()}` }; },
  async requestSlotGuide(payload) { if (!DEMO) return req('/api/hardware/guide-slot', { method: 'POST', body: payload }); await pause(250); return { accepted: true, indicator: 'on' }; },
  async lockSlot(payload) { if (!DEMO) return req('/api/hardware/lock', { method: 'POST', body: payload }); return { accepted: true }; },
  async waitForHardwareConfirmation({ operation, slot_id, vehicle_id, expected_key_id, timeoutMs = 30000, signal }) {
    if (!DEMO) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        const state = await req(`/api/slots/${encodeURIComponent(slot_id)}/state`, { signal });
        const confirmed = operation === 'KEY_IN' ? state.status === 'occupied' && (!state.key_id || state.key_id === expected_key_id) : state.status === 'available';
        if (confirmed) return { confirmed: true, ...state };
        await pause(500);
      }
      throw Error('Hardware confirmation timed out. The transaction was not completed.');
    }
    await pause(operation === 'KEY_OUT' ? 4500 : 3500);
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const vehicle = findVehicle(vehicle_id);
    slots = slots.map(s => s.slot_id === slot_id ? { ...s, status: operation === 'KEY_IN' ? 'occupied' : 'available', key_id: operation === 'KEY_IN' ? vehicle?.key_id : null } : s);
    if (vehicle) vehicle.key_status = operation === 'KEY_IN' ? 'Available' : 'Issued';
    return { confirmed: true, status: operation === 'KEY_IN' ? 'occupied' : 'available' };
  },
  async completeTransaction(payload) {
    if (!DEMO) return req('/api/transactions/complete', { method: 'POST', body: payload });
    await pause(150);
    const vehicle = findVehicle(payload.vehicle_id);
    if (vehicle) {
      vehicle.key_status = payload.operation === 'KEY_IN' ? 'Available' : 'Issued';
      vehicle.status = payload.operation === 'KEY_IN' ? 'Parked' : 'In Use';
      if (payload.operation === 'KEY_IN') vehicle.parking_location = parking.find(p => p.location_id === payload.parking_location_id)?.name || vehicle.parking_location;
    }
    return { transaction_id: `TXN-${++transactionNumber}`, completed_at: new Date().toISOString(), key_status: payload.operation === 'KEY_IN' ? 'Available' : 'Issued', vehicle_status: payload.operation === 'KEY_IN' ? 'Parked' : 'In Use' };
  },
};
