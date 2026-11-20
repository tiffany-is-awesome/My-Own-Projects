// 🍩 "Treat the developer to a donut": a discreet tip jar, same idea as Tiffo's.
// Shows nothing until CONFIG.GCASH_QR or CONFIG.TIP_URL is set, so visitors never see a broken button.
import { useState } from 'react';
import { CONFIG } from '../config.js';
import { useStore } from '../store.jsx';
import { Modal } from './common.jsx';

export const tipsOn = () => !!(CONFIG.GCASH_QR || CONFIG.TIP_URL);

export default function TipJar({ compact = false }) {
  const { state } = useStore();
  const [qr, setQr] = useState(false);
  if (!tipsOn()) return null;
  // Honest "time saved" line: only counts things she actually did in Wearwise.
  const outfits = state.outfits.filter((o) => !o.demo).length + state.plans.length + state.history.length;
  return (
    <section className={'tip-card' + (compact ? ' compact' : '')} aria-label="Support the developer">
      <div className="tip-row">
        <span className="tip-donut" aria-hidden="true">🍩</span>
        <div>
          <b>Saved you time? Treat the developer to a donut</b>
          <div className="small">{outfits > 0 ? `You've saved, planned or worn ${outfits} outfit${outfits > 1 ? 's' : ''} with Wearwise. ` : ''}Wearwise is free, with no ads. Tips are optional and keep it that way.</div>
        </div>
      </div>
      <div className="tip-actions">
        {CONFIG.GCASH_QR && <button className="btn sm tip-gcash" onClick={() => setQr(true)}><span className="g" aria-hidden="true">G</span> GCash / QR Ph</button>}
        {CONFIG.TIP_URL && <a className="btn sm primary" href={CONFIG.TIP_URL} target="_blank" rel="noopener noreferrer">💳 Card / PayPal</a>}
      </div>
      {qr && (
        <Modal title="🍩 Treat the developer" onClose={() => setQr(false)}>
          <div className="tip-qr">
            <p className="small muted">{CONFIG.GCASH_NAME ? `GCash · ${CONFIG.GCASH_NAME}` : 'GCash · Maya · any PH bank'}</p>
            <img src={CONFIG.GCASH_QR} alt="GCash / QR Ph code for tips" />
            <p className="tiny">Scan with GCash, Maya or your bank app (QR Ph). Any amount is appreciated. Thank you!</p>
          </div>
        </Modal>
      )}
    </section>
  );
}
