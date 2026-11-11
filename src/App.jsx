import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, Fingerprint, KeyRound, LockKeyhole, MapPin, Radio, ShieldCheck, Truck, UnlockKeyhole, X } from 'lucide-react';
import { api, DEMO } from './services/api';

const time = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const date = () => new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

function Header({ op, back }) {
  const [clock, setClock] = useState({ t: time(), d: date() });
  useEffect(() => { const id = setInterval(() => setClock({ t: time(), d: date() }), 1000); return () => clearInterval(id); }, []);
  return <header className="bg-[#071b36] text-white px-5 pt-5 pb-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3">{back && <button onClick={back} className="h-12 w-12 rounded-xl bg-white/10 grid place-items-center" aria-label="Back"><ArrowLeft /></button>}<div className="h-11 w-11 rounded-xl bg-white text-[#071b36] grid place-items-center font-black text-xs">TATA</div><div><b className="tracking-[.14em] text-sm">TATA MOTORS</b><div className="text-[10px] tracking-widest text-blue-200">SMART KEY MANAGEMENT</div></div></div><div className="text-right"><b className="text-lg tabular-nums">{clock.t}</b><div className="text-[10px] text-blue-200">{clock.d}</div></div></div>{op && <div className="flex justify-between border-t border-white/15 mt-4 pt-3 text-xs"><span className="text-blue-200">CURRENT OPERATION</span><b>{op.replace('_', ' ')}</b></div>}</header>;
}
function DemoTag() { return DEMO ? <div className="mx-5 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex gap-2 text-amber-800 text-[11px] font-extrabold"><Radio size={15} /> SIMULATION MODE — NO REAL HARDWARE ACTIONS</div> : null; }
function Title({ eyebrow, title, sub }) { return <div className="mb-4"><div className="text-[10px] font-extrabold tracking-[.18em] text-blue-700">{eyebrow}</div><h1 className="text-[25px] leading-tight font-extrabold mt-1">{title}</h1>{sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}</div>; }
function Btn({ children, onClick, disabled, secondary = false }) { return <button disabled={disabled} onClick={onClick} className={`w-full min-h-[54px] rounded-xl px-4 py-3 flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-40 ${secondary ? 'bg-white border border-slate-300 text-[#10233f]' : 'bg-[#0b4a85] text-white'}`}>{children}</button>; }
function Main({ choose }) { return <div className="kiosk min-h-[100dvh] flex flex-col"><Header /><DemoTag /><main className="px-5 pt-7 pb-6 flex-1 flex flex-col"><div className="mb-6"><div className="text-[11px] font-extrabold tracking-[.2em] text-blue-700">FACILITY ACCESS TERMINAL</div><h1 className="text-[27px] font-extrabold leading-tight mt-2">Smart Vehicle Key<br />Management System</h1><p className="text-sm text-slate-500 mt-2">Select an operation to continue.</p></div><div className="space-y-4 flex-1"><Operation op="KEY OUT" desc="Collect vehicle key" icon={KeyRound} click={() => choose('KEY_OUT')} /><Operation op="KEY IN" desc="Deposit vehicle key" icon={LockKeyhole} click={() => choose('KEY_IN')} /></div><div className="mt-5 text-center text-[10px] text-slate-400">TATA MOTORS • AUTHORISED PERSONNEL ONLY</div></main></div>; }
function Operation({ op, desc, icon: Icon, click }) { return <button onClick={click} className="w-full min-h-[190px] rounded-2xl border border-slate-200 bg-white shadow-sm p-5 text-left flex flex-col justify-between"><div className="flex justify-between"><div className="h-16 w-16 rounded-2xl bg-blue-50 text-[#0b4a85] grid place-items-center"><Icon size={34} /></div><div className="h-10 w-10 rounded-full bg-slate-50 grid place-items-center"><ArrowRight /></div></div><div><b className="text-2xl tracking-wide">{op}</b><p className="text-sm text-slate-500 mt-1">{desc}</p></div><div className="min-h-12 rounded-xl bg-[#0b4a85] text-white flex items-center justify-center gap-2 font-bold text-sm">CONTINUE <ArrowRight size={18} /></div></button>; }

function KeyOut({ back, reset }) {
  const [ep, setEp] = useState('');
  const [record, setRecord] = useState(null);
  const [seconds, setSeconds] = useState(30);
  const [status, setStatus] = useState('entry');
  const [error, setError] = useState('');
  const busy = useRef(false);
  const abort = useRef(null);

  useEffect(() => {
    if (status !== 'collecting') return;
    const endAt = Date.now() + 30000;
    const tick = () => setSeconds(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => () => abort.current?.abort(), []);

  const findAndUnlock = async () => {
    if (!ep.trim() || busy.current) return;
    let foundRecord = null;
    busy.current = true; setError(''); setStatus('loading');
    try {
      const found = await api.getVehicleByEP(ep.trim().toUpperCase());
      foundRecord = found;
      if (!found?.vehicle_id || !found?.slot_id) throw new Error('Vehicle key location was not found. Contact the administrator.');
      if ((found.key_status || '').toLowerCase() === 'issued') throw new Error('This vehicle key is already issued.');
      setRecord(found);
      await api.requestUnlock({ operation: 'KEY_OUT', slot_id: found.slot_id, vehicle_id: found.vehicle_id, indicator: 'blink', timeout_seconds: 30 });
      setSeconds(30); setStatus('collecting');
      abort.current = new AbortController();
      const result = await api.waitForHardwareConfirmation({ operation: 'KEY_OUT', slot_id: found.slot_id, vehicle_id: found.vehicle_id, expected_key_id: found.key_id, timeoutMs: 30000, signal: abort.current.signal });
      if (result?.confirmed) {
        await api.requestSlotGuide({ operation: 'KEY_OUT', slot_id: found.slot_id, vehicle_id: found.vehicle_id, indicator: 'off' });
        const transaction = await api.completeTransaction({ operation: 'KEY_OUT', vehicle_id: found.vehicle_id, slot_id: found.slot_id });
        setRecord(prev => ({ ...prev, transaction })); setStatus('success');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        if (status === 'collecting' || seconds === 0 || /timed out/i.test(e.message)) {
          try { await api.lockSlot({ slot_id: foundRecord?.slot_id, vehicle_id: foundRecord?.vehicle_id }); await api.requestSlotGuide({ operation: 'KEY_OUT', slot_id: foundRecord?.slot_id, vehicle_id: foundRecord?.vehicle_id, indicator: 'off' }); } catch { /* controller must enforce its own timeout and physical-state reconciliation */ }
          setStatus('timeout'); setError('30 seconds expired. The key was not confirmed as removed. The holder has been instructed to relock.');
        } else { setStatus('entry'); setError(e.message || 'Unable to start key collection.'); }
      }
    } finally { busy.current = false; }
  };

  return <div className="kiosk min-h-[100dvh] flex flex-col"><Header op="KEY_OUT" back={status === 'entry' || status === 'timeout' ? back : undefined} /><DemoTag /><main className="px-5 pt-6 pb-6 flex-1 flex flex-col">
    {status === 'entry' && <><Title eyebrow="VEHICLE KEY COLLECTION" title="Enter vehicle EP number" sub="Use the EP number printed on the vehicle identification." /><div className="space-y-4"><label className="block text-xs font-extrabold tracking-wide text-slate-600">VEHICLE EP NUMBER<input autoFocus value={ep} onChange={e => setEp(e.target.value.toUpperCase())} placeholder="e.g. EP001" onKeyDown={e => { if (e.key === 'Enter') findAndUnlock(); }} className="mt-2 w-full h-16 rounded-xl border-2 border-slate-300 px-4 text-2xl font-bold tracking-wider uppercase focus:border-blue-600 focus:outline-none" /></label><Btn disabled={!ep.trim()} onClick={findAndUnlock}>FIND KEY LOCATION <ArrowRight size={18} /></Btn></div></>}
    {status === 'loading' && <div className="flex-1 grid place-items-center text-center"><div><div className="animate-spin h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-700 mx-auto" /><h2 className="font-bold text-lg mt-4">Finding your vehicle key…</h2></div></div>}
    {status === 'collecting' && record && <><Title eyebrow="KEY LOCATION FOUND" title="Collect your vehicle key" sub="The matching holder is blinking and unlocked." /><section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center"><MapPin className="mx-auto text-blue-800" size={30} /><div className="text-xs font-extrabold tracking-widest text-blue-800 mt-2">VEHICLE PARKED AT</div><div className="text-xl font-extrabold mt-1">{record.parking_location || record.parking_area || 'Parking location unavailable'}</div><div className="border-t border-blue-200 my-4" /><div className="text-xs font-extrabold tracking-widest text-blue-800">COLLECT KEY FROM</div><div className="text-5xl font-black text-[#0b4a85] mt-2">SLOT {record.slot_id}</div><div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-blue-800"><span className="h-3 w-3 rounded-full bg-blue-600 animate-ping" /> LED BLINKING · LOCK OPEN</div></section><div className="text-center py-5"><div className="text-xs font-extrabold tracking-widest text-slate-500">TIME TO REMOVE KEY</div><div className={`text-6xl font-black tabular-nums mt-2 ${seconds <= 10 ? 'text-red-600' : 'text-[#0b4a85]'}`}>00:{String(seconds).padStart(2, '0')}</div></div><p className="text-center text-sm text-slate-600">Remove the key from the blinking slot now.</p></>}
    {status === 'success' && <div className="flex-1 flex flex-col justify-center"><div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center"><CheckCircle2 size={54} className="mx-auto text-emerald-700" /><h2 className="text-xl font-extrabold mt-3">Key collected successfully</h2><p className="text-sm text-emerald-800 mt-2">Key removal was confirmed by the holder sensor.</p><p className="font-bold mt-3">{record?.vehicle_id} · SLOT {record?.slot_id}</p></div><div className="mt-5"><Btn onClick={reset}>DONE</Btn></div></div>}
    {status === 'timeout' && <><div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center"><CircleAlert size={42} className="mx-auto text-amber-700" /><h2 className="text-lg font-extrabold mt-3">Collection timed out</h2><p className="text-sm text-amber-900 mt-2">{error}</p></div><div className="mt-5 space-y-3"><Btn onClick={() => { setStatus('entry'); setRecord(null); setEp(''); setError(''); }}>TRY AGAIN</Btn><Btn secondary onClick={reset}>DONE</Btn></div></>}
    {error && status === 'entry' && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2"><CircleAlert size={18} />{error}</div>}
  </main></div>;
}

function Biometric({ back, verified }) {
  const [state, setState] = useState('waiting'); const [err, setErr] = useState(''); const ctrl = useRef();
  const scan = async () => { setErr(''); setState('detected'); await new Promise(r => setTimeout(r, 450)); setState('verifying'); try { ctrl.current = new AbortController(); const result = await api.verifyBiometric({ operation: 'KEY_IN', signal: ctrl.current.signal }); if (!result?.verified || !result.driver?.driver_id) throw new Error('Identity could not be verified.'); const driver = await api.getDriver(result.driver.driver_id); const vehicles = await api.getEligibleVehicles(driver.driver_id, 'KEY_IN'); if (!vehicles.length) throw new Error('No vehicle currently assigned to this driver for return.'); verified({ driver, vehicle: vehicles[0] }); } catch (e) { if (e.name !== 'AbortError') { setState(e.message.toLowerCase().includes('scanner') ? 'disconnected' : 'failed'); setErr(e.message); } } };
  useEffect(() => () => ctrl.current?.abort(), []);
  const status = { waiting: 'Waiting for fingerprint', detected: 'Fingerprint detected', verifying: 'Verifying identity', failed: 'Verification failed', disconnected: 'Scanner disconnected' };
  return <div className="kiosk min-h-[100dvh] flex flex-col"><Header op="KEY_IN" back={back} /><DemoTag /><main className="px-5 pt-6 pb-6 flex-1 flex flex-col"><Title eyebrow="SECURE KEY RETURN" title="Driver verification" sub="Place your finger on the fingerprint scanner." /><section className="bg-white border border-slate-200 rounded-2xl p-5 text-center"><div className="relative h-48 w-48 mx-auto rounded-full bg-blue-50 border border-blue-100 grid place-items-center overflow-hidden">{['detected', 'verifying'].includes(state) && <div className="absolute inset-5 rounded-full border-2 border-blue-300 animate-pulse" />}<Fingerprint size={104} strokeWidth={1.2} className="text-[#0b4a85]" />{state === 'verifying' && <div className="absolute left-5 right-5 h-1 bg-cyan-400" />}</div><h2 className="font-extrabold text-xl mt-5">{state === 'success' ? 'Verification successful' : status[state]}</h2><p className="text-sm text-slate-500 mt-2">{state === 'failed' || state === 'disconnected' ? err : 'Your identity will be checked before key return.'}</p>{DEMO && <button disabled={['detected', 'verifying'].includes(state)} onClick={scan} className="mt-5 w-full min-h-[52px] rounded-xl bg-[#0b4a85] text-white font-bold disabled:opacity-50">{state === 'waiting' ? 'SIMULATE FINGERPRINT' : state === 'failed' || state === 'disconnected' ? 'TRY AGAIN' : 'SCANNING…'}</button>}{!DEMO && <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 text-left">Waiting for a physical scanner event from the backend. The fingerprint graphic does not perform biometric verification.</div>}</section><div className="mt-auto pt-5"><Btn secondary onClick={back}><X size={17} /> CANCEL OPERATION</Btn></div></main></div>;
}

function KeyIn({ data, reset }) {
  const [parking, setParking] = useState([]); const [parkingId, setParkingId] = useState(''); const [slot, setSlot] = useState(''); const [status, setStatus] = useState('select'); const [error, setError] = useState(''); const [txn, setTxn] = useState(null); const abort = useRef();
  useEffect(() => { let live = true; api.getParkingLocations().then(p => { if (live) setParking(p); }).catch(e => setError(e.message)); return () => { live = false; abort.current?.abort(); }; }, []);
  const startDeposit = async () => {
    setError(''); setStatus('allocating');
    try {
      const assigned = await api.allocateSlot({ vehicle_id: data.vehicle.vehicle_id, parking_location_id: parkingId });
      const target = assigned.slot_id; if (!target) throw new Error('No available key holder slot was returned.'); setSlot(target);
      await api.requestSlotGuide({ operation: 'KEY_IN', slot_id: target, vehicle_id: data.vehicle.vehicle_id, indicator: 'on' });
      setStatus('depositing'); abort.current = new AbortController();
      await api.waitForHardwareConfirmation({ operation: 'KEY_IN', slot_id: target, vehicle_id: data.vehicle.vehicle_id, expected_key_id: data.vehicle.key_id, signal: abort.current.signal });
      await api.requestSlotGuide({ operation: 'KEY_IN', slot_id: target, vehicle_id: data.vehicle.vehicle_id, indicator: 'off' });
      const completed = await api.completeTransaction({ operation: 'KEY_IN', driver_id: data.driver.driver_id, vehicle_id: data.vehicle.vehicle_id, slot_id: target, parking_location_id: parkingId, allocation_id: assigned.allocation_id });
      setTxn(completed); setStatus('success');
    } catch (e) { if (e.name !== 'AbortError') { setError(e.message || 'Key deposit could not be confirmed.'); setStatus('error'); } }
  };
  const selectedParking = parking.find(p => p.location_id === parkingId);
  return <div className="kiosk min-h-[100dvh] flex flex-col"><Header op="KEY_IN" back={status === 'select' || status === 'error' ? reset : undefined} /><DemoTag /><main className="px-5 pt-6 pb-6 flex-1 flex flex-col">
    {status === 'select' && <><Title eyebrow="VEHICLE KEY RETURN" title="Where have you parked?" sub="Your driver and vehicle details have been retrieved." /><section className="rounded-xl border border-slate-200 bg-white p-4 mb-4"><div className="flex items-center gap-2 text-emerald-700 text-xs font-extrabold"><ShieldCheck size={16} /> DRIVER VERIFIED</div><div className="mt-2 text-sm"><b>{data.driver.name}</b><div className="text-slate-500">Driver ID: {data.driver.driver_id}</div><div className="text-slate-500">Vehicle ID: {data.vehicle.vehicle_id}</div></div></section><label className="block text-xs font-extrabold tracking-wide text-slate-600">PARKING AREA<select value={parkingId} onChange={e => setParkingId(e.target.value)} className="mt-2 w-full h-14 rounded-xl border-2 border-slate-300 px-3 text-base font-semibold bg-white"><option value="">Select parking area</option>{parking.map(p => <option key={p.location_id} value={p.location_id}>{p.name}</option>)}</select></label><div className="mt-5"><Btn disabled={!parkingId} onClick={startDeposit}>SHOW KEY HOLDER LOCATION <ArrowRight size={18} /></Btn></div></>}
    {status === 'allocating' && <div className="flex-1 grid place-items-center text-center"><div className="animate-spin h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-700" /><p className="font-bold mt-4">Allocating an available key holder…</p></div>}
    {status === 'depositing' && <><Title eyebrow="KEY RETURN LOCATION" title="Place your key here" sub="The assigned holder indicator is ON." /><section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><MapPin className="mx-auto text-emerald-800" size={30} /><div className="text-xs font-extrabold tracking-widest text-emerald-800 mt-2">YOUR VEHICLE PARKING AREA</div><div className="text-lg font-extrabold mt-1">{selectedParking?.name}</div><div className="border-t border-emerald-200 my-4" /><div className="text-xs font-extrabold tracking-widest text-emerald-800">INSERT KEY INTO</div><div className="text-5xl font-black text-emerald-900 mt-2">SLOT {slot}</div><div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-emerald-800"><span className="h-3 w-3 rounded-full bg-emerald-600" /> LOCATION LED ON</div></section><p className="text-center text-sm text-slate-600 mt-5">Insert the key into the illuminated holder. The system will detect it automatically.</p><div className="mt-5 flex items-center justify-center gap-2 text-blue-800 text-sm font-bold"><LockKeyhole size={18} /> Waiting for key deposit confirmation…</div></>}
    {status === 'success' && <div className="flex-1 flex flex-col justify-center"><div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center"><CheckCircle2 size={54} className="mx-auto text-emerald-700" /><h2 className="text-xl font-extrabold mt-3">Key returned successfully</h2><p className="text-sm text-emerald-800 mt-2">The correct key was detected in the assigned holder.</p><p className="font-bold mt-3">{data.vehicle.vehicle_id} · SLOT {slot}</p><p className="text-sm text-slate-600">{selectedParking?.name}</p><p className="text-xs text-slate-500 mt-2">Transaction: {txn?.transaction_id || '—'}</p></div><div className="mt-5"><Btn onClick={reset}>DONE</Btn></div></div>}
    {status === 'error' && <><div className="rounded-xl border border-red-200 bg-red-50 text-red-800 p-4 text-sm flex gap-2"><CircleAlert size={18} />{error}</div><div className="mt-5"><Btn secondary onClick={reset}>RETURN TO HOME</Btn></div></>}
    {error && status === 'select' && <div className="mt-3 text-sm text-red-700">{error}</div>}
  </main></div>;
}

export default function App() {
  const [page, setPage] = useState('main'); const [data, setData] = useState(null);
  const reset = useCallback(() => { setPage('main'); setData(null); }, []);
  const choose = op => { if (op === 'KEY_OUT') setPage('keyout'); else setPage('biometric'); };
  const verified = useCallback(x => { setData(x); setPage('keyin'); }, []);
  if (page === 'main') return <Main choose={choose} />;
  if (page === 'keyout') return <KeyOut back={reset} reset={reset} />;
  if (page === 'biometric') return <Biometric back={reset} verified={verified} />;
  return <KeyIn data={data} reset={reset} />;
}
